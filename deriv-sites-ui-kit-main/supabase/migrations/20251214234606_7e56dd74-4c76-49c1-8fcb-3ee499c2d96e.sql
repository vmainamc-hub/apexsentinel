-- Add email column to domain_purchases
ALTER TABLE public.domain_purchases 
ADD COLUMN IF NOT EXISTS email text;