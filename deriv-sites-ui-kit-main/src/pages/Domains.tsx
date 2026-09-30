import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Globe, ShoppingCart, Settings, Check, Clock, XCircle, ExternalLink, Trash2, MessageCircle, ArrowRight } from "lucide-react";
import BuyDomainDialog from "@/components/BuyDomainDialog";
import { useDomainPurchases } from "@/hooks/useDomainPurchases";
import { useDashboard } from "@/hooks/useDashboard";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const Domains = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isBuyDialogOpen, setIsBuyDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'purchased' | 'configuration'>('purchased');
  const { completedPurchases, pendingPurchases, failedPurchases, loading, deletePurchase } = useDomainPurchases();
  const { sites } = useDashboard();
  const configuredSites = sites.filter(site => site.status !== 'deleted');

  // Helper to check if domain has a site and its status
  const getDomainSiteStatus = (purchaseId: string) => {
    const site = sites.find(s => s.domain_id === purchaseId);
    return site ? { exists: true, site } : { exists: false, site: null };
  };

  const handleCompleteSetup = async (purchaseId: string, domainName: string) => {
    // Check if site exists for this domain
    const { exists, site } = getDomainSiteStatus(purchaseId);
    
    if (exists && site) {
      navigate(`/sites/${site.id}/wizard`);
    } else {
      // Create a new site and navigate to setup
      if (!user) {
        toast.error('Please log in to continue');
        return;
      }

      try {
        // Generated database types are refreshed only after the migration is applied.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = supabase as any;
        const { data: memberships, error: membershipError } = await db.from('organisation_members').select('organisation_id').eq('user_id', user.id).eq('status', 'active').in('role', ['tenant_owner', 'tenant_developer']).limit(1);
        if (membershipError) throw membershipError;
        let organisationId = memberships?.[0]?.organisation_id;
        if (!organisationId) {
          const created = await db.rpc('create_personal_organisation', { _name: `${user.email?.split('@')[0] || 'My'} sites` });
          if (created.error) throw created.error;
          organisationId = created.data;
        }
        const { data: newSite, error } = await db
          .from('sites')
          .insert({
            user_id: user.id,
            organisation_id: organisationId,
            domain_id: purchaseId,
            name: domainName,
            status: 'draft'
          })
          .select()
          .single();

        if (error) throw error;
        
        navigate(`/sites/${newSite.id}/wizard`);
      } catch (err) {
        console.error('Error creating site:', err);
        toast.error('Failed to start setup');
      }
    }
  };

  const handleDeletePending = async (purchaseId: string, domainName: string) => {
    const confirmed = window.confirm(`Are you sure you want to delete the pending payment for ${domainName}?`);
    if (confirmed) {
      await deletePurchase(purchaseId);
      toast.success(`Pending payment for ${domainName} deleted`);
    }
  };

  const handleOpenTicket = (domainName: string) => {
    navigate(`/support?subject=Payment Issue: ${encodeURIComponent(domainName)}`);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <Check className="w-4 h-4 text-green-400" />;
      case 'pending':
      case 'processing':
        return <Clock className="w-4 h-4 text-amber-400" />;
      case 'failed':
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-red-400" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-400 bg-green-500/10';
      case 'pending':
      case 'processing':
        return 'text-amber-400 bg-amber-500/10';
      case 'failed':
      case 'cancelled':
        return 'text-red-400 bg-red-500/10';
      default:
        return 'text-muted-foreground bg-muted/10';
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 py-4 sm:py-6 px-4 sm:px-6 lg:px-8">
        <div>
          <h1 className="text-lg sm:text-2xl font-semibold text-foreground">Domains</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Manage purchased domains and configure site domains
          </p>
        </div>

        <button 
          onClick={() => setIsBuyDialogOpen(true)}
          className="btn-primary flex items-center justify-center gap-2 group w-full sm:w-auto"
        >
          <ShoppingCart className="w-4 h-4" />
          <span>Buy Domain</span>
        </button>
      </header>

      {/* Tabs */}
      <div className="px-4 sm:px-6 lg:px-8 pb-4 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          <button 
            onClick={() => setActiveTab('purchased')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === 'purchased' 
                ? 'bg-primary/20 text-foreground border border-primary/30' 
                : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Purchased ({completedPurchases.length})</span>
          </button>
          <button 
            onClick={() => setActiveTab('configuration')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === 'configuration' 
                ? 'bg-primary/20 text-foreground border border-primary/30' 
                : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Configuration ({configuredSites.length})</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 sm:px-6 lg:px-8 pb-8">
        {loading ? (
          <div className="dashed-border rounded-2xl panel-bg min-h-[400px] flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              <p className="text-muted-foreground">Loading domains...</p>
            </div>
          </div>
        ) : activeTab === 'purchased' ? (
          completedPurchases.length > 0 || pendingPurchases.length > 0 || failedPurchases.length > 0 ? (
            <div className="space-y-4">
              {/* Failed Purchases */}
              {failedPurchases.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs sm:text-sm font-medium text-muted-foreground">
                    Failed Payments ({failedPurchases.length})
                  </h3>
                  {failedPurchases.map((purchase) => (
                    <div
                      key={purchase.id}
                      className="p-3 sm:p-4 rounded-xl border border-red-500/20 bg-red-500/5"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
                        <div className="flex items-center gap-3 sm:gap-4">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                            <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground text-sm sm:text-base truncate">{purchase.domain_name}</p>
                            <p className="text-xs sm:text-sm text-red-400 truncate">
                              {purchase.failure_reason || 'Payment failed'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3 ml-11 sm:ml-0">
                          <span className={`px-2 sm:px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(purchase.status)}`}>
                            Failed
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deletePurchase(purchase.id)}
                            className="h-7 w-7 sm:h-8 sm:w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          >
                            <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pending Purchases */}
              {pendingPurchases.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs sm:text-sm font-medium text-muted-foreground">
                    Pending Payments ({pendingPurchases.length})
                  </h3>
                  {pendingPurchases.map((purchase) => (
                    <div
                      key={purchase.id}
                      className="p-3 sm:p-4 rounded-xl border border-amber-500/20 bg-amber-500/5"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
                        <div className="flex items-center gap-3 sm:gap-4">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                            <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground text-sm sm:text-base truncate">{purchase.domain_name}</p>
                            <p className="text-xs sm:text-sm text-muted-foreground">
                              Waiting for payment confirmation
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3 ml-11 sm:ml-0">
                          <span className={`px-2 sm:px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(purchase.status)}`}>
                            {purchase.status.charAt(0).toUpperCase() + purchase.status.slice(1)}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenTicket(purchase.domain_name)}
                            className="h-7 w-7 sm:h-8 sm:w-8 text-primary hover:text-primary/80 hover:bg-primary/10"
                            title="Open Support Ticket"
                          >
                            <MessageCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeletePending(purchase.id, purchase.domain_name)}
                            className="h-7 w-7 sm:h-8 sm:w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            title="Delete Pending Payment"
                          >
                            <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Completed Purchases */}
              {completedPurchases.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs sm:text-sm font-medium text-muted-foreground">
                    Your Domains ({completedPurchases.length})
                  </h3>
                  {completedPurchases.map((purchase) => {
                    const { exists, site } = getDomainSiteStatus(purchase.id);
                    const siteStatus = site?.status || 'not_configured';
                    const needsSetup = !exists || siteStatus === 'draft';
                    const isPending = siteStatus === 'pending';
                    const isActive = siteStatus === 'active';

                    return (
                      <div
                        key={purchase.id}
                        className="p-3 sm:p-4 rounded-xl border border-white/10 bg-panel-bg hover:border-primary/30 transition-colors"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
                          <div className="flex items-center gap-3 sm:gap-4">
                            <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                              isActive ? 'bg-green-500/20' : isPending ? 'bg-amber-500/20' : 'gradient-purple'
                            }`}>
                              <Globe className={`w-4 h-4 sm:w-5 sm:h-5 ${
                                isActive ? 'text-green-400' : isPending ? 'text-amber-400' : 'text-foreground'
                              }`} />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-foreground text-sm sm:text-base truncate">{purchase.domain_name}</p>
                              <p className="text-xs sm:text-sm text-muted-foreground">
                                {needsSetup 
                                  ? 'Setup required' 
                                  : isPending 
                                    ? 'Deployment in progress (10 min - 1 hour)'
                                    : `Purchased ${purchase.payment_date 
                                        ? format(new Date(purchase.payment_date), 'MMM d, yyyy')
                                        : format(new Date(purchase.created_at), 'MMM d, yyyy')
                                      }`
                                }
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 sm:gap-3 ml-11 sm:ml-0">
                            {needsSetup ? (
                              <Button
                                onClick={() => handleCompleteSetup(purchase.id, purchase.domain_name)}
                                className="btn-primary h-8 px-3 text-xs sm:text-sm"
                              >
                                Complete Setup
                                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                              </Button>
                            ) : isPending ? (
                              <span className="px-2 sm:px-3 py-1 rounded-full text-xs font-medium text-amber-400 bg-amber-500/10">
                                <Clock className="w-3 h-3 inline mr-1" />
                                Pending
                              </span>
                            ) : (
                              <>
                                <span className="px-2 sm:px-3 py-1 rounded-full text-xs font-medium text-green-400 bg-green-500/10">
                                  <Check className="w-3 h-3 inline mr-1" />
                                  Active
                                </span>
                                <a 
                                  href={`https://${purchase.domain_name}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="p-1.5 sm:p-2 rounded-lg hover:bg-white/5 transition-colors"
                                >
                                  <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
                                </a>
                              </>
                            )}
                          </div>
                        </div>
                        {purchase.mpesa_receipt_number && (
                          <div className="mt-3 pt-3 border-t border-white/5 ml-11 sm:ml-0">
                            <p className="text-xs text-muted-foreground">
                              M-Pesa Receipt: <span className="text-foreground">{purchase.mpesa_receipt_number}</span>
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="dashed-border rounded-2xl panel-bg min-h-[300px] sm:min-h-[400px] flex flex-col items-center justify-center p-6 sm:p-12">
              <div className="relative mb-6">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full gradient-purple flex items-center justify-center glow-purple-subtle">
                  <Globe className="w-6 h-6 sm:w-8 sm:h-8 text-foreground" />
                </div>
                <div className="absolute inset-0 -m-2 rounded-full border border-primary/30 animate-pulse" />
                <div className="absolute inset-0 -m-4 rounded-full border border-primary/20" />
              </div>

              <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-2 text-center">
                No domains yet
              </h2>

              <p className="text-muted-foreground text-center max-w-md mb-6 text-sm sm:text-base">
                Purchase your first domain to get started
              </p>

              <button 
                onClick={() => setIsBuyDialogOpen(true)}
                className="btn-primary flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 group text-sm sm:text-base"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>Buy Your First Domain</span>
              </button>
            </div>
          )
        ) : (
          configuredSites.length > 0 ? (
            <div className="space-y-3">
              {configuredSites.map(site => (
                <div
                  key={site.id}
                  className="p-4 rounded-xl border border-white/10 bg-panel-bg hover:border-primary/30 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">{site.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {site.domain_purchases?.domain_name || "No linked purchased domain yet"}
                      </p>
                    </div>
                    <Button
                      onClick={() => navigate(`/sites/${site.id}/wizard`)}
                      className="btn-primary h-9 px-4 text-sm"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Manage Config
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="dashed-border rounded-2xl panel-bg min-h-[300px] sm:min-h-[400px] flex flex-col items-center justify-center p-6 sm:p-12">
              <div className="relative mb-6">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full gradient-purple flex items-center justify-center glow-purple-subtle">
                  <Settings className="w-6 h-6 sm:w-8 sm:h-8 text-foreground" />
                </div>
              </div>

              <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-2 text-center">
                No domain configurations
              </h2>

              <p className="text-muted-foreground text-center max-w-md text-sm sm:text-base">
                Domain configurations will appear here once you configure domains for your sites
              </p>
            </div>
          )
        )}
      </div>

      <BuyDomainDialog 
        open={isBuyDialogOpen} 
        onOpenChange={setIsBuyDialogOpen} 
      />
    </div>
  );
};

export default Domains;
