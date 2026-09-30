
-- Add admin access policies for domain_purchases table
-- Admin can view all purchases for oversight
CREATE POLICY "Admin can view all purchases" 
ON public.domain_purchases 
FOR SELECT 
USING ((auth.jwt() ->> 'email'::text) = 'dukeorucho12@gmail.com');

-- Admin can update purchases (for support/refund purposes)
CREATE POLICY "Admin can update all purchases" 
ON public.domain_purchases 
FOR UPDATE 
USING ((auth.jwt() ->> 'email'::text) = 'dukeorucho12@gmail.com')
WITH CHECK ((auth.jwt() ->> 'email'::text) = 'dukeorucho12@gmail.com');
