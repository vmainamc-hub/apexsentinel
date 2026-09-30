-- Add dark mode default preference for public site settings
ALTER TABLE public.site_settings
ADD COLUMN dark_mode_default BOOLEAN NOT NULL DEFAULT true;
