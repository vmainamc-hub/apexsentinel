-- Add UPDATE policy for users to update their own pending/processing purchases
CREATE POLICY "Users can update their own pending purchases" 
ON public.domain_purchases 
FOR UPDATE 
USING (auth.uid() = user_id AND status IN ('pending', 'processing'))
WITH CHECK (auth.uid() = user_id);