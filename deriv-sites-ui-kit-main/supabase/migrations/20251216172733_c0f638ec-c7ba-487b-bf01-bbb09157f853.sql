-- Update admin RLS policies to use has_role function instead of hardcoded email

-- domain_purchases
DROP POLICY IF EXISTS "Admin can view all purchases" ON public.domain_purchases;
CREATE POLICY "Admin can view all purchases"
ON public.domain_purchases
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admin can update all purchases" ON public.domain_purchases;
CREATE POLICY "Admin can update all purchases"
ON public.domain_purchases
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- profiles
DROP POLICY IF EXISTS "Admin can view all profiles" ON public.profiles;
CREATE POLICY "Admin can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- sites
DROP POLICY IF EXISTS "Admin can view all sites" ON public.sites;
CREATE POLICY "Admin can view all sites"
ON public.sites
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admin can update all sites" ON public.sites;
CREATE POLICY "Admin can update all sites"
ON public.sites
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- support_messages
DROP POLICY IF EXISTS "Admin can view all messages" ON public.support_messages;
CREATE POLICY "Admin can view all messages"
ON public.support_messages
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admin can send messages" ON public.support_messages;
CREATE POLICY "Admin can send messages"
ON public.support_messages
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') AND sender_type = 'admin');

DROP POLICY IF EXISTS "Admin can delete messages" ON public.support_messages;
CREATE POLICY "Admin can delete messages"
ON public.support_messages
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- support_tickets
DROP POLICY IF EXISTS "Admin can view all tickets" ON public.support_tickets;
CREATE POLICY "Admin can view all tickets"
ON public.support_tickets
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admin can update all tickets" ON public.support_tickets;
CREATE POLICY "Admin can update all tickets"
ON public.support_tickets
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admin can delete tickets" ON public.support_tickets;
CREATE POLICY "Admin can delete tickets"
ON public.support_tickets
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- xml_bots
DROP POLICY IF EXISTS "Admin can view all xml bots" ON public.xml_bots;
CREATE POLICY "Admin can view all xml bots"
ON public.xml_bots
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));