-- Create domain_purchases table to track all domain purchases
CREATE TABLE public.domain_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  transaction_id TEXT,
  lipana_transaction_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  mpesa_receipt_number TEXT,
  payment_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.domain_purchases ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to insert (for the edge function)
CREATE POLICY "Allow insert for edge functions"
ON public.domain_purchases
FOR INSERT
WITH CHECK (true);

-- Create policy to allow reading own purchases (by phone for now since no auth)
CREATE POLICY "Allow public read for status checking"
ON public.domain_purchases
FOR SELECT
USING (true);

-- Create policy to allow updates from edge functions
CREATE POLICY "Allow update for edge functions"
ON public.domain_purchases
FOR UPDATE
USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_domain_purchases_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_domain_purchases_updated_at
BEFORE UPDATE ON public.domain_purchases
FOR EACH ROW
EXECUTE FUNCTION public.update_domain_purchases_updated_at();

-- Enable realtime for domain_purchases
ALTER PUBLICATION supabase_realtime ADD TABLE public.domain_purchases;