import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export interface DomainPurchase {
  id: string;
  domain_name: string;
  phone_number: string;
  amount: number;
  transaction_id: string | null;
  lipana_transaction_id: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  mpesa_receipt_number: string | null;
  payment_date: string | null;
  created_at: string;
  updated_at: string;
  failure_reason: string | null;
  tracking_number: string | null;
}

export const useDomainPurchases = () => {
  const { user } = useAuth();
  const [purchases, setPurchases] = useState<DomainPurchase[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPurchases = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // Explicitly filter by user_id to ensure users only see their own domains
      const { data, error } = await supabase
        .from('domain_purchases')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching purchases:', error);
        setLoading(false);
        return;
      }

      setPurchases((data || []) as DomainPurchase[]);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching purchases:', err);
      setLoading(false);
    }
  }, [user]);

  const deletePurchase = async (id: string) => {
    try {
      const { error } = await supabase
        .from('domain_purchases')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting purchase:', error);
        toast.error('Failed to delete purchase');
        return false;
      }

      // Remove from local state
      setPurchases((prev) => prev.filter((p) => p.id !== id));
      toast.success('Failed purchase removed');
      return true;
    } catch (err) {
      console.error('Error deleting purchase:', err);
      toast.error('Failed to delete purchase');
      return false;
    }
  };

  useEffect(() => {
    fetchPurchases();

    // Subscribe to realtime updates - these still work as realtime uses service role internally
    const channel = supabase
      .channel('domain_purchases_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'domain_purchases',
        },
        (payload) => {
          console.log('Realtime update:', payload);
          if (payload.eventType === 'INSERT') {
            setPurchases((prev) => [payload.new as DomainPurchase, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setPurchases((prev) =>
              prev.map((p) =>
                p.id === (payload.new as DomainPurchase).id
                  ? (payload.new as DomainPurchase)
                  : p
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setPurchases((prev) =>
              prev.filter((p) => p.id !== (payload.old as { id: string }).id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPurchases]);

  const completedPurchases = purchases.filter((p) => p.status === 'completed');
  const pendingPurchases = purchases.filter((p) => 
    p.status === 'pending' || p.status === 'processing'
  );
  const failedPurchases = purchases.filter((p) => 
    p.status === 'failed' || p.status === 'cancelled'
  );

  return {
    purchases,
    completedPurchases,
    pendingPurchases,
    failedPurchases,
    loading,
    refetch: fetchPurchases,
    deletePurchase,
  };
};
