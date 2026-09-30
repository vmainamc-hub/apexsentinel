import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const stkPushSchema = z.object({
  phone: z.string().min(10).max(15),
  amount: z.number().min(1).max(100000),
  domain: z.string().min(1).max(255),
  email: z.string().email().max(255).optional(),
  accountReference: z.string().max(50).optional(),
});

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header");
      return new Response(
        JSON.stringify({ error: "Unauthorized - please log in" }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Create client with user's token to get their ID
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify the user
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized - invalid session" }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const body = await req.json();
    
    // Validate input
    const validationResult = stkPushSchema.safeParse(body);
    if (!validationResult.success) {
      console.error('Validation error:', validationResult.error);
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: validationResult.error.errors }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const { phone, amount, domain, email, accountReference } = validationResult.data;

    console.log(`User ${user.id} initiating STK push for domain: ${domain}, phone: ${phone}, amount: ${amount}`);

    // Format phone number (ensure it starts with +254)
    let formattedPhone = phone.replace(/\s+/g, '').replace(/-/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '+254' + formattedPhone.substring(1);
    } else if (formattedPhone.startsWith('254')) {
      formattedPhone = '+' + formattedPhone;
    } else if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+254' + formattedPhone;
    }

    console.log(`Formatted phone: ${formattedPhone}`);

    const LIPANA_SECRET_KEY = Deno.env.get('LIPANA_SECRET_KEY');
    if (!LIPANA_SECRET_KEY) {
      console.error('LIPANA_SECRET_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Payment service not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Initialize Supabase admin client
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate a unique transaction ID
    const transactionId = `TXN${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Create the domain purchase record with user_id
    const { data: purchaseData, error: insertError } = await supabase
      .from('domain_purchases')
      .insert({
        domain_name: domain,
        phone_number: formattedPhone,
        amount: amount,
        transaction_id: transactionId,
        status: 'pending',
        email: email || null,
        user_id: user.id, // Link to authenticated user
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating purchase record:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create purchase record' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    console.log('Created purchase record:', purchaseData.id);

    // Call Lipana API to initiate STK push
    const response = await fetch('https://api.lipana.dev/v1/transactions/push-stk', {
      method: 'POST',
      headers: {
        'x-api-key': LIPANA_SECRET_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: formattedPhone,
        amount: Math.round(amount),
        accountReference: accountReference || domain,
        transactionDesc: `Domain purchase: ${domain}`,
      }),
    });

    const data = await response.json();
    console.log('Lipana response:', JSON.stringify(data));

    if (!response.ok) {
      console.error('Lipana API error:', data);
      // Update purchase status to failed
      await supabase
        .from('domain_purchases')
        .update({ status: 'failed' })
        .eq('id', purchaseData.id);

      return new Response(
        JSON.stringify({ error: data.message || 'Failed to initiate payment' }),
        { status: response.status, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Update purchase with Lipana transaction ID
    const lipanaTransactionId = data.data?.transactionId || data.transactionId || data.id;
    await supabase
      .from('domain_purchases')
      .update({ 
        lipana_transaction_id: lipanaTransactionId,
        status: 'processing'
      })
      .eq('id', purchaseData.id);

    console.log('STK push initiated successfully:', lipanaTransactionId);

    return new Response(
      JSON.stringify({
        success: true,
        purchaseId: purchaseData.id,
        transactionId: transactionId,
        lipanaTransactionId: lipanaTransactionId,
        message: 'STK push sent. Please enter your M-Pesa PIN on your phone.',
        data,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An error occurred';
    console.error('Error in mpesa-stk-push function:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
};

serve(handler);
