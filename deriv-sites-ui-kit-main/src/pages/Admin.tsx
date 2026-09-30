import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Shield, Globe, CheckCircle2, Clock, RefreshCw, ExternalLink, Bot, Key, Download, FileCode, ChevronDown, ChevronUp, MessageSquare, Send, Trash2, Plus, MinusCircle, Sparkles, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import AdminMarkupStats from "@/components/AdminMarkupStats";
interface XmlBot {
  id: string;
  file_name: string;
  file_path: string;
  display_order: number;
}

interface Site {
  id: string;
  name: string;
  status: string;
  deriv_affiliate_id: string | null;
  pending_reason: string | null;
  deleted_bot_name: string | null;
  created_at: string;
  user_id: string;
  domain_purchases: {
    domain_name: string;
  } | null;
  profiles: {
    email: string;
    display_name: string | null;
  } | null;
  xml_bots: XmlBot[];
}

interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  status: string;
  created_at: string;
  updated_at: string;
  profiles?: {
    email: string;
    display_name: string | null;
  };
}

interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_type: string;
  message: string;
  created_at: string;
}

const Admin = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, role, canManageSites, canSupport, canViewFinance, loading: adminLoading } = useAdminRole();
  const queryClient = useQueryClient();
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [expandedSites, setExpandedSites] = useState<Set<string>>(new Set());
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [replyMessage, setReplyMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: sites, isLoading, refetch } = useQuery({
    queryKey: ['admin-sites'],
    queryFn: async () => {
      // First fetch sites with domain and xml_bots
      const { data: sitesData, error: sitesError } = await supabase
        .from('sites')
        .select(`
          *,
          domain_purchases(domain_name),
          xml_bots(id, file_name, file_path, display_order)
        `)
        .order('created_at', { ascending: false });

      if (sitesError) throw sitesError;
      if (!sitesData) return [];

      // Fetch profiles for all unique user_ids
      const userIds = [...new Set(sitesData.map(s => s.user_id))];
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, display_name')
        .in('id', userIds);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
      }

      // Map profiles to sites
      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
      
      return sitesData.map(site => ({
        ...site,
        profiles: profilesMap.get(site.user_id) || null,
      })) as unknown as Site[];
    },
    enabled: canManageSites,
  });

  // Fetch support tickets
  const { data: tickets, isLoading: ticketsLoading, refetch: refetchTickets } = useQuery({
    queryKey: ['admin-support-tickets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_tickets')
        .select(`
          *,
          profiles:user_id(email, display_name)
        `)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data as unknown as SupportTicket[];
    },
    enabled: canSupport,
  });

  // Fetch messages for selected ticket
  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ['admin-support-messages', selectedTicket?.id],
    queryFn: async () => {
      if (!selectedTicket) return [];
      const { data, error } = await supabase
        .from('support_messages')
        .select('*')
        .eq('ticket_id', selectedTicket.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as SupportMessage[];
    },
    enabled: canSupport && !!selectedTicket?.id,
  });

  // Real-time subscription for sites
  useEffect(() => {
    if (!canManageSites) return;

    const channel = supabase
      .channel('admin-sites-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sites',
        },
        (payload) => {
          console.log('Site change detected:', payload);
          queryClient.invalidateQueries({ queryKey: ['admin-sites'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [canManageSites, queryClient]);

  // Real-time subscription for new tickets
  useEffect(() => {
    if (!canSupport) return;

    const channel = supabase
      .channel('admin-tickets')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'support_tickets',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['admin-support-tickets'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [canSupport, queryClient]);

  // Real-time subscription for messages on selected ticket
  useEffect(() => {
    if (!canSupport || !selectedTicket?.id) return;

    const channel = supabase
      .channel(`admin-ticket-${selectedTicket.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
          filter: `ticket_id=eq.${selectedTicket.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['admin-support-messages', selectedTicket.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [canSupport, selectedTicket?.id, queryClient]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send admin reply
  const sendReplyMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('support_messages')
        .insert({
          ticket_id: selectedTicket?.id,
          sender_id: user?.id,
          sender_type: 'admin',
          message: replyMessage.trim(),
        });

      if (error) throw error;
    },
    onSuccess: () => {
      setReplyMessage('');
      queryClient.invalidateQueries({ queryKey: ['admin-support-messages', selectedTicket?.id] });
      toast.success('Reply sent!');
    },
    onError: (err) => {
      console.error('Error sending reply:', err);
      toast.error('Failed to send reply');
    },
  });

  // Update ticket status
  const updateTicketStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const { error } = await supabase
        .from('support_tickets')
        .update({ status: newStatus })
        .eq('id', selectedTicket?.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-support-tickets'] });
      if (selectedTicket) {
        setSelectedTicket({ ...selectedTicket, status: selectedTicket.status === 'active' ? 'resolved' : 'active' });
      }
      toast.success('Ticket status updated!');
    },
    onError: (err) => {
      console.error('Error updating ticket:', err);
      toast.error('Failed to update ticket status');
    },
  });

  // Delete ticket
  const deleteTicketMutation = useMutation({
    mutationFn: async (ticketId: string) => {
      const { error } = await supabase
        .from('support_tickets')
        .delete()
        .eq('id', ticketId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-support-tickets'] });
      setSelectedTicket(null);
      toast.success('Ticket deleted!');
    },
    onError: (err) => {
      console.error('Error deleting ticket:', err);
      toast.error('Failed to delete ticket');
    },
  });

  // Delete message
  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase
        .from('support_messages')
        .delete()
        .eq('id', messageId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-support-messages', selectedTicket?.id] });
      toast.success('Message deleted!');
    },
    onError: (err) => {
      console.error('Error deleting message:', err);
      toast.error('Failed to delete message');
    },
  });

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyMessage.trim() || !selectedTicket) return;
    sendReplyMutation.mutate();
  };

  const toggleExpanded = (siteId: string) => {
    setExpandedSites(prev => {
      const next = new Set(prev);
      if (next.has(siteId)) {
        next.delete(siteId);
      } else {
        next.add(siteId);
      }
      return next;
    });
  };

  const handleDownloadBot = async (bot: XmlBot) => {
    setDownloadingFile(bot.id);
    try {
      const { data, error } = await supabase.storage
        .from('xml-bots')
        .download(bot.file_path);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = bot.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Downloaded ${bot.file_name}`);
    } catch (err) {
      console.error('Error downloading file:', err);
      toast.error('Failed to download file');
    } finally {
      setDownloadingFile(null);
    }
  };

  const handleActivate = async (site: Site) => {
    setActivatingId(site.id);
    try {
      // Update site status to active
      const { error } = await supabase
        .from('sites')
        .update({ status: 'active' })
        .eq('id', site.id);

      if (error) throw error;

      // Send email notification to site owner
      if (site.profiles?.email && site.domain_purchases?.domain_name) {
        try {
          const { error: emailError } = await supabase.functions.invoke('send-site-live-email', {
            body: {
              email: site.profiles.email,
              siteName: site.name,
              domainName: site.domain_purchases.domain_name,
            }
          });

          if (emailError) {
            console.error('Email error:', emailError);
            toast.warning('Site activated but email notification failed');
          } else {
            toast.success('Site marked as live! Owner notified via email.');
          }
        } catch (emailErr) {
          console.error('Error sending email:', emailErr);
          toast.warning('Site activated but email notification failed');
        }
      } else {
        toast.success('Site marked as live!');
      }

      refetch();
      queryClient.invalidateQueries({ queryKey: ['sites'] });
    } catch (err) {
      console.error('Error activating site:', err);
      toast.error('Failed to activate site');
    } finally {
      setActivatingId(null);
    }
  };

  if (adminLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <p className="text-muted-foreground">Checking permissions...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-xl font-semibold text-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-4">You don't have permission to access this page.</p>
          <Button onClick={() => navigate('/dashboard')} variant="outline">
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const pendingSites = sites?.filter(s => s.status === 'pending' || s.status === 'draft') || [];
  const setupSites = sites?.filter(s => s.status === 'setup') || [];
  const activeSites = sites?.filter(s => s.status === 'active') || [];
  const draftSites = sites?.filter(s => s.status === 'draft') || [];
  const activeTickets = tickets?.filter(t => t.status === 'active') || [];
  const resolvedTickets = tickets?.filter(t => t.status === 'resolved') || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 rounded-full text-xs bg-amber-500/20 text-amber-400">Pending</span>;
      case 'draft':
        return <span className="px-2 py-1 rounded-full text-xs bg-purple-500/20 text-purple-400">Draft</span>;
      case 'setup':
        return <span className="px-2 py-1 rounded-full text-xs bg-blue-500/20 text-blue-400">In Setup</span>;
      case 'active':
        return <span className="px-2 py-1 rounded-full text-xs bg-green-500/20 text-green-400">Live</span>;
      default:
        return <span className="px-2 py-1 rounded-full text-xs bg-white/10 text-muted-foreground">{status}</span>;
    }
  };

  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Admin Panel</h1>
            <p className="text-muted-foreground text-sm">Role: {role?.replace(/_/g, " ")}</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue={canManageSites ? "sites" : canSupport ? "support" : "finance"} className="space-y-4">
        <TabsList className="bg-white/5 border border-white/10">
          {canManageSites && <TabsTrigger value="sites" className="data-[state=active]:bg-white/10">
            <Globe className="w-4 h-4 mr-2" />
            Sites
          </TabsTrigger>}
          {canSupport && <TabsTrigger value="support" className="data-[state=active]:bg-white/10">
            <MessageSquare className="w-4 h-4 mr-2" />
            Support
            {activeTickets.length > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-amber-500/20 text-amber-400">
                {activeTickets.length}
              </span>
            )}
          </TabsTrigger>}
          {canViewFinance && <TabsTrigger value="finance" className="data-[state=active]:bg-white/10">
            Markup
          </TabsTrigger>}
        </TabsList>

        {/* Sites Tab */}
        {canManageSites && <TabsContent value="sites" className="space-y-6">
          <div className="flex justify-end">
            <Button onClick={() => refetch()} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>

          {/* Site Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-amber-400" />
                <span className="text-sm text-muted-foreground">Pending</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{pendingSites.length}</p>
            </div>
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <div className="flex items-center gap-2 mb-1">
                <Globe className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-muted-foreground">In Setup</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{setupSites.length}</p>
            </div>
            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                <span className="text-sm text-muted-foreground">Live</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{activeSites.length}</p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-6">
              {pendingSites.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-400" />
                    Sites Pending Deployment ({pendingSites.length})
                  </h2>
                  <div className="space-y-3">
                    {pendingSites.map((site) => (
                      <SiteCard 
                        key={site.id} 
                        site={site} 
                        getStatusBadge={getStatusBadge}
                        onActivate={() => handleActivate(site)}
                        isActivating={activatingId === site.id}
                        isExpanded={expandedSites.has(site.id)}
                        onToggleExpand={() => toggleExpanded(site.id)}
                        onDownloadBot={handleDownloadBot}
                        downloadingFile={downloadingFile}
                      />
                    ))}
                  </div>
                </div>
              )}

              {setupSites.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Globe className="w-5 h-5 text-blue-400" />
                    Sites In Setup ({setupSites.length})
                  </h2>
                  <div className="space-y-3">
                    {setupSites.map((site) => (
                      <SiteCard 
                        key={site.id} 
                        site={site} 
                        getStatusBadge={getStatusBadge}
                        onActivate={() => handleActivate(site)}
                        isActivating={activatingId === site.id}
                        isExpanded={expandedSites.has(site.id)}
                        onToggleExpand={() => toggleExpanded(site.id)}
                        onDownloadBot={handleDownloadBot}
                        downloadingFile={downloadingFile}
                      />
                    ))}
                  </div>
                </div>
              )}

              {activeSites.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                    Live Sites ({activeSites.length})
                  </h2>
                  <div className="space-y-3">
                    {activeSites.map((site) => (
                      <SiteCard 
                        key={site.id} 
                        site={site} 
                        getStatusBadge={getStatusBadge}
                        onActivate={() => handleActivate(site)}
                        isActivating={activatingId === site.id}
                        isLive
                        isExpanded={expandedSites.has(site.id)}
                        onToggleExpand={() => toggleExpanded(site.id)}
                        onDownloadBot={handleDownloadBot}
                        downloadingFile={downloadingFile}
                      />
                    ))}
                  </div>
                </div>
              )}

              {sites?.length === 0 && (
                <div className="text-center py-12">
                  <Globe className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No sites found</p>
                </div>
              )}
            </div>
          )}
        </TabsContent>}

        {/* Support Tab */}
        {canSupport && <TabsContent value="support" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => refetchTickets()} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-amber-400" />
                <span className="text-sm text-muted-foreground">Active Tickets</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{activeTickets.length}</p>
            </div>
            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                <span className="text-sm text-muted-foreground">Resolved</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{resolvedTickets.length}</p>
            </div>
          </div>

          <div className="flex gap-4 h-[500px] rounded-xl bg-panel-bg border border-white/10 overflow-hidden">
            {/* Tickets List */}
            <div className="w-80 border-r border-white/10 flex flex-col">
              <div className="p-3 border-b border-white/10">
                <h3 className="font-semibold text-foreground">Support Tickets</h3>
              </div>
              <div className="flex-1 overflow-y-auto">
                {ticketsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  </div>
                ) : tickets?.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No tickets yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/10">
                    {tickets?.map((ticket) => (
                      <div
                        key={ticket.id}
                        className={`p-3 hover:bg-white/5 transition-colors cursor-pointer ${
                          selectedTicket?.id === ticket.id ? 'bg-white/10' : ''
                        }`}
                        onClick={() => setSelectedTicket(ticket)}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <span className="font-medium text-foreground truncate text-sm">{ticket.subject}</span>
                          <div className="flex items-center gap-1">
                            {ticket.status === 'active' ? (
                              <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-xs bg-amber-500/20 text-amber-400">Active</span>
                            ) : (
                              <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-400">Resolved</span>
                            )}
                            {ticket.status === 'resolved' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm('Delete this ticket and all its messages?')) {
                                    deleteTicketMutation.mutate(ticket.id);
                                  }
                                }}
                                className="p-1 hover:bg-red-500/20 rounded text-red-400 opacity-50 hover:opacity-100 transition-opacity"
                                title="Delete ticket"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{ticket.profiles?.email}</p>
                        <span className="text-xs text-muted-foreground">
                          {new Date(ticket.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 flex flex-col">
              {selectedTicket ? (
                <>
                  {/* Chat Header */}
                  <div className="p-3 border-b border-white/10 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground">{selectedTicket.subject}</h3>
                      <p className="text-xs text-muted-foreground">{selectedTicket.profiles?.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateTicketStatusMutation.mutate(selectedTicket.status === 'active' ? 'resolved' : 'active')}
                        disabled={updateTicketStatusMutation.isPending}
                      >
                        {selectedTicket.status === 'active' ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 mr-1 text-green-400" />
                            Mark Resolved
                          </>
                        ) : (
                          <>
                            <Clock className="w-4 h-4 mr-1 text-amber-400" />
                            Reopen
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (confirm('Delete this ticket and all its messages?')) {
                            deleteTicketMutation.mutate(selectedTicket.id);
                          }
                        }}
                        disabled={deleteTicketMutation.isPending}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {messagesLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                      </div>
                    ) : (
                      <>
                        {messages?.map((msg) => (
                          <div
                            key={msg.id}
                            className={`flex group ${msg.sender_type === 'admin' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div className={`flex items-start gap-1 ${msg.sender_type === 'admin' ? 'flex-row-reverse' : ''}`}>
                              <div
                                className={`max-w-[80%] rounded-xl px-4 py-2 ${
                                  msg.sender_type === 'admin'
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-white/10 text-foreground'
                                }`}
                              >
                                <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                                <span className={`text-xs mt-1 block ${
                                  msg.sender_type === 'admin' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                                }`}>
                                  {msg.sender_type === 'user' && <span className="font-medium">User • </span>}
                                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <button
                                onClick={() => deleteMessageMutation.mutate(msg.id)}
                                className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded text-red-400 transition-opacity"
                                title="Delete message"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                        <div ref={messagesEndRef} />
                      </>
                    )}
                  </div>

                  {/* Reply Input */}
                  <form onSubmit={handleSendReply} className="p-3 border-t border-white/10">
                    <div className="flex gap-2">
                      <Input
                        value={replyMessage}
                        onChange={(e) => setReplyMessage(e.target.value)}
                        placeholder="Type your reply..."
                        className="flex-1"
                      />
                      <Button 
                        type="submit" 
                        className="btn-primary"
                        disabled={!replyMessage.trim() || sendReplyMutation.isPending}
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Select a ticket to view messages</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>}

        {canViewFinance && <TabsContent value="finance" className="space-y-4">
          <AdminMarkupStats enabled={canViewFinance} />
        </TabsContent>}
      </Tabs>
    </div>
  );
};

interface SiteCardProps {
  site: Site;
  getStatusBadge: (status: string) => JSX.Element;
  onActivate: () => void;
  isActivating: boolean;
  isLive?: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onDownloadBot: (bot: XmlBot) => void;
  downloadingFile: string | null;
}

const SiteCard = ({ site, getStatusBadge, onActivate, isActivating, isLive, isExpanded, onToggleExpand, onDownloadBot, downloadingFile }: SiteCardProps) => {
  const sortedBots = [...(site.xml_bots || [])].sort((a, b) => a.display_order - b.display_order);

  return (
    <div className="rounded-xl bg-panel-bg border border-white/10 overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-foreground truncate">{site.name}</h3>
              {getStatusBadge(site.status)}
              {site.status === 'pending' && (
                <PendingReasonBadge reason={site.pending_reason || 'new_site'} deletedBotName={site.deleted_bot_name} />
              )}
            </div>
            
            <div className="space-y-1 text-sm">
              {site.domain_purchases?.domain_name && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Globe className="w-3.5 h-3.5" />
                  <span>{site.domain_purchases.domain_name}</span>
                </div>
              )}
              
              {site.deriv_affiliate_id && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Key className="w-3.5 h-3.5" />
                  <span>App ID: {site.deriv_affiliate_id}</span>
                </div>
              )}
              
              <button 
                onClick={onToggleExpand}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Bot className="w-3.5 h-3.5" />
                <span>{sortedBots.length} XML bots</span>
                {sortedBots.length > 0 && (
                  isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>

              {site.profiles && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="text-xs">Owner: {site.profiles.email}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to={`/sites/${site.id}/wizard`}>
                <Settings className="w-4 h-4 mr-1" />
                Config
              </Link>
            </Button>
            {!isLive && site.status === 'pending' && (
              <Button
                onClick={onActivate}
                disabled={isActivating}
                className="btn-primary"
                size="sm"
              >
                {isActivating ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Mark Live
                  </>
                )}
              </Button>
            )}
            
            {isLive && site.domain_purchases?.domain_name && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`https://${site.domain_purchases?.domain_name}`, '_blank')}
              >
                <ExternalLink className="w-4 h-4 mr-1" />
                Visit
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* XML Bots Section */}
      {isExpanded && sortedBots.length > 0 && (
        <div className="border-t border-white/10 p-4 bg-white/5">
          <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wide">XML Bot Files (in order)</p>
          <div className="space-y-2">
            {sortedBots.map((bot, index) => (
              <div key={bot.id} className="flex items-center justify-between p-3 rounded-lg bg-panel-bg border border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded bg-purple-500/20 flex items-center justify-center">
                    <span className="text-xs font-bold text-purple-400">{index + 1}</span>
                  </div>
                  <FileCode className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-foreground">{bot.file_name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDownloadBot(bot)}
                  disabled={downloadingFile === bot.id}
                  className="text-primary hover:text-primary"
                >
                  {downloadingFile === bot.id ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-1" />
                      Download
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Pending reason badge component
const PendingReasonBadge = ({ reason, deletedBotName }: { reason: string; deletedBotName: string | null }) => {
  switch (reason) {
    case 'new_site':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30">
          <Sparkles className="w-3 h-3" />
          New Site
        </span>
      );
    case 'bot_added':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-400 border border-green-500/30">
          <Plus className="w-3 h-3" />
          Bot Added
        </span>
      );
    case 'bot_deleted':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-500/20 text-red-400 border border-red-500/30">
          <MinusCircle className="w-3 h-3" />
          Deleted: {deletedBotName || 'Unknown'}
        </span>
      );
    default:
      return null;
  }
};

export default Admin;
