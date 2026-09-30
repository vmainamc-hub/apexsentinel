-- Remove the overly permissive policy that only checks authentication
DROP POLICY IF EXISTS "Deny anonymous access" ON public.domain_purchases;