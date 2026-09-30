-- Create a policy for admin to view all XML bot files in storage
CREATE POLICY "Admin can view all XML bot files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'xml-bots' AND 
  auth.jwt() ->> 'email' = 'dukeorucho12@gmail.com'
);