import { useState, useEffect, useRef } from "react";
import { Bot, Plus, Search, Filter, Sparkles, Globe, FileCode, GripVertical, Trash2, ExternalLink, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDashboard } from "@/hooks/useDashboard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface XmlBot {
  id: string;
  file_name: string;
  file_path: string;
  display_order: number;
  site_id: string;
  created_at: string;
}

const XMLBots = () => {
  const { user } = useAuth();
  const { sites, refetch: refetchSites } = useDashboard();
  const [selectedSiteId, setSelectedSiteId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [bots, setBots] = useState<XmlBot[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get sites that have bots configured (active or pending)
  const configuredSites = sites.filter(s => s.status === 'active' || s.status === 'pending');

  useEffect(() => {
    const fetchBots = async () => {
      if (!user) return;
      
      setLoading(true);
      try {
        let query = supabase
          .from('xml_bots')
          .select('*')
          .eq('user_id', user.id)
          .order('display_order', { ascending: true });

        if (selectedSiteId !== "all") {
          query = query.eq('site_id', selectedSiteId);
        }

        const { data, error } = await query;
        if (error) throw error;
        setBots(data || []);
      } catch (err) {
        console.error('Error fetching bots:', err);
        toast.error('Failed to load bots');
      } finally {
        setLoading(false);
      }
    };

    fetchBots();
  }, [user, selectedSiteId]);

  const filteredBots = bots.filter(bot => 
    bot.file_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getSiteName = (siteId: string) => {
    const site = sites.find(s => s.id === siteId);
    return site?.name || site?.domain_purchases?.domain_name || 'Unknown Site';
  };

  const markSiteAsPending = async (siteId: string, reason: 'new_site' | 'bot_added' | 'bot_deleted', deletedBotName?: string) => {
    try {
      const { error } = await supabase
        .from('sites')
        .update({ 
          status: 'pending',
          pending_reason: reason,
          deleted_bot_name: reason === 'bot_deleted' ? deletedBotName : null
        })
        .eq('id', siteId);
      
      if (error) throw error;
      refetchSites();
    } catch (err) {
      console.error('Error updating site status:', err);
    }
  };

  const handleDeleteBot = async (botId: string, fileName: string, siteId: string) => {
    const confirmed = window.confirm(`Are you sure you want to delete ${fileName}? This will mark the site as pending for admin review.`);
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('xml_bots')
        .delete()
        .eq('id', botId);

      if (error) throw error;
      
      setBots(prev => prev.filter(b => b.id !== botId));
      
      // Mark site as pending for admin review with deleted bot info
      await markSiteAsPending(siteId, 'bot_deleted', fileName);
      
      toast.success(`${fileName} deleted. Site marked as pending for review.`);
    } catch (err) {
      console.error('Error deleting bot:', err);
      toast.error('Failed to delete bot');
    }
  };

  const handleAddBot = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    if (selectedSiteId === "all") {
      toast.error('Please select a specific site to add bots');
      return;
    }

    setUploading(true);
    const files = Array.from(e.target.files);
    
    try {
      // Get current max display_order for this site
      const { data: existingBots } = await supabase
        .from('xml_bots')
        .select('display_order')
        .eq('site_id', selectedSiteId)
        .order('display_order', { ascending: false })
        .limit(1);
      
      let nextOrder = (existingBots?.[0]?.display_order ?? -1) + 1;

      for (const file of files) {
        if (!file.name.endsWith('.xml')) {
          toast.error(`${file.name} is not an XML file`);
          continue;
        }

        const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const uniquePrefix = `${nextOrder}-${Date.now()}`;
        const filePath = `${user?.id}/${selectedSiteId}/${uniquePrefix}-${sanitizedFileName}`;

        // Upload file to storage
        const { error: uploadError } = await supabase.storage
          .from('xml-bots')
          .upload(filePath, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          toast.error(`Failed to upload ${file.name}`);
          continue;
        }

        // Create database record
        const { data: newBot, error: dbError } = await supabase
          .from('xml_bots')
          .insert({
            user_id: user?.id,
            site_id: selectedSiteId,
            file_name: file.name,
            file_path: filePath,
            display_order: nextOrder,
          })
          .select()
          .single();

        if (dbError) {
          console.error('DB error:', dbError);
          toast.error(`Failed to save ${file.name}`);
          continue;
        }

        setBots(prev => [...prev, newBot]);
        nextOrder++;
      }

      // Mark site as pending for admin review with added bot info
      await markSiteAsPending(selectedSiteId, 'bot_added');
      
      toast.success(`Bot(s) added. Site marked as pending for review.`);
    } catch (err) {
      console.error('Error adding bots:', err);
      toast.error('Failed to add bots');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="flex-1 p-4 sm:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-purple-glow/20 flex items-center justify-center">
            <Bot className="w-5 h-5 sm:w-6 sm:h-6 text-purple-glow" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-white">XML Trading Bots</h1>
            <p className="text-muted-foreground text-xs sm:text-sm">View and manage your trading bots per site</p>
          </div>
        </div>
      </div>

      {/* Badge */}
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-glow/10 border border-purple-glow/20 text-purple-glow text-sm mb-6">
        <Sparkles className="w-4 h-4" />
        <span>Manage all your XML bots in one place</span>
      </div>

      {/* Search and Filter Bar */}
      <div className="rounded-xl border border-white/10 bg-panel-bg p-4 mb-6">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by bot name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-sidebar-bg border-white/10 text-white placeholder:text-muted-foreground"
            />
          </div>
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-muted-foreground hidden sm:block" />
            <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
              <SelectTrigger className="w-full sm:w-48 bg-sidebar-bg border-white/10 text-white">
                <SelectValue placeholder="All Sites" />
              </SelectTrigger>
              <SelectContent className="bg-panel-bg border-white/10">
                <SelectItem value="all">All Sites</SelectItem>
                {configuredSites.map(site => (
                  <SelectItem key={site.id} value={site.id}>
                    {site.domain_purchases?.domain_name || site.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <input
              type="file"
              ref={fileInputRef}
              accept=".xml"
              multiple
              onChange={handleAddBot}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={selectedSiteId === "all" || uploading}
              className="btn-primary"
              size="sm"
            >
              {uploading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-1" />
                  Add Bot
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Bots List */}
      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-panel-bg p-16 flex flex-col items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
          <p className="text-muted-foreground">Loading bots...</p>
        </div>
      ) : filteredBots.length > 0 ? (
        <div className="space-y-3">
          {filteredBots.map((bot, index) => (
            <div
              key={bot.id}
              className="p-4 rounded-xl border border-white/10 bg-panel-bg hover:border-primary/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <span className="text-sm font-bold text-purple-400">{bot.display_order + 1}</span>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm font-medium text-foreground truncate">{bot.file_name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {getSiteName(bot.site_id)}
                  </p>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteBot(bot.id, bot.file_name, bot.site_id)}
                  className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/10 bg-panel-bg p-12 sm:p-16 flex flex-col items-center justify-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-purple-glow/10 flex items-center justify-center mb-6 animate-pulse-subtle">
            <Bot className="w-8 h-8 sm:w-10 sm:h-10 text-purple-glow" />
          </div>
          <h2 className="text-lg sm:text-xl font-semibold text-white mb-2">
            {selectedSiteId === "all" ? "No bots uploaded yet" : "No bots for this site"}
          </h2>
          <p className="text-muted-foreground text-center max-w-md text-sm sm:text-base">
            {selectedSiteId === "all" 
              ? "Complete the setup for your domains to upload XML trading bots"
              : "This site doesn't have any XML bots configured yet"
            }
          </p>
        </div>
      )}
    </div>
  );
};

export default XMLBots;
