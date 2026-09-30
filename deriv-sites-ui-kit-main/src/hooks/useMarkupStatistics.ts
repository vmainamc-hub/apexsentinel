import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type MarkupRecord = {
  siteId: string;
  derivApplicationId: string;
  startDate: string;
  endDate: string;
  currency?: string;
  markupAmount?: number;
  tradeCount?: number;
  turnover?: number;
  synchronizedAt: string;
};

export function useMarkupStatistics(input: { siteId?: string; dateFrom: string; dateTo: string; adminMode?: boolean; enabled?: boolean }) {
  return useQuery({
    queryKey: ["markup-statistics", input.siteId, input.dateFrom, input.dateTo, input.adminMode],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("fetch-markup-statistics", {
        body: { siteId: input.siteId, dateFrom: input.dateFrom, dateTo: input.dateTo, adminMode: input.adminMode === true },
      });
      if (error || data?.error) throw new Error(data?.error?.message || error?.message || "Markup statistics are unavailable");
      return data as { records: MarkupRecord[]; errors: Array<{ siteId: string; code: string }>; synchronizedAt: string; partnerCommissions: { available: false; reason: string } };
    },
    enabled: input.enabled !== false,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

