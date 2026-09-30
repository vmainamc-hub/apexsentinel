-- Drop the existing delete policy
DROP POLICY IF EXISTS "Users can delete their own failed purchases" ON public.domain_purchases;

-- Create new policy that allows deleting pending, processing, failed, and cancelled purchases
CREATE POLICY "Users can delete their own non-completed purchases" 
ON public.domain_purchases 
FOR DELETE 
USING (
  (auth.uid() = user_id) AND 
  (status = ANY (ARRAY['pending'::text, 'processing'::text, 'failed'::text, 'cancelled'::text]))
);