-- Allow admin to delete support tickets
CREATE POLICY "Admin can delete tickets"
ON public.support_tickets
FOR DELETE
TO authenticated
USING (auth.jwt() ->> 'email' = 'dukeorucho12@gmail.com');

-- Allow admin to delete support messages
CREATE POLICY "Admin can delete messages"
ON public.support_messages
FOR DELETE
TO authenticated
USING (auth.jwt() ->> 'email' = 'dukeorucho12@gmail.com');