import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DomainResult {
  domain: string;
  available: boolean;
  price?: string;
  premium?: boolean;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { domainName } = await req.json();

    if (!domainName) {
      return new Response(
        JSON.stringify({ error: "Domain name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean the domain name (remove any existing TLD)
    const baseDomain = domainName
      .replace(/\.(com|net|io|org|co|site|xyz|dev|app)$/i, "")
      .trim()
      .toLowerCase();

    // TLDs to check with estimated prices
    const tlds = [
      { ext: "com", price: "$9.99" },
      { ext: "net", price: "$11.99" },
      { ext: "org", price: "$12.99" },
      { ext: "io", price: "$32.99" },
      { ext: "co", price: "$24.99" },
      { ext: "site", price: "$2.99" },
    ];

    console.log(`Checking domain availability via RDAP for: ${baseDomain}`);

    const results: DomainResult[] = await Promise.all(
      tlds.map(async ({ ext, price }) => {
        const fullDomain = `${baseDomain}.${ext}`;
        const rdapUrl = `https://rdap.org/domain/${fullDomain}`;

        try {
          const response = await fetch(rdapUrl, { method: "GET" });

          // RDAP behavior:
          // 200 -> domain exists (registered)
          // 404 -> domain not found (likely available)
          if (response.status === 404) {
            console.log(`RDAP: ${fullDomain} appears AVAILABLE (404)`);
            return {
              domain: fullDomain,
              available: true,
              price,
              premium: false,
            };
          }

          if (response.ok) {
            console.log(`RDAP: ${fullDomain} is REGISTERED (200)`);
            return {
              domain: fullDomain,
              available: false,
              price,
              premium: false,
            };
          }

          console.error(
            `RDAP unexpected status for ${fullDomain}: ${response.status}`,
          );
        } catch (error) {
          console.error(`RDAP error for ${fullDomain}:`, error);
        }

        // Fallback when RDAP is unavailable or unexpected status:
        // mark as not available to avoid selling potentially registered domains
        return {
          domain: fullDomain,
          available: false,
          price,
          premium: false,
        };
      }),
    );

    console.log(`RDAP check complete, found ${results.length} domain results`);

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error checking domain:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
