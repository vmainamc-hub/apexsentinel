-- Create a policy for admin to view all sites
CREATE POLICY "Admin can view all sites"
ON public.sites
FOR SELECT
TO authenticated
USING (
  auth.jwt() ->> 'email' = 'dukeorucho12@gmail.com'
);

-- Create a policy for admin to update all sites (to mark as active)
CREATE POLICY "Admin can update all sites"
ON public.sites
FOR UPDATE
TO authenticated
USING (auth.jwt() ->> 'email' = 'dukeorucho12@gmail.com')
WITH CHECK (auth.jwt() ->> 'email' = 'dukeorucho12@gmail.com');

-- Create a policy for admin to view all profiles (to see site owner info)
CREATE POLICY "Admin can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.jwt() ->> 'email' = 'dukeorucho12@gmail.com');

-- Create a policy for admin to view all xml_bots
CREATE POLICY "Admin can view all xml bots"
ON public.xml_bots
FOR SELECT
TO authenticated
USING (auth.jwt() ->> 'email' = 'dukeorucho12@gmail.com');