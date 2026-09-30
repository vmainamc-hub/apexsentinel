-- Add policy to deny anonymous access to domain_purchases table
-- This ensures only authenticated users can access the table at all
CREATE POLICY "Deny anonymous access" 
ON public.domain_purchases 
FOR SELECT 
USING (auth.uid() IS NOT NULL);