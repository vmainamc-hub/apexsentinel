-- Add explicit deny policy for unauthenticated access to domain_purchases table
CREATE POLICY "Deny anonymous access to domain_purchases"
ON public.domain_purchases
FOR SELECT
TO anon
USING (false);