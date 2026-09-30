-- Add policy to deny anonymous access to sites
CREATE POLICY "Deny anonymous access to sites" 
ON public.sites 
FOR SELECT 
USING (auth.uid() IS NOT NULL);