import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEV_AUTH_ENABLED = import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEV_AUTH === 'true';
const DEV_EMAIL = 'developer@reef.local';
const DEV_PASSWORD = 'ReefDev2026!';
const DEV_SESSION_KEY = 'reef_dev_authenticated';

const createDevUser = (): User => ({
  id: '00000000-0000-4000-8000-000000000001',
  aud: 'authenticated',
  role: 'authenticated',
  email: DEV_EMAIL,
  email_confirmed_at: new Date(0).toISOString(),
  phone: '',
  confirmed_at: new Date(0).toISOString(),
  last_sign_in_at: new Date().toISOString(),
  app_metadata: { provider: 'development', providers: ['development'] },
  user_metadata: { display_name: 'Development User', development: true },
  identities: [],
  created_at: new Date(0).toISOString(),
  updated_at: new Date().toISOString(),
  is_anonymous: false,
} as User);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (DEV_AUTH_ENABLED) {
      if (localStorage.getItem(DEV_SESSION_KEY) === 'true') {
        setUser(createDevUser());
      }
      setLoading(false);
      return;
    }

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, displayName?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          display_name: displayName
        }
      }
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    if (DEV_AUTH_ENABLED) {
      if (email.toLowerCase() !== DEV_EMAIL || password !== DEV_PASSWORD) {
        return { error: new Error('Invalid development login credentials') };
      }
      localStorage.setItem(DEV_SESSION_KEY, 'true');
      setUser(createDevUser());
      setSession(null);
      return { error: null };
    }
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    return { error };
  };

  const signInWithGoogle = async () => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl
      }
    });
    return { error };
  };

  const resetPassword = async (email: string) => {
    const redirectUrl = `${window.location.origin}/auth/reset-password`;
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl
    });
    return { error };
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error };
  };

  const signOut = async () => {
    if (DEV_AUTH_ENABLED) {
      localStorage.removeItem(DEV_SESSION_KEY);
      setUser(null);
      setSession(null);
      return;
    }
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signInWithGoogle, resetPassword, updatePassword, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
