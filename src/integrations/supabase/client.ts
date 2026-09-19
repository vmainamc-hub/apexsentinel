// Local persistence boundary for the legacy optional Supabase mirror.
// The Sentinel signal path is fully local/live and does not depend on Supabase.
// If a real Supabase integration is provisioned later, this module can be
// replaced without changing Sentinel engines or their signal calculations.

type Row = Record<string, any>;

const emptyQuery = {
  select: (_columns?: string) => emptyQuery,
  eq: (_column: string, _value: unknown) => emptyQuery,
  order: (_column: string, _options?: { ascending?: boolean }) => emptyQuery,
  limit: async (_count: number) => ({ data: [] as Row[], error: null as null }),
};

export const supabase = {
  auth: {
    async getUser() {
      return { data: { user: null }, error: null };
    },
  },
  from(_table: string) {
    return {
      async upsert(_rows: unknown, _options?: unknown) {
        return { data: null, error: null };
      },
      select(columns?: string) {
        void columns;
        return emptyQuery;
      },
    };
  },
};
