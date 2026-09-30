import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, Check, Globe2, Loader2, Lock, Mail, ShieldCheck, Wand2, X } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const emailSchema = z.string().email("Invalid email address").max(255, "Email too long");
const strongPasswordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password too long")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");
const loginPasswordSchema = z.string().min(1, "Password is required").max(72, "Password too long");

const passwordRequirements = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "One uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "One lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { label: "One number", test: (p: string) => /[0-9]/.test(p) },
  { label: "One special character", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("login");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const devAuthEnabled = import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEV_AUTH === "true";
  const { signIn, signUp, signInWithGoogle, resetPassword, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user) navigate("/");
  }, [user, navigate]);

  const validateInputs = (isSignUp = false) => {
    try {
      emailSchema.parse(email);
      (isSignUp ? strongPasswordSchema : loginPasswordSchema).parse(password);
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({ title: "Validation Error", description: error.errors[0].message, variant: "destructive" });
      }
      return false;
    }
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateInputs(false)) return;
    setIsLoading(true);
    const { error } = await signIn(email, password);
    setIsLoading(false);
    if (error) {
      let description = error.message;
      if (error.message === "Invalid login credentials") {
        const { data: existingProfile } = await supabase.from("profiles").select("id").eq("email", email.toLowerCase()).maybeSingle();
        description = existingProfile ? "Invalid password. If this account uses Google, continue with Google." : "Invalid email or password. Please try again.";
      }
      toast({ title: "Login Failed", description, variant: "destructive" });
      return;
    }
    toast({ title: "Welcome back", description: "You are signed in to the site manager." });
    navigate("/");
  };

  const handleSignUp = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateInputs(true)) return;
    setIsLoading(true);
    const { data: existingProfile } = await supabase.from("profiles").select("id").eq("email", email.toLowerCase()).maybeSingle();
    if (existingProfile) {
      setIsLoading(false);
      toast({ title: "Account Already Exists", description: "This email is already registered. Try login or Google sign-in.", variant: "destructive" });
      return;
    }
    const { error } = await signUp(email, password, displayName);
    setIsLoading(false);
    if (error) {
      toast({ title: "Sign Up Failed", description: error.message.includes("already registered") ? "This email is already registered. Try login or Google sign-in." : error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Account Created", description: "Your account has been created successfully." });
    navigate("/");
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    const { error } = await signInWithGoogle();
    setIsGoogleLoading(false);
    if (error) toast({ title: "Google Sign In Failed", description: error.message, variant: "destructive" });
  };

  const handleForgotPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      emailSchema.parse(email);
    } catch (error) {
      if (error instanceof z.ZodError) toast({ title: "Validation Error", description: error.errors[0].message, variant: "destructive" });
      return;
    }
    setIsLoading(true);
    const { error } = await resetPassword(email);
    setIsLoading(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Reset Link Sent", description: "Check your email for a password reset link." });
    setShowForgotPassword(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <div className="grid min-h-screen lg:grid-cols-[1fr_480px]">
        <section className="hidden border-r border-slate-200 bg-white p-10 lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-md bg-slate-950 text-white">
                <Globe2 className="h-5 w-5" />
              </div>
              <div>
                <h1 className="font-semibold">DerivSites Manager</h1>
                <p className="text-xs text-slate-500">Customer-controlled trading sites</p>
              </div>
            </div>
            <div className="mt-20 max-w-xl">
              <p className="mb-3 text-xs font-medium uppercase text-sky-700">Secure workspace</p>
              <h2 className="text-5xl font-semibold tracking-normal">Manage hundreds of trader sites from one calm dashboard.</h2>
              <p className="mt-5 text-base leading-7 text-slate-600">
                Sign in to configure branding, free bots, Deriv tools, GitHub publishing and Netlify deployments for each customer website.
              </p>
            </div>
          </div>
          <div className="grid gap-3">
            {[
              { icon: Wand2, title: "Guided setup", text: "Plan, brand, preview and domain setup in one wizard." },
              { icon: Bot, title: "Free bots", text: "Import XML bots into each customer site." },
              { icon: ShieldCheck, title: "Server-side security", text: "Deriv and GitHub secrets stay out of React." },
            ].map(item => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="rounded-lg border border-slate-200 p-4">
                  <Icon className="mb-3 h-4 w-4 text-slate-700" />
                  <h3 className="text-sm font-semibold">{item.title}</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{item.text}</p>
                </div>
              );
            })}
          </div>
        </section>

        <main className="flex items-center justify-center p-4 sm:p-6">
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-6">
              <div className="mb-4 grid h-11 w-11 place-items-center rounded-md bg-slate-950 text-white lg:hidden">
                <Globe2 className="h-5 w-5" />
              </div>
              <h2 className="text-2xl font-semibold">{showForgotPassword ? "Reset password" : "Sign in to Site Manager"}</h2>
              <p className="mt-1 text-sm text-slate-500">Access your customer sites, domains and publishing workflow.</p>
            </div>

            {devAuthEnabled ? (
              <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
                <p className="font-medium text-amber-950">Development login enabled</p>
                <p className="mt-1 text-xs text-amber-800">developer@reef.local / ReefDev2026!</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2 w-full border-amber-300 bg-white"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setActiveTab("login");
                    setEmail("developer@reef.local");
                    setPassword("ReefDev2026!");
                  }}
                >
                  Fill development credentials
                </Button>
              </div>
            ) : null}

            {showForgotPassword ? (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgot-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input id="forgot-email" type="email" placeholder="you@example.com" value={email} onChange={event => setEmail(event.target.value)} className="pl-10" required />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Send reset link
                </Button>
                <Button type="button" variant="ghost" className="w-full" onClick={() => setShowForgotPassword(false)}>Back to login</Button>
              </form>
            ) : (
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">Login</TabsTrigger>
                  <TabsTrigger value="signup">Sign Up</TabsTrigger>
                </TabsList>

                <TabsContent value="login" className="mt-5">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input id="login-email" type="email" placeholder="you@example.com" value={email} onChange={event => setEmail(event.target.value)} className="pl-10" required />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="login-password">Password</Label>
                        <Button type="button" variant="link" className="h-auto px-0 text-xs text-slate-500" onClick={() => setShowForgotPassword(true)}>Forgot password?</Button>
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input id="login-password" type="password" placeholder="Your password" value={password} onChange={event => setPassword(event.target.value)} className="pl-10" required />
                      </div>
                    </div>
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Login
                    </Button>
                    <Button type="button" variant="outline" className="w-full" onClick={handleGoogleSignIn} disabled={isGoogleLoading}>
                      {isGoogleLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Continue with Google
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="signup" className="mt-5">
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name">Display name</Label>
                      <Input id="signup-name" type="text" placeholder="Your name" value={displayName} onChange={event => setDisplayName(event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Email</Label>
                      <Input id="signup-email" type="email" placeholder="you@example.com" value={email} onChange={event => setEmail(event.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Password</Label>
                      <Input id="signup-password" type="password" placeholder="Create a strong password" value={password} onChange={event => setPassword(event.target.value)} required />
                      {password ? (
                        <div className="mt-2 grid gap-1">
                          {passwordRequirements.map(req => (
                            <div key={req.label} className="flex items-center gap-2 text-xs">
                              {req.test(password) ? <Check className="h-3 w-3 text-emerald-600" /> : <X className="h-3 w-3 text-slate-400" />}
                              <span className={req.test(password) ? "text-emerald-700" : "text-slate-500"}>{req.label}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Create account
                    </Button>
                    <Button type="button" variant="outline" className="w-full" onClick={handleGoogleSignIn} disabled={isGoogleLoading}>
                      {isGoogleLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Continue with Google
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
