-- Add deriv_api_token column to sites table
ALTER TABLE public.sites 
ADD COLUMN deriv_api_token text;