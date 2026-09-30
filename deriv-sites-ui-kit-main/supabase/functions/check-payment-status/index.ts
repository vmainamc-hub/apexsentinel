import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StatusRequest {
  purchaseId: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create a client with the user's token to get their identity
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader }
        }
      }
    );

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { purchaseId }: StatusRequest = await req.json();

    if (!purchaseId) {
      return new Response(
        JSON.stringify({ error: "Purchase ID is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Checking payment status for purchase: ${purchaseId}, user: ${user.id}`);

    // Use service role to query, but verify ownership
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data, error } = await supabaseAdmin
      .from("domain_purchases")
      .select("id, status, mpesa_receipt_number, domain_name, failure_reason, tracking_number, user_id")
      .eq("id", purchaseId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching payment status:", error);
      return new Response(
        JSON.stringify({ error: "Failed to check payment status" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!data) {
      return new Response(
        JSON.stringify({ error: "Purchase not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Verify the purchase belongs to the authenticated user
    if (data.user_id !== user.id) {
      console.warn(`User ${user.id} attempted to access purchase ${purchaseId} owned by ${data.user_id}`);
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Payment status for ${purchaseId}: ${data.status}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        data: {
          id: data.id,
          status: data.status,
          mpesa_receipt_number: data.mpesa_receipt_number,
          domain_name: data.domain_name,
          failure_reason: data.failure_reason,
          tracking_number: data.tracking_number
        }
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    console.error("Error in check-payment-status:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
