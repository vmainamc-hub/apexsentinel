import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const deleteSchema = z.object({
  purchaseId: z.string().uuid("Invalid purchase ID format"),
});

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
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
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const body = await req.json();
    
    // Validate input
    const validationResult = deleteSchema.safeParse(body);
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ error: "Invalid input", details: validationResult.error.errors }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { purchaseId } = validationResult.data;

    console.log(`User ${user.id} attempting to delete purchase: ${purchaseId}`);

    // Use service role to bypass RLS
    const supabaseAdmin = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // First check if purchase exists, belongs to user, and is failed/cancelled
    const { data: purchase, error: fetchError } = await supabaseAdmin
      .from("domain_purchases")
      .select("id, status, user_id")
      .eq("id", purchaseId)
      .maybeSingle();

    if (fetchError) {
      console.error("Error fetching purchase:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch purchase" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!purchase) {
      return new Response(
        JSON.stringify({ error: "Purchase not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check ownership
    if (purchase.user_id !== user.id) {
      console.error(`User ${user.id} attempted to delete purchase ${purchaseId} owned by ${purchase.user_id}`);
      return new Response(
        JSON.stringify({ error: "Not authorized to delete this purchase" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Only allow deletion of failed or cancelled purchases
    if (purchase.status !== 'failed' && purchase.status !== 'cancelled') {
      return new Response(
        JSON.stringify({ error: "Only failed or cancelled purchases can be deleted" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { error: deleteError } = await supabaseAdmin
      .from("domain_purchases")
      .delete()
      .eq("id", purchaseId);

    if (deleteError) {
      console.error("Error deleting purchase:", deleteError);
      return new Response(
        JSON.stringify({ error: "Failed to delete purchase" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Successfully deleted purchase: ${purchaseId} for user ${user.id}`);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    console.error("Error in delete-failed-purchase:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
