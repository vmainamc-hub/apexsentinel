import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PaymentStatus {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  mpesa_receipt_number: string | null;
  domain_name: string;
  failure_reason: string | null;
  tracking_number: string | null;
}

export const usePaymentPolling = (
  purchaseId: string | null,
  onSuccess?: (purchase: PaymentStatus) => void,
  onFailure?: (purchase: PaymentStatus) => void
) => {
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const checkStatus = useCallback(async (): Promise<PaymentStatus | null> => {
    if (!purchaseId) return null;

    try {
      // Direct query instead of edge function for faster response
      const { data, error } = await supabase
        .from('domain_purchases')
        .select('id, status, mpesa_receipt_number, domain_name, failure_reason, tracking_number')
        .eq('id', purchaseId)
        .single();

      if (error) {
        console.error('Error checking payment status:', error);
        return null;
      }

      return data as PaymentStatus;
    } catch (err) {
      console.error('Error checking payment status:', err);
      return null;
    }
  }, [purchaseId]);

  useEffect(() => {
    if (!purchaseId) {
      setIsPolling(false);
      return;
    }

    setIsPolling(true);
    let attempts = 0;

    // 30 seconds total (poll every 2s => 15 attempts)
    const maxAttempts = 15;
    const TIMEOUT_SECONDS = 30;

    const timeoutFailureReason = 'PIN not entered - payment request timed out after 30 seconds';

    const markTimedOut = async () => {
      try {
        const { data: updated, error: updateError } = await supabase
          .from('domain_purchases')
          .update({
            status: 'failed',
            failure_reason: timeoutFailureReason,
          })
          .eq('id', purchaseId)
          .select('id, status, mpesa_receipt_number, domain_name, failure_reason, tracking_number')
          .single();

        if (updateError) {
          console.error('Error marking purchase as timed out:', updateError);
          toast.error('Payment is taking too long. Please refresh and check Pending Payments.');
          return;
        }

        const typed = updated as PaymentStatus;
        setStatus(typed);
        toast.error(`Payment failed: ${typed.failure_reason || timeoutFailureReason}`);
        onFailure?.(typed);
      } catch (err) {
        console.error('Error marking purchase as timed out:', err);
        toast.error('Payment is taking too long. Please refresh and check Pending Payments.');
      }
    };

    const poll = async () => {
      attempts++;
      const data = await checkStatus();

      if (data) {
        setStatus(data);

        if (data.status === 'completed') {
          setIsPolling(false);
          clearInterval(intervalId);
          clearTimeout(timeoutId);
          toast.success(`Payment successful! Domain ${data.domain_name} is now yours.`);
          onSuccess?.(data);
          return;
        } else if (data.status === 'failed' || data.status === 'cancelled') {
          setIsPolling(false);
          clearInterval(intervalId);
          clearTimeout(timeoutId);
          const reason = data.failure_reason || 'Payment was not completed';
          toast.error(`Payment failed: ${reason}`);
          onFailure?.(data);
          return;
        }
      }

      // After 30 seconds, mark as failed
      if (attempts >= maxAttempts) {
        setIsPolling(false);
        clearInterval(intervalId);
        clearTimeout(timeoutId);
        await markTimedOut();
      }
    };

    // Poll every 2 seconds
    const intervalId = setInterval(poll, 2000);

    // Absolute timeout as a safety net
    const timeoutId = setTimeout(() => {
      setIsPolling(false);
      clearInterval(intervalId);
      markTimedOut();
    }, TIMEOUT_SECONDS * 1000);

    // Run the initial check after timer handles exist so a terminal response can
    // safely clear both timers.
    void poll();

    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, [purchaseId, checkStatus, onSuccess, onFailure, status]);

  return { status, isPolling };
};
