-- Add failure_reason and tracking_number columns to domain_purchases
ALTER TABLE public.domain_purchases 
ADD COLUMN IF NOT EXISTS failure_reason text,
ADD COLUMN IF NOT EXISTS tracking_number text;

-- Create index for tracking number lookups
CREATE INDEX IF NOT EXISTS idx_domain_purchases_tracking ON public.domain_purchases(tracking_number);

-- Add delete policy for failed purchases
CREATE POLICY "Allow delete for failed purchases" 
ON public.domain_purchases 
FOR DELETE 
USING (status = 'failed' OR status = 'cancelled');