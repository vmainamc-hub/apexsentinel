import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PurchaseEmailRequest {
  email: string;
  domain_name: string;
  amount?: number;
  mpesa_receipt_number?: string;
  tracking_number?: string;
  payment_date?: string;
  failure_reason?: string;
  is_failure?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Send purchase email function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData: PurchaseEmailRequest = await req.json();
    const { 
      email, 
      domain_name, 
      amount, 
      mpesa_receipt_number, 
      tracking_number,
      payment_date,
      failure_reason,
      is_failure
    } = requestData;

    console.log("Email request:", is_failure ? "failure notification" : "success notification", "for domain:", domain_name);

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    let emailHtml: string;
    let subject: string;

    if (is_failure) {
      subject = `Domain Purchase Failed: ${domain_name}`;
      emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .reason-box { background: white; border: 1px solid #fecaca; border-left: 4px solid #ef4444; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .retry-button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 20px; }
            .footer { text-align: center; padding: 20px; color: #888; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>❌ Payment Failed</h1>
              <p>Your domain purchase was not completed</p>
            </div>
            <div class="content">
              <h2>Hello!</h2>
              <p>Unfortunately, your payment for the domain <strong>${domain_name}</strong> was not successful.</p>
              
              <div class="reason-box">
                <p style="margin: 0; color: #666; font-size: 14px;">Reason for failure:</p>
                <p style="margin: 10px 0 0 0; font-weight: bold; color: #ef4444;">${failure_reason || 'Payment was not completed'}</p>
              </div>

              <p>Don't worry! You can try purchasing the domain again. Here are some tips:</p>
              <ul>
                <li>Ensure you have sufficient funds in your M-Pesa account</li>
                <li>Enter your M-Pesa PIN when prompted</li>
                <li>Make sure your phone has network connectivity</li>
                <li>Don't cancel the payment request</li>
              </ul>
              
              <p>If you continue experiencing issues, please contact our support team.</p>
            </div>
            <div class="footer">
              <p>This is an automated email. Please do not reply.</p>
            </div>
          </div>
        </body>
        </html>
      `;
    } else {
      subject = `Domain Purchase Confirmed: ${domain_name}`;
      emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .receipt-box { background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .receipt-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
            .receipt-row:last-child { border-bottom: none; }
            .label { color: #666; }
            .value { font-weight: bold; color: #333; }
            .tracking { background: #667eea; color: white; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #888; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Purchase Successful!</h1>
              <p>Your domain has been registered</p>
            </div>
            <div class="content">
              <h2>Hello!</h2>
              <p>Your domain purchase has been completed successfully. Here are your receipt details:</p>
              
              <div class="receipt-box">
                <div class="receipt-row">
                  <span class="label">Domain Name:</span>
                  <span class="value">${domain_name}</span>
                </div>
                <div class="receipt-row">
                  <span class="label">Amount Paid:</span>
                  <span class="value">KES ${amount?.toLocaleString() || 'N/A'}</span>
                </div>
                <div class="receipt-row">
                  <span class="label">M-Pesa Receipt:</span>
                  <span class="value">${mpesa_receipt_number || 'N/A'}</span>
                </div>
                <div class="receipt-row">
                  <span class="label">Payment Date:</span>
                  <span class="value">${payment_date ? new Date(payment_date).toLocaleString() : 'N/A'}</span>
                </div>
              </div>

              <div class="tracking">
                <p style="margin: 0; font-size: 14px;">Your Tracking Number</p>
                <h2 style="margin: 5px 0 0 0;">${tracking_number || 'N/A'}</h2>
              </div>

              <p>Keep this email for your records. You can use your tracking number to check the status of your domain setup.</p>
              
              <p>Thank you for your purchase!</p>
            </div>
            <div class="footer">
              <p>This is an automated email. Please do not reply.</p>
            </div>
          </div>
        </body>
        </html>
      `;
    }

    console.log("Sending email to:", email);

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Domain Purchase <onboarding@resend.dev>",
        to: [email],
        subject,
        html: emailHtml,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Resend API error:", data);
      throw new Error(data.message || "Failed to send email");
    }

    console.log("Email sent successfully:", data);

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    console.error("Error sending email:", error);
    const message = error instanceof Error ? error.message : "Unable to send email";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
