-- Drop existing policies on domain_purchases
DROP POLICY IF EXISTS "Users can view their own purchases" ON public.domain_purchases;
DROP POLICY IF EXISTS "Users can insert their own purchases" ON public.domain_purchases;
DROP POLICY IF EXISTS "Users can update their own pending purchases" ON public.domain_purchases;
DROP POLICY IF EXISTS "Users can delete their own failed purchases" ON public.domain_purchases;

-- Recreate policies with explicit TO authenticated requirement
CREATE POLICY "Users can view their own purchases" 
ON public.domain_purchases 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own purchases" 
ON public.domain_purchases 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pending purchases" 
ON public.domain_purchases 
FOR UPDATE 
TO authenticated
USING ((auth.uid() = user_id) AND (status = ANY (ARRAY['pending'::text, 'processing'::text])))
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own failed purchases" 
ON public.domain_purchases 
FOR DELETE 
TO authenticated
USING ((auth.uid() = user_id) AND (status = ANY (ARRAY['failed'::text, 'cancelled'::text])));