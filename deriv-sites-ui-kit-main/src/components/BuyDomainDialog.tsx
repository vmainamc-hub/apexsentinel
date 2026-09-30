import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Check, X, ShoppingCart, Globe, Loader2, Phone, ArrowLeft, CheckCircle2, XCircle, Trash2, Mail, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePaymentPolling } from "@/hooks/usePaymentPolling";
import { useAuth } from "@/contexts/AuthContext";

interface DomainResult {
  domain: string;
  available: boolean;
  price?: string;
  premium?: boolean;
}

interface BuyDomainDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type DialogView = 'search' | 'payment' | 'processing' | 'success' | 'failed';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const BuyDomainDialog = ({ open, onOpenChange }: BuyDomainDialogProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<DomainResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  
  // Payment state
  const [view, setView] = useState<DialogView>('search');
  const [selectedDomain, setSelectedDomain] = useState<DomainResult | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [currentPurchaseId, setCurrentPurchaseId] = useState<string | null>(null);
  const [failureReason, setFailureReason] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(30);
  const [createdSiteId, setCreatedSiteId] = useState<string | null>(null);

  const handlePaymentSuccess = useCallback(async () => {
    setView('success');
    setCurrentPurchaseId(null);
    
    // Create site record for the purchased domain
    if (user && selectedDomain) {
      try {
        // Get the domain purchase ID
        const { data: purchaseData } = await supabase
          .from('domain_purchases')
          .select('id')
          .eq('domain_name', selectedDomain.domain)
          .eq('user_id', user.id)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

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

        // Create a tenant-owned site and its runtime domain record.
        const { data: siteData, error: siteError } = await db
          .from('sites')
          .insert({
            user_id: user.id,
            organisation_id: organisationId,
            name: selectedDomain.domain.split('.')[0],
            domain_id: purchaseData?.id || null,
            status: 'setup',
          })
          .select()
          .single();

        if (siteError) {
          console.error('Error creating site:', siteError);
        } else if (siteData) {
          const { error: domainError } = await db.from('site_domains').insert({ site_id: siteData.id, hostname: selectedDomain.domain.toLowerCase(), is_primary: true, status: 'pending', is_verified: false });
          if (domainError) throw domainError;
          setCreatedSiteId(siteData.id);
        }
      } catch (err) {
        console.error('Error in payment success handler:', err);
      }
    }
  }, [user, selectedDomain]);

  const handlePaymentFailure = useCallback((purchase: { failure_reason: string | null }) => {
    setFailureReason(purchase.failure_reason || 'Payment was not completed');
    setView('failed');
    setCurrentPurchaseId(null);
  }, []);

  const { isPolling } = usePaymentPolling(
    currentPurchaseId,
    handlePaymentSuccess,
    handlePaymentFailure
  );

  // Countdown timer for processing view
  useEffect(() => {
    if (view !== 'processing') return;

    setCountdown(30);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [view]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setHasSearched(true);

    try {
      const { data, error } = await supabase.functions.invoke('check-domain', {
        body: { domainName: searchQuery.trim() }
      });

      if (error) {
        console.error('Error checking domain:', error);
        toast.error('Failed to check domain availability');
        setResults([]);
        return;
      }

      if (data.error) {
        console.error('API error:', data.error);
        toast.error(data.error);
        setResults([]);
        return;
      }

      setResults(data.results || []);
    } catch (err) {
      console.error('Error:', err);
      toast.error('Failed to check domain availability');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleBuy = (result: DomainResult) => {
    setSelectedDomain(result);
    setView('payment');
  };

  const handleBack = () => {
    if (view === 'processing') return; // Don't allow back during processing
    setView('search');
    setSelectedDomain(null);
    setPhoneNumber("");
    setCurrentPurchaseId(null);
  };

  const parsePrice = (priceStr: string): number => {
    const match = priceStr.match(/[\d.]+/);
    if (match) {
      const usdPrice = parseFloat(match[0]);
      return Math.round(usdPrice * 150);
    }
    return 1500;
  };

  const validateEmail = (emailValue: string): boolean => {
    if (!emailValue.trim()) {
      setEmailError('Email address is required');
      return false;
    }
    if (!emailRegex.test(emailValue.trim())) {
      setEmailError('Please enter a valid email address');
      return false;
    }
    if (emailValue.length > 255) {
      setEmailError('Email must be less than 255 characters');
      return false;
    }
    setEmailError(null);
    return true;
  };

  const handlePayment = async () => {
    if (!phoneNumber.trim() || !selectedDomain) {
      toast.error('Please enter your M-Pesa phone number');
      return;
    }

    const cleanPhone = phoneNumber.replace(/\s+/g, '').replace(/-/g, '');
    if (!/^(\+?254|0)?[17]\d{8}$/.test(cleanPhone)) {
      toast.error('Please enter a valid Kenyan phone number');
      return;
    }

    if (!validateEmail(email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setIsProcessingPayment(true);

    try {
      const amount = parsePrice(selectedDomain.price || '$15.00');
      
      const { data, error } = await supabase.functions.invoke('mpesa-stk-push', {
        body: {
          phone: phoneNumber.trim(),
          amount,
          domain: selectedDomain.domain,
          email: email.trim() || undefined,
        }
      });

      if (error) {
        console.error('Payment error:', error);
        toast.error('Failed to initiate payment');
        return;
      }

      if (data.error) {
        console.error('Payment API error:', data.error);
        toast.error(data.error);
        return;
      }

      toast.success('STK push sent! Please enter your M-Pesa PIN on your phone.');
      
      // Set the purchase ID to start polling
      setCurrentPurchaseId(data.purchaseId);
      setView('processing');

    } catch (err) {
      console.error('Error:', err);
      toast.error('Failed to process payment');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const resetDialog = () => {
    setView('search');
    setSelectedDomain(null);
    setPhoneNumber("");
    setEmail("");
    setEmailError(null);
    setCurrentPurchaseId(null);
    setSearchQuery("");
    setResults([]);
    setHasSearched(false);
    setFailureReason(null);
    setCountdown(30);
  };

  const handleClose = () => {
    if (view === 'processing' && isPolling) {
      toast.info('Payment is being processed. You can close this dialog - you\'ll be notified when complete.');
    }
    resetDialog();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) handleClose();
      else onOpenChange(isOpen);
    }}>
      <DialogContent className="max-w-[95vw] sm:max-w-[600px] bg-panel-bg border-white/10 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            {(view === 'payment' || view === 'processing' || view === 'failed') && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBack}
                disabled={view === 'processing'}
                className="h-8 w-8 mr-1"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            <div className="w-10 h-10 rounded-full gradient-purple flex items-center justify-center">
              {view === 'search' ? (
                <Globe className="w-5 h-5 text-foreground" />
              ) : view === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-green-400" />
              ) : view === 'failed' ? (
                <XCircle className="w-5 h-5 text-red-400" />
              ) : (
                <Phone className="w-5 h-5 text-foreground" />
              )}
            </div>
            {view === 'search' && 'Find Your Perfect Domain'}
            {view === 'payment' && 'Complete Payment'}
            {view === 'processing' && 'Processing Payment'}
            {view === 'success' && 'Payment Successful!'}
            {view === 'failed' && 'Payment Failed'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {view === 'search' 
              ? 'Search for available domain names and purchase them'
              : view === 'success'
              ? 'Your domain purchase was successful'
              : view === 'failed'
              ? 'Your payment was not completed'
              : 'Enter your M-Pesa phone number to complete the purchase'
            }
          </DialogDescription>
        </DialogHeader>

        {view === 'search' && (
          <>
            {/* Search Input */}
            <div className="mt-4">
              <div className="relative flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Enter domain name (e.g., derivsites)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="pl-10 bg-sidebar-bg border-white/10 focus:border-primary/50 h-11"
                  />
                </div>
                <Button
                  onClick={handleSearch}
                  disabled={isSearching || !searchQuery.trim()}
                  className="btn-primary px-6"
                >
                  {isSearching ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Search"
                  )}
                </Button>
              </div>
            </div>

            {/* Results */}
            <div className="mt-4 sm:mt-6 space-y-3 max-h-[300px] sm:max-h-[400px] overflow-y-auto">
              {isSearching ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
                  <p className="text-muted-foreground">Checking availability...</p>
                </div>
              ) : hasSearched && results.length > 0 ? (
                results.map((result) => (
                  <div
                    key={result.domain}
                    className={`p-3 sm:p-4 rounded-xl border transition-all ${
                      result.available
                        ? "bg-green-500/5 border-green-500/20 hover:border-green-500/40"
                        : "bg-red-500/5 border-red-500/20"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                            result.available ? "bg-green-500/20" : "bg-red-500/20"
                          }`}
                        >
                          {result.available ? (
                            <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-400" />
                          ) : (
                            <X className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground text-sm sm:text-base truncate">
                            {result.domain}
                          </p>
                          {result.available ? (
                            <p className="text-xs sm:text-sm text-green-400">
                              {result.premium ? 'Premium' : 'Available'}
                            </p>
                          ) : (
                            <p className="text-xs sm:text-sm text-red-400">Taken</p>
                          )}
                        </div>
                      </div>

                      {result.available ? (
                        <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 ml-10 sm:ml-0">
                          <div className="text-left sm:text-right">
                            <p className="text-base sm:text-lg font-semibold text-foreground">
                              {result.price}
                            </p>
                            <p className="text-xs text-muted-foreground">/ year</p>
                          </div>
                          <Button
                            onClick={() => handleBuy(result)}
                            className="btn-primary flex items-center gap-2 text-sm"
                          >
                            <ShoppingCart className="w-4 h-4" />
                            Buy
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs sm:text-sm text-muted-foreground px-3 py-1.5 rounded-lg bg-white/5 ml-10 sm:ml-0 self-start sm:self-auto">
                          Taken
                        </span>
                      )}
                    </div>
                  </div>
                ))
              ) : hasSearched ? (
                <div className="text-center py-8 text-muted-foreground">
                  No results found. Try a different domain name.
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Search className="w-7 h-7 text-primary" />
                  </div>
                  <p className="text-muted-foreground">
                    Enter a domain name to check availability
                  </p>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    We'll show you pricing and alternatives
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        {view === 'payment' && (
          <div className="mt-4 space-y-6">
            {selectedDomain && (
              <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Domain</p>
                    <p className="text-lg font-semibold text-foreground">{selectedDomain.domain}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Price</p>
                    <p className="text-lg font-semibold text-foreground">{selectedDomain.price}</p>
                    <p className="text-xs text-muted-foreground">
                      ≈ KES {parsePrice(selectedDomain.price || '$15.00').toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Phone className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Pay with M-Pesa</p>
                  <p className="text-sm text-muted-foreground">
                    You'll receive an STK push on your phone
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Email Address <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailError) validateEmail(e.target.value);
                    }}
                    onBlur={() => validateEmail(email)}
                    className={`pl-10 bg-sidebar-bg border-white/10 focus:border-primary/50 h-12 ${emailError ? 'border-red-500' : ''}`}
                    type="email"
                  />
                </div>
                {emailError ? (
                  <p className="text-xs text-red-400">{emailError}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    We'll send your receipt and tracking number here
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  M-Pesa Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="0712 345 678"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="pl-10 bg-sidebar-bg border-white/10 focus:border-primary/50 h-12 text-lg"
                    type="tel"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Enter the phone number registered with M-Pesa
                </p>
              </div>

              <Button
                onClick={handlePayment}
                disabled={isProcessingPayment || !phoneNumber.trim()}
                className="w-full btn-primary h-12 text-base"
              >
                {isProcessingPayment ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Sending STK Push...
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-5 h-5 mr-2" />
                    Pay Now
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                By clicking "Pay Now", you agree to our terms of service.
                An M-Pesa prompt will be sent to your phone.
              </p>
            </div>
          </div>
        )}

        {view === 'processing' && (
          <div className="mt-4 space-y-6">
            {selectedDomain && (
              <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Domain</p>
                    <p className="text-lg font-semibold text-foreground">{selectedDomain.domain}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Price</p>
                    <p className="text-lg font-semibold text-foreground">{selectedDomain.price}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col items-center justify-center py-8">
              <div className="relative mb-6">
                <Loader2 className="w-16 h-16 text-primary animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm font-bold text-primary">{countdown}s</span>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Waiting for Payment Confirmation
              </h3>
              <p className="text-muted-foreground text-center max-w-sm">
                Please enter your M-Pesa PIN on your phone within {countdown} seconds.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <p className="text-sm text-amber-200 text-center">
                Don't close this window. Payment will fail if PIN is not entered in time.
              </p>
            </div>
          </div>
        )}

{view === 'success' && (
          <div className="mt-4 space-y-6">
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mb-6">
                <CheckCircle2 className="w-10 h-10 text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Payment Successful!
              </h3>
              <p className="text-muted-foreground text-center max-w-sm mb-2">
                Congratulations! You now own <span className="text-foreground font-medium">{selectedDomain?.domain}</span>
              </p>
              <p className="text-sm text-muted-foreground text-center">
                Now let's set up your Deriv trading site.
              </p>
            </div>

            <Button
              onClick={() => {
                if (createdSiteId && selectedDomain) {
                  resetDialog();
                  onOpenChange(false);
                  navigate(`/sites/${createdSiteId}/wizard`);
                } else {
                  handleClose();
                }
              }}
              className="w-full btn-primary h-12 text-base"
            >
              Continue Setup
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {view === 'failed' && (
          <div className="mt-4 space-y-6">
            {selectedDomain && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Domain</p>
                    <p className="text-lg font-semibold text-foreground">{selectedDomain.domain}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p className="text-lg font-semibold text-red-400">Failed</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mb-6">
                <XCircle className="w-10 h-10 text-red-400" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Payment Failed
              </h3>
              <p className="text-muted-foreground text-center max-w-sm mb-4">
                {failureReason || 'Payment was not completed'}
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setView('payment');
                  setFailureReason(null);
                }}
                className="flex-1 btn-primary h-12 text-base"
              >
                Try Again
              </Button>
              <Button
                variant="outline"
                onClick={handleClose}
                className="flex-1 h-12 text-base border-white/10 hover:bg-white/5"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BuyDomainDialog;
