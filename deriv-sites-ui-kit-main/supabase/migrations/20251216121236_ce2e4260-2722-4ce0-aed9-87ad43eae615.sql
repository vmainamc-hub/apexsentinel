-- Add pending_reason and deleted_bot_name columns to track what caused pending status
ALTER TABLE public.sites 
ADD COLUMN pending_reason text DEFAULT NULL,
ADD COLUMN deleted_bot_name text DEFAULT NULL;