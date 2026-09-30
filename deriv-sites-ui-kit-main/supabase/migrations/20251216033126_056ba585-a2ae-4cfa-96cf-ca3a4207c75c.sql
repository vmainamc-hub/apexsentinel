-- Create storage bucket for XML bot files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('xml-bots', 'xml-bots', false, 5242880, ARRAY['text/xml', 'application/xml']);

-- Create policies for xml-bots bucket
CREATE POLICY "Users can upload their own XML bots"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'xml-bots' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own XML bots"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'xml-bots' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own XML bots"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'xml-bots' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create xml_bots table
CREATE TABLE public.xml_bots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on xml_bots
ALTER TABLE public.xml_bots ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for xml_bots
CREATE POLICY "Users can view their own xml bots"
ON public.xml_bots
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own xml bots"
ON public.xml_bots
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own xml bots"
ON public.xml_bots
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own xml bots"
ON public.xml_bots
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);