-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Allow public read for status checking" ON public.domain_purchases;
DROP POLICY IF EXISTS "Allow insert for edge functions" ON public.domain_purchases;
DROP POLICY IF EXISTS "Allow update for edge functions" ON public.domain_purchases;
DROP POLICY IF EXISTS "Allow delete for failed purchases" ON public.domain_purchases;

-- Create restrictive policies - edge functions use service role key which bypasses RLS
-- No public read access - status checking will be done via edge function
-- These policies now only allow authenticated service role operations