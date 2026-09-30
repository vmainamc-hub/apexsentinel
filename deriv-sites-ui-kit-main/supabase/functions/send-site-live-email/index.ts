import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SiteLiveEmailRequest {
  email: string;
  siteName: string;
  domainName: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, siteName, domainName }: SiteLiveEmailRequest = await req.json();

    console.log(`Sending site live notification to ${email} for domain ${domainName}`);

    const emailResponse = await resend.emails.send({
      from: "DerivSites <onboarding@resend.dev>",
      to: [email],
      subject: "🎉 Your DerivSites is Now Live!",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0f172a;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #1e293b; border-radius: 16px; overflow: hidden;">
                  <!-- Header -->
                  <tr>
                    <td style="padding: 40px 40px 20px; text-align: center;">
                      <div style="width: 60px; height: 60px; background: linear-gradient(135deg, #8b5cf6, #a855f7); border-radius: 12px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                        <span style="font-size: 28px;">🚀</span>
                      </div>
                      <h1 style="margin: 0; color: #f8fafc; font-size: 28px; font-weight: 700;">Your Site is Live!</h1>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 20px 40px 40px;">
                      <p style="color: #94a3b8; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                        Great news! Your DerivSites trading website <strong style="color: #f8fafc;">${siteName}</strong> has been deployed and is now live.
                      </p>
                      
                      <!-- Domain Box -->
                      <div style="background-color: #334155; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                        <p style="color: #94a3b8; font-size: 14px; margin: 0 0 8px;">Your website is available at:</p>
                        <a href="https://${domainName}" style="color: #a855f7; font-size: 18px; font-weight: 600; text-decoration: none;">
                          ${domainName}
                        </a>
                      </div>
                      
                      <!-- CTA Button -->
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td align="center">
                            <a href="https://${domainName}" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6, #a855f7); color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px;">
                              Visit Your Site
                            </a>
                          </td>
                        </tr>
                      </table>
                      
                      <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 24px 0 0;">
                        Your trading bots are now active and ready to serve your visitors. If you have any questions, feel free to contact our support team.
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="padding: 20px 40px; border-top: 1px solid #334155;">
                      <p style="color: #64748b; font-size: 12px; margin: 0; text-align: center;">
                        © 2025 DerivSites. All rights reserved.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });

    console.log("Site live email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    console.error("Error sending site live email:", error);
    const message = error instanceof Error ? error.message : "Unable to send email";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
