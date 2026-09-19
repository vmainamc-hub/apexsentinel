// Optional local persistence boundary. Sentinel live analysis does not depend on Supabase.
type Row = Record<string, any>;
type QueryResult = { data: Row[]; error: { message: string } | null };
type Query = {
  select: (columns?: string) => Query;
  eq: (column: string, value: unknown) => Query;
  order: (column: string, options?: { ascending?: boolean }) => Query;
  limit: (count: number) => Promise<QueryResult>;
};
const query: Query = {
  select: (_columns?: string) => query,
  eq: (_column: string, _value: unknown) => query,
  order: (_column: string, _options?: { ascending?: boolean }) => query,
  limit: async (_count: number) => ({ data: [], error: null }),
};
export const supabase = {
  auth: { async getUser() { return { data: { user: null }, error: null }; } },
  from(_table: string) {
    return {
      async upsert(_rows: unknown, _options?: unknown) { return { data: null, error: null as { message: string } | null }; },
      select(_columns?: string) { return query; },
    };
  },
};
