// Arumbu Cashews — Razorpay webhook (backup confirmation path).
//
// Deploy with verify_jwt = false: Razorpay does not send a Supabase JWT.
// Authenticity is checked instead with the X-Razorpay-Signature header
// (HMAC-SHA256 of the raw body using RAZORPAY_WEBHOOK_SECRET).
//
// Configure in Razorpay Dashboard -> Webhooks:
//   URL:    https://<project-ref>.supabase.co/functions/v1/razorpay-webhook
//   Events: order.paid, payment.failed
// Required secrets: RAZORPAY_WEBHOOK_SECRET
import { createClient } from "npm:@supabase/supabase-js@2";

async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return reply(405, { error: "method_not_allowed" });
  const secret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
  if (!secret) return reply(503, { error: "webhook_not_configured" });

  const raw = await req.text();
  const signature = req.headers.get("X-Razorpay-Signature") ?? "";
  const expected = await hmacHex(secret, raw);
  if (!signature || !safeEqual(expected, signature)) return reply(401, { error: "invalid_signature" });

  let event: any;
  try { event = JSON.parse(raw); } catch { return reply(400, { error: "invalid_json" }); }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const orderEntity = event?.payload?.order?.entity;
  const paymentEntity = event?.payload?.payment?.entity;
  const orderId = orderEntity?.notes?.order_id ?? paymentEntity?.notes?.order_id;
  const gatewayOrderId = orderEntity?.id ?? paymentEntity?.order_id;
  if (!orderId || !gatewayOrderId) return reply(200, { ignored: true });

  if (event.event === "order.paid" && paymentEntity?.status === "captured") {
    const { error } = await admin.rpc("payment_confirm", {
      p_order_id: orderId,
      p_gateway_order_id: gatewayOrderId,
      p_payment_id: paymentEntity.id,
      p_amount_paise: Number(paymentEntity.amount),
      p_raw: { id: paymentEntity.id, method: paymentEntity.method, source: "webhook" },
    });
    // 200 even on a business-rule rejection so Razorpay does not retry forever;
    // the order stays unpaid and shows up for the admin to review.
    return reply(200, { ok: !error, error: error?.message ?? null });
  }
  if (event.event === "payment.failed") {
    await admin.rpc("payment_mark_failed", {
      p_order_id: orderId, p_gateway_order_id: gatewayOrderId,
      p_reason: paymentEntity?.error_description ?? "payment failed",
    });
    return reply(200, { ok: true });
  }
  return reply(200, { ignored: event.event ?? null });
});
