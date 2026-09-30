-- Drop existing constraint and recreate with draft status
ALTER TABLE public.sites DROP CONSTRAINT sites_status_check;

ALTER TABLE public.sites ADD CONSTRAINT sites_status_check 
CHECK (status = ANY (ARRAY['draft'::text, 'pending'::text, 'active'::text, 'suspended'::text, 'deleted'::text]));