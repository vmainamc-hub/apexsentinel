import { useState, useEffect } from "react";
import { Code, Globe, TrendingUp, DollarSign, Users, ExternalLink, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface ApiPlatform {
  id: string;
  domain_name: string;
  platform_name: string;
  commission_rate: number;
  ownership_price: number;
  developer_commission_rate: number;
  developer_ownership_fee: number;
  status: string;
  created_at: string;
}

interface PlatformSale {
  id: string;
  platform_id: string;
  customer_email: string;
  sale_type: string;
  sale_amount: number;
  developer_cut: number;
  owner_earnings: number;
  status: string;
  created_at: string;
}

const ApiPlatforms = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [platforms, setPlatforms] = useState<ApiPlatform[]>([]);
  const [sales, setSales] = useState<PlatformSale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchPlatforms();
    }
  }, [user]);

  useEffect(() => {
    if (selectedPlatform) {
      fetchSales(selectedPlatform);
    }
  }, [selectedPlatform]);

  const fetchPlatforms = async () => {
    try {
      const { data, error } = await supabase
        .from('api_platforms')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Type assertion since the table is new
      const typedData = data as unknown as ApiPlatform[];
      setPlatforms(typedData || []);
      if (typedData && typedData.length > 0) {
        setSelectedPlatform(typedData[0].id);
      }
    } catch (err) {
      console.error('Error fetching platforms:', err);
      toast.error('Failed to load platforms');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSales = async (platformId: string) => {
    try {
      const { data, error } = await supabase
        .from('api_platform_sales')
        .select('*')
        .eq('platform_id', platformId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Type assertion since the table is new
      setSales((data as unknown as PlatformSale[]) || []);
    } catch (err) {
      console.error('Error fetching sales:', err);
    }
  };

  const currentPlatform = platforms.find(p => p.id === selectedPlatform);
  
  // Calculate stats
  const totalSales = sales.length;
  const totalRevenue = sales.reduce((sum, s) => sum + s.owner_earnings, 0);
  const commissionSales = sales.filter(s => s.sale_type === 'commission').length;
  const oneTimeSales = sales.filter(s => s.sale_type === 'ownership' || s.sale_type === 'one_time').length;

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading platforms...</p>
        </div>
      </div>
    );
  }

  if (platforms.length === 0) {
    return (
      <div className="flex-1 flex flex-col">
        <header className="py-4 sm:py-6 px-4 sm:px-6 lg:px-8">
          <h1 className="text-lg sm:text-2xl font-semibold text-foreground">API Platforms</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Manage your white-label platforms</p>
        </header>

        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 rounded-2xl bg-blue-500/20 flex items-center justify-center mx-auto mb-6">
              <Code className="w-8 h-8 text-blue-400" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">No API Platforms Yet</h2>
            <p className="text-muted-foreground mb-6">
              Create your first white-label platform to start offering DerivSites under your own brand and pricing.
            </p>
            <Button onClick={() => navigate('/')} className="btn-primary">
              <Plus className="w-4 h-4 mr-2" />
              Create Platform
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <header className="py-4 sm:py-6 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg sm:text-2xl font-semibold text-foreground">API Platforms</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Manage your white-label platforms</p>
          </div>
          <Button onClick={() => navigate('/')} variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            New Platform
          </Button>
        </div>
      </header>

      <div className="flex-1 px-4 sm:px-6 lg:px-8 pb-8 space-y-6">
        {/* Platform Selector */}
        {platforms.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            {platforms.map(platform => (
              <button
                key={platform.id}
                onClick={() => setSelectedPlatform(platform.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedPlatform === platform.id
                    ? 'bg-primary text-foreground'
                    : 'bg-panel-bg border border-white/10 text-muted-foreground hover:text-foreground'
                }`}
              >
                {platform.platform_name}
              </button>
            ))}
          </div>
        )}

        {currentPlatform && (
          <>
            {/* Platform Info */}
            <div className="p-4 sm:p-6 rounded-xl bg-panel-bg border border-white/10">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <Globe className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">{currentPlatform.platform_name}</h2>
                    <p className="text-sm text-muted-foreground">{currentPlatform.domain_name}</p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  currentPlatform.status === 'active' 
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-amber-500/20 text-amber-400'
                }`}>
                  {currentPlatform.status}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-3 rounded-lg bg-white/5">
                  <p className="text-xs text-muted-foreground mb-1">Commission Rate</p>
                  <p className="text-lg font-bold text-foreground">{currentPlatform.commission_rate}%</p>
                  <p className="text-xs text-green-400">You keep {currentPlatform.commission_rate - 8}%</p>
                </div>
                <div className="p-3 rounded-lg bg-white/5">
                  <p className="text-xs text-muted-foreground mb-1">One-time Price</p>
                  <p className="text-lg font-bold text-foreground">KES {currentPlatform.ownership_price.toLocaleString()}</p>
                  <p className="text-xs text-green-400">You keep {(currentPlatform.ownership_price - 5000).toLocaleString()}</p>
                </div>
                <div className="p-3 rounded-lg bg-white/5">
                  <p className="text-xs text-muted-foreground mb-1">Dev Commission</p>
                  <p className="text-lg font-bold text-foreground">{currentPlatform.developer_commission_rate}%</p>
                </div>
                <div className="p-3 rounded-lg bg-white/5">
                  <p className="text-xs text-muted-foreground mb-1">Dev One-time Fee</p>
                  <p className="text-lg font-bold text-foreground">KES {currentPlatform.developer_ownership_fee.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-panel-bg border border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <Users className="w-4 h-4 text-blue-400" />
                  </div>
                  <span className="text-xs text-muted-foreground">Total Sales</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{totalSales}</p>
              </div>

              <div className="p-4 rounded-xl bg-panel-bg border border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <DollarSign className="w-4 h-4 text-green-400" />
                  </div>
                  <span className="text-xs text-muted-foreground">Your Earnings</span>
                </div>
                <p className="text-2xl font-bold text-foreground">KES {totalRevenue.toLocaleString()}</p>
              </div>

              <div className="p-4 rounded-xl bg-panel-bg border border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-amber-400" />
                  </div>
                  <span className="text-xs text-muted-foreground">Commission Sales</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{commissionSales}</p>
              </div>

              <div className="p-4 rounded-xl bg-panel-bg border border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <ExternalLink className="w-4 h-4 text-purple-400" />
                  </div>
                  <span className="text-xs text-muted-foreground">One-time Sales</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{oneTimeSales}</p>
              </div>
            </div>

            {/* Sales Table */}
            <div className="rounded-xl bg-panel-bg border border-white/10 overflow-hidden">
              <div className="p-4 border-b border-white/10">
                <h3 className="font-semibold text-foreground">Recent Sales</h3>
              </div>
              
              {sales.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-muted-foreground">No sales recorded yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Customer</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Amount</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Your Cut</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sales.map(sale => (
                        <tr key={sale.id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="px-4 py-3 text-sm text-foreground">{sale.customer_email}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs ${
                              sale.sale_type === 'commission'
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-green-500/20 text-green-400'
                            }`}>
                              {sale.sale_type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-foreground">KES {sale.sale_amount.toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm text-green-400">KES {sale.owner_earnings.toLocaleString()}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs ${
                              sale.status === 'completed'
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-amber-500/20 text-amber-400'
                            }`}>
                              {sale.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {new Date(sale.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ApiPlatforms;
