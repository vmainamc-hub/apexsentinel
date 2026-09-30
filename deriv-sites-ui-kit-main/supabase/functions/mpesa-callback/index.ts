import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as hexEncode } from "https://deno.land/std@0.190.0/encoding/hex.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-lipana-signature',
};

interface NormalizedCallback {
  transactionId: string;
  status: 'completed' | 'failed' | 'cancelled';
  mpesaReceiptNumber?: string;
  resultCode?: number;
  resultDesc?: string;
  amount?: number;
  phone?: string;
}

function normalizeCallbackPayload(payload: unknown): NormalizedCallback | null {
  if (!payload) return null;

  // Some providers wrap the real payload in a string field.
  if (typeof payload === 'string') {
    try {
      return normalizeCallbackPayload(JSON.parse(payload));
    } catch {
      return null;
    }
  }

  if (typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;

  // If payload is wrapped inside "payload" or "data" as a string/object, unwrap it.
  if (p.payload !== undefined) {
    const normalized = normalizeCallbackPayload(p.payload);
    if (normalized) return normalized;
  }

  // Lipana can send either camelCase OR snake_case payloads.
  // Examples:
  //  - { transactionId, status, mpesaReceiptNumber, ... }
  //  - { event: 'transaction.success', transaction_id, amount, phone, reference, timestamp }
  //  - { transaction: { id }, event: ... }

  const txObj = (p.transaction && typeof p.transaction === 'object') ? (p.transaction as Record<string, unknown>) : null;
  const dataObj = (p.data && typeof p.data === 'object') ? (p.data as Record<string, unknown>) : null;

  const messageText = typeof p.message === 'string' ? (p.message as string) : '';
  const messageTxnMatch = messageText.match(/(TXN[0-9A-Z]+)/i);
  const messageTxn = messageTxnMatch ? messageTxnMatch[1] : null;

  const transactionId =
    (typeof p.transactionId === 'string' && p.transactionId) ||
    (typeof p.transaction_id === 'string' && (p.transaction_id as string)) ||
    (typeof p.transactionID === 'string' && (p.transactionID as string)) ||
    (typeof p.transaction === 'string' && (p.transaction as string)) ||
    (txObj && typeof txObj.id === 'string' && (txObj.id as string)) ||
    (txObj && typeof txObj.transaction_id === 'string' && (txObj.transaction_id as string)) ||
    (dataObj && typeof dataObj.transactionId === 'string' && (dataObj.transactionId as string)) ||
    (dataObj && typeof dataObj.transaction_id === 'string' && (dataObj.transaction_id as string)) ||
    (dataObj && typeof dataObj.id === 'string' && (dataObj.id as string)) ||
    messageTxn ||
    '';

  const rawStatus =
    (typeof p.status === 'string' && (p.status as string)) ||
    (typeof p.event === 'string' && (p.event as string)) ||
    (txObj && typeof txObj.status === 'string' && (txObj.status as string)) ||
    (dataObj && typeof dataObj.status === 'string' && (dataObj.status as string)) ||
    '';

  const status: NormalizedCallback['status'] | null = (() => {
    if (!rawStatus) return null;
    if (rawStatus === 'completed' || rawStatus === 'failed' || rawStatus === 'cancelled') return rawStatus;
    if (rawStatus === 'transaction.success') return 'completed';
    if (rawStatus === 'transaction.failed') return 'failed';
    if (rawStatus === 'transaction.cancelled') return 'cancelled';
    if (rawStatus === 'success') return 'completed';
    if (rawStatus === 'failure') return 'failed';
    return null;
  })();

  if (!transactionId || !status) return null;

  const mpesaReceiptNumber =
    (typeof p.mpesaReceiptNumber === 'string' && (p.mpesaReceiptNumber as string)) ||
    (typeof p.mpesa_receipt_number === 'string' && (p.mpesa_receipt_number as string)) ||
    (dataObj && typeof dataObj.mpesaReceiptNumber === 'string' && (dataObj.mpesaReceiptNumber as string)) ||
    (dataObj && typeof dataObj.mpesa_receipt_number === 'string' && (dataObj.mpesa_receipt_number as string)) ||
    undefined;

  const resultCode =
    (typeof p.resultCode === 'number' && (p.resultCode as number)) ||
    (typeof p.result_code === 'number' && (p.result_code as number)) ||
    (dataObj && typeof dataObj.resultCode === 'number' && (dataObj.resultCode as number)) ||
    (dataObj && typeof dataObj.result_code === 'number' && (dataObj.result_code as number)) ||
    undefined;

  const resultDesc =
    (typeof p.resultDesc === 'string' && (p.resultDesc as string)) ||
    (typeof p.result_desc === 'string' && (p.result_desc as string)) ||
    (typeof p.message === 'string' && (p.message as string)) ||
    (dataObj && typeof dataObj.resultDesc === 'string' && (dataObj.resultDesc as string)) ||
    (dataObj && typeof dataObj.result_desc === 'string' && (dataObj.result_desc as string)) ||
    (dataObj && typeof dataObj.message === 'string' && (dataObj.message as string)) ||
    undefined;

  const amount =
    (typeof p.amount === 'number' && (p.amount as number)) ||
    (txObj && typeof txObj.amount === 'number' && (txObj.amount as number)) ||
    (dataObj && typeof dataObj.amount === 'number' && (dataObj.amount as number)) ||
    undefined;

  const phone =
    (typeof p.phone === 'string' && (p.phone as string)) ||
    (typeof p.msisdn === 'string' && (p.msisdn as string)) ||
    (txObj && typeof txObj.phone === 'string' && (txObj.phone as string)) ||
    (dataObj && typeof dataObj.phone === 'string' && (dataObj.phone as string)) ||
    undefined;

  return {
    transactionId,
    status,
    mpesaReceiptNumber,
    resultCode,
    resultDesc,
    amount,
    phone,
  };
}

// Verify Lipana webhook signature using HMAC-SHA256
async function verifyWebhookSignature(payload: string, signature: string, secret: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const payloadData = encoder.encode(payload);

    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign('HMAC', key, payloadData);
    const expectedSignature = new TextDecoder().decode(hexEncode(new Uint8Array(signatureBuffer)));

    // Constant-time comparison to prevent timing attacks
    if (signature.length !== expectedSignature.length) return false;
    let result = 0;
    for (let i = 0; i < signature.length; i++) {
      result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
    }
    return result === 0;
  } catch (_error) {
    console.error('Signature verification error');
    return false;
  }
}

// Generate a tracking number for the purchase
function generateTrackingNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `DOM-${timestamp}-${random}`;
}

// Send email notification for successful purchase
async function sendPurchaseEmail(
  supabaseUrl: string,
  email: string,
  domainName: string,
  amount: number,
  mpesaReceiptNumber: string,
  trackingNumber: string,
  paymentDate: string
): Promise<void> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/send-purchase-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
      },
      body: JSON.stringify({
        email,
        domain_name: domainName,
        amount,
        mpesa_receipt_number: mpesaReceiptNumber,
        tracking_number: trackingNumber,
        payment_date: paymentDate,
      }),
    });

    if (!response.ok) {
      console.error('Failed to send email');
    }
  } catch (error) {
    console.error('Error sending purchase email');
  }
}

// Send email notification for failed purchase
async function sendFailureEmail(
  supabaseUrl: string,
  email: string,
  domainName: string,
  failureReason: string
): Promise<void> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/send-purchase-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
      },
      body: JSON.stringify({
        email,
        domain_name: domainName,
        failure_reason: failureReason,
        is_failure: true,
      }),
    });

    if (!response.ok) {
      console.error('Failed to send failure email');
    }
  } catch (error) {
    console.error('Error sending failure email');
  }
}

const handler = async (req: Request): Promise<Response> => {
  const startTime = Date.now();
  const requestId = crypto.randomUUID().slice(0, 8);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Helper for structured logging
  const log = (level: 'INFO' | 'WARN' | 'ERROR', message: string, data?: Record<string, unknown>) => {
    const logEntry = {
      timestamp: new Date().toISOString(),
      requestId,
      level,
      message,
      ...data,
    };
    if (level === 'ERROR') {
      console.error(JSON.stringify(logEntry));
    } else if (level === 'WARN') {
      console.warn(JSON.stringify(logEntry));
    } else {
      console.log(JSON.stringify(logEntry));
    }
  };

  try {
    log('INFO', 'Callback received');
    
    // Get raw body for signature verification
    const rawBody = await req.text();
    
    // SECURITY: Verify webhook signature
    const signature = req.headers.get('x-lipana-signature') || req.headers.get('X-Lipana-Signature');
    const webhookSecret = Deno.env.get('LIPANA_WEBHOOK_SECRET');
    
    if (!webhookSecret) {
      log('ERROR', 'REJECTED: Webhook secret not configured', { reason: 'missing_config' });
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
    
    if (!signature) {
      log('WARN', 'REJECTED: Missing signature header', { reason: 'missing_signature' });
      return new Response(
        JSON.stringify({ error: 'Missing signature' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
    
    const isValidSignature = await verifyWebhookSignature(rawBody, signature, webhookSecret);
    if (!isValidSignature) {
      log('WARN', 'REJECTED: Invalid signature', { reason: 'invalid_signature' });
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
    
    log('INFO', 'Signature verified');
    
    // Parse the verified payload
    const rawPayload = JSON.parse(rawBody);

    // Normalize payload formats (camelCase + snake_case)
    const callback = normalizeCallbackPayload(rawPayload);
    if (!callback) {
      const payloadRecord = rawPayload && typeof rawPayload === 'object'
        ? rawPayload as Record<string, unknown>
        : {};
      const nestedData = payloadRecord.data && typeof payloadRecord.data === 'object'
        ? payloadRecord.data as Record<string, unknown>
        : null;
      const keys = Object.keys(payloadRecord);
      const dataKeys = nestedData
        ? Object.keys(nestedData)
        : [];

      const message = typeof payloadRecord.message === 'string' ? payloadRecord.message : '';
      const event = typeof payloadRecord.event === 'string' ? payloadRecord.event : '';

      // Lipana “Send Test Webhook” appears to send only { event, message, timestamp } (no transaction id).
      // That should still return 200 so Lipana marks the delivery as successful.
      if (event && !message.includes('TXN')) {
        log('INFO', 'Webhook ping received (no transaction id)', { event, messagePreview: message.slice(0, 160) });
        return new Response(
          JSON.stringify({ success: true, message: 'Webhook received (no transaction id)' }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      log('WARN', 'REJECTED: Invalid payload structure', {
        reason: 'invalid_payload',
        keys,
        dataKeys,
        hasEvent: !!event,
        hasStatus: typeof payloadRecord.status === 'string',
        hasTransactionId: typeof payloadRecord.transactionId === 'string',
        hasTransaction_id: typeof payloadRecord.transaction_id === 'string',
        hasPayload: payloadRecord.payload !== undefined,
        event,
        messagePreview: message.slice(0, 160),
      });

      return new Response(
        JSON.stringify({ error: 'Invalid payload structure' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    log('INFO', 'Processing callback', { transactionId: callback.transactionId, status: callback.status });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find the purchase by lipana_transaction_id
    const { data: purchase, error: findError } = await supabase
      .from('domain_purchases')
      .select('*')
      .eq('lipana_transaction_id', callback.transactionId)
      .maybeSingle();

    if (findError) {
      log('ERROR', 'REJECTED: Database error finding purchase', { reason: 'db_error' });
      return new Response(
        JSON.stringify({ error: 'Failed to find purchase' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (!purchase) {
      log('WARN', 'REJECTED: Purchase not found', { reason: 'not_found', transactionId: callback.transactionId });
      return new Response(
        JSON.stringify({ error: 'Purchase not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // SECURITY: Idempotency check - only process if status is 'pending' or 'processing'
    if (!['pending', 'processing'].includes(purchase.status)) {
      log('INFO', 'SKIPPED: Already processed', { reason: 'idempotency', purchaseId: purchase.id, existingStatus: purchase.status });
      return new Response(
        JSON.stringify({ success: true, message: 'Already processed' }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // SECURITY: Timestamp validation - reject callbacks for purchases older than 30 minutes
    const purchaseCreatedAt = new Date(purchase.created_at);
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    if (purchaseCreatedAt < thirtyMinutesAgo) {
      log('WARN', 'REJECTED: Transaction expired', { reason: 'expired', purchaseId: purchase.id, createdAt: purchase.created_at });
      return new Response(
        JSON.stringify({ error: 'Transaction expired' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // SECURITY: Amount validation for completed transactions
    if (callback.status === 'completed' && callback.amount !== undefined) {
      if (callback.amount !== purchase.amount) {
        log('WARN', 'REJECTED: Amount mismatch', { reason: 'amount_mismatch', expected: purchase.amount, received: callback.amount });
        return new Response(
          JSON.stringify({ error: 'Amount mismatch' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
    }

    // Update the purchase status
    const updateData: Record<string, unknown> = {
      status: callback.status,
    };

    // Map result codes to failure reasons
    let failureReason = '';
    if (callback.status === 'failed' || callback.status === 'cancelled') {
      if (callback.resultCode === 1032 || callback.resultDesc?.toLowerCase().includes('cancel')) {
        failureReason = 'Transaction cancelled by user';
      } else if (callback.resultCode === 1 || callback.resultDesc?.toLowerCase().includes('insufficient')) {
        failureReason = 'Insufficient funds in M-Pesa account';
      } else if (callback.resultCode === 2001 || callback.resultDesc?.toLowerCase().includes('wrong pin')) {
        failureReason = 'Wrong M-Pesa PIN entered';
      } else if (callback.resultDesc?.toLowerCase().includes('timeout') || callback.resultDesc?.toLowerCase().includes('timed out')) {
        failureReason = 'PIN not entered - request timed out';
      } else {
        failureReason = 'Payment was not completed';
      }
      updateData.failure_reason = failureReason;
    }

    const paymentDate = new Date().toISOString();
    const trackingNumber = generateTrackingNumber();

    if (callback.status === 'completed') {
      // Some providers may delay sending the receipt number even when status is marked completed.
      // We still mark the purchase as completed so the UI can proceed, but only save the receipt if present.
      if (!callback.mpesaReceiptNumber) {
        log('WARN', 'Completed callback missing receipt number (accepting)', {
          reason: 'missing_receipt',
          purchaseId: purchase.id,
          transactionId: callback.transactionId,
        });
      } else {
        updateData.mpesa_receipt_number = callback.mpesaReceiptNumber;
      }

      updateData.payment_date = paymentDate;
      updateData.tracking_number = trackingNumber;
    }

    const { error: updateError } = await supabase
      .from('domain_purchases')
      .update(updateData)
      .eq('id', purchase.id)
      .eq('status', purchase.status); // Optimistic locking

    if (updateError) {
      log('ERROR', 'REJECTED: Database update failed', { reason: 'db_update_error', purchaseId: purchase.id });
      return new Response(
        JSON.stringify({ error: 'Failed to update purchase' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // If this completed purchase is the one-time setup fee,
    // create (or refresh) a user_subscriptions row so the dashboard can
    // show ownership + 12-month expiry countdown.
    if (
      callback.status === 'completed' &&
      purchase.user_id &&
      purchase.domain_name === 'derivsites-ownership-fee'
    ) {
      try {
        const { data: existingSub } = await supabase
          .from('user_subscriptions')
          .select('id')
          .eq('user_id', purchase.user_id)
          .eq('plan_type', 'onetime')
          .eq('status', 'active')
          .maybeSingle();

        const startDate = new Date();
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 12);

        if (existingSub) {
          // Extend existing active subscription by another 12 months from now (renewal)
          const { error: subUpdateError } = await supabase
            .from('user_subscriptions')
            .update({
              start_date: startDate.toISOString(),
              end_date: endDate.toISOString(),
              payment_id: purchase.id,
            })
            .eq('id', existingSub.id);
          if (subUpdateError) {
            log('ERROR', 'Failed to refresh existing subscription', { reason: 'sub_update_error', purchaseId: purchase.id });
          } else {
            log('INFO', 'Subscription refreshed for 12 months', { userId: purchase.user_id, subscriptionId: existingSub.id });
          }
        } else {
          const { error: subInsertError } = await supabase
            .from('user_subscriptions')
            .insert({
              user_id: purchase.user_id,
              plan_type: 'onetime',
              status: 'active',
              start_date: startDate.toISOString(),
              end_date: endDate.toISOString(),
              payment_id: purchase.id,
            });
          if (subInsertError) {
            log('ERROR', 'Failed to create user subscription', { reason: 'sub_insert_error', purchaseId: purchase.id });
          } else {
            log('INFO', 'One-time setup subscription created (12 months)', { userId: purchase.user_id });
          }
        }
      } catch (subErr) {
        log('ERROR', 'Exception while creating subscription', { reason: 'sub_exception' });
      }
    }

    const duration = Date.now() - startTime;
    log('INFO', 'SUCCESS: Callback processed', { 
      purchaseId: purchase.id, 
      domain: purchase.domain_name,
      status: callback.status, 
      duration: `${duration}ms`,
      trackingNumber: callback.status === 'completed' ? trackingNumber : undefined 
    });

    // Send email notification
    if (purchase.email) {
      if (callback.status === 'completed') {
        await sendPurchaseEmail(
          supabaseUrl,
          purchase.email,
          purchase.domain_name,
          purchase.amount,
          callback.mpesaReceiptNumber || '',
          trackingNumber,
          paymentDate
        );
      } else if (callback.status === 'failed' || callback.status === 'cancelled') {
        await sendFailureEmail(
          supabaseUrl,
          purchase.email,
          purchase.domain_name,
          failureReason
        );
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Callback processed successfully' }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      requestId,
      level: 'ERROR',
      message: 'REJECTED: Unhandled exception',
      reason: 'exception',
      duration: `${duration}ms`,
    }));
    return new Response(
      JSON.stringify({ error: 'An error occurred' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
};

serve(handler);
