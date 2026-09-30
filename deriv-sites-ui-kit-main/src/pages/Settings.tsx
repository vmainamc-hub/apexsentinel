import { User, AlertTriangle, BarChart3, Save, ExternalLink, Sparkles, Loader2, Globe, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useDashboard } from "@/hooks/useDashboard";

const Settings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { sites } = useDashboard();
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Get the first active/pending site with a deriv_affiliate_id
  const activeSite = sites.find(s => (s.status === 'active' || s.status === 'pending') && s.deriv_affiliate_id);
  const derivAppId = activeSite?.deriv_affiliate_id || null;
  const derivApiUrl = derivAppId 
    ? `https://api.deriv.com/app/${derivAppId}`
    : null;

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .single();

      if (data) {
        setDisplayName(data.display_name || "");
      }
      setLoading(false);
    };

    fetchProfile();
  }, [user]);

  const handleUpdateName = async () => {
    if (!user) return;
    
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName })
      .eq("id", user.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update display name",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Display name updated successfully",
      });
    }
    setSaving(false);
  };

  return (
    <div className="flex-1 p-4 sm:p-8 max-w-2xl">
      {/* Account Information Section */}
      <div className="rounded-xl border border-white/10 bg-panel-bg p-6 mb-6">
        <div className="flex items-center gap-3 mb-2">
          <User className="w-5 h-5 text-purple-glow" />
          <h2 className="text-lg font-semibold text-white">Account Information</h2>
        </div>
        <p className="text-muted-foreground text-sm mb-6">View and update your account details</p>

        {/* Email Field */}
        <div className="mb-4">
          <label className="text-sm text-white mb-2 block">Email</label>
          <Input
            type="email"
            value={user?.email || ""}
            disabled
            className="bg-sidebar-bg border-white/10 text-white/70"
          />
          <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
        </div>

        {/* Display Name Field */}
        <div className="mb-4">
          <label className="text-sm text-white mb-2 block">Display Name</label>
          {loading ? (
            <div className="h-10 bg-sidebar-bg border border-white/10 rounded-md flex items-center justify-center">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="bg-sidebar-bg border-white/10 text-white"
              placeholder="Enter your display name"
            />
          )}
        </div>

        <Button 
          onClick={handleUpdateName}
          disabled={saving || loading}
          className="gradient-purple glow-purple text-white rounded-lg px-4"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Update Name
        </Button>
      </div>

      {/* Deriv API Integration Section */}
      <div className="rounded-xl border border-white/10 bg-panel-bg p-6 mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Key className="w-5 h-5 text-purple-glow" />
          <h2 className="text-lg font-semibold text-white">Deriv API Integration</h2>
        </div>
        <p className="text-muted-foreground text-sm mb-4">Your connected Deriv application</p>

        {derivAppId ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
                  <Globe className="w-5 h-5 text-green-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-400 mb-1">Connected</p>
                  <p className="text-sm text-muted-foreground mb-2">
                    Your Deriv App ID is configured for {activeSite?.domain_purchases?.domain_name || activeSite?.name}
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="px-2 py-1 rounded bg-white/10 text-foreground text-sm">
                      App ID: {derivAppId}
                    </code>
                  </div>
                </div>
              </div>
            </div>

            {derivApiUrl && (
              <a 
                href={derivApiUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 text-sm text-primary hover:underline"
              >
                <ExternalLink className="w-4 h-4" />
                View App in Deriv API Dashboard
              </a>
            )}
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-400 mb-1">Not Connected</p>
                <p className="text-sm text-amber-400/80">
                  Complete the setup for one of your domains to connect your Deriv API.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Usage & Quota Section */}
      <div className="rounded-xl border border-white/10 bg-panel-bg p-6 mb-6">
        <div className="flex items-center gap-3 mb-2">
          <BarChart3 className="w-5 h-5 text-purple-glow" />
          <h2 className="text-lg font-semibold text-white">Usage & Quota</h2>
        </div>
        <p className="text-muted-foreground text-sm mb-6">Your current usage statistics</p>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="rounded-lg bg-sidebar-bg border border-white/10 p-4">
            <p className="text-muted-foreground text-sm mb-1">Sites Created</p>
            <p className="text-2xl font-bold text-white">{sites.length}</p>
          </div>
          <div className="rounded-lg bg-sidebar-bg border border-white/10 p-4">
            <p className="text-muted-foreground text-sm mb-1">Active Sites</p>
            <p className="text-2xl font-bold text-white">{sites.filter(s => s.status === 'active').length}</p>
          </div>
        </div>

        <div className="flex items-center justify-between py-3 border-t border-white/10">
          <span className="text-muted-foreground text-sm">Site Quota</span>
          <span className="text-white font-medium">{sites.length} / 5</span>
        </div>

        <div className="flex items-center justify-between py-3 border-t border-white/10">
          <span className="text-muted-foreground text-sm">Role</span>
          <Badge className="bg-purple-glow/20 text-purple-glow border-purple-glow/30">
            <Sparkles className="w-3 h-3 mr-1" />
            User
          </Badge>
        </div>
      </div>

      {/* Danger Zone Section */}
      <div className="rounded-xl border border-red-500/30 bg-panel-bg p-6">
        <div className="flex items-center gap-3 mb-2">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <h2 className="text-lg font-semibold text-red-500">Danger Zone</h2>
        </div>
        <p className="text-muted-foreground text-sm mb-4">Irreversible and destructive actions</p>

        <Button variant="outline" className="border-red-500/30 text-red-500 hover:bg-red-500/10">
          Delete Account
        </Button>
      </div>
    </div>
  );
};

export default Settings;
