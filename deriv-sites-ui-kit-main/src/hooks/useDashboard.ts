import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Site {
  id: string;
  name: string;
  status: string;
  domain_id: string | null;
  deriv_affiliate_id: string | null;
  created_at: string;
  configuration_status?: string;
  active_configuration_version?: number | null;
  domain_purchases?: {
    domain_name: string;
  } | null;
}

export interface Subscription {
  id: string;
  plan_type: '8percent' | 'onetime';
  status: string;
  start_date: string;
  end_date: string | null;
}

export interface DashboardStats {
  totalSites: number;
  activeSites: number;
}

export function useDashboard() {
  const { user } = useAuth();

  const { data: sites, isLoading: sitesLoading, refetch: refetchSites } = useQuery({
    queryKey: ['sites', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sites')
        .select(`
          *,
          domain_purchases(domain_name)
        `)
        .neq('status', 'deleted')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Site[];
    },
    enabled: !!user,
  });

  const { data: subscription, isLoading: subscriptionLoading } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', user!.id)
        .eq('status', 'active')
        .maybeSingle();

      if (error) throw error;
      return data as Subscription | null;
    },
    enabled: !!user,
  });

  const stats: DashboardStats = {
    totalSites: sites?.length ?? 0,
    activeSites: sites?.filter(s => s.status === 'active').length ?? 0,
  };

  return {
    sites: sites ?? [],
    subscription,
    stats,
    isLoading: sitesLoading || subscriptionLoading,
    refetch: refetchSites,
  };
}
