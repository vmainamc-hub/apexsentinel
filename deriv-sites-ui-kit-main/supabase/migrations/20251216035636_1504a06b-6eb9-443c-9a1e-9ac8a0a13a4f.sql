-- Add foreign key from support_tickets.user_id to profiles.id
ALTER TABLE public.support_tickets
ADD CONSTRAINT support_tickets_user_id_profiles_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;