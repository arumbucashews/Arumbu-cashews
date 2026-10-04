// Arumbu Cashews — verify a Razorpay payment server-side.
//
// The browser's success callback is NOT trusted. This function:
//   1. checks the signer is the customer who owns the order (RLS),
//   2. verifies the HMAC signature with RAZORPAY_KEY_SECRET,
//   3. fetches the payment from Razorpay and checks status + amount,
//   4. marks the order paid through payment_confirm() (service_role only).
//
// Required secrets: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
import { createClient } from "npm:@supabase/supabase-js@2";

// Overridable only for local testing against a mock gateway.
const RZP_API = Deno.env.get("RAZORPAY_API_BASE") ?? "https://api.razorpay.com";

const allowed = (Deno.env.get("ALLOWED_ORIGINS") ?? "*").split(",").map((s) => s.trim());
function cors(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const allow = allowed.includes("*") ? "*" : (allowed.includes(origin) ? origin : allowed[0]);
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
function json(req: Request, status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } });
}
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, 405, { error: "method_not_allowed" });

  const keyId = Deno.env.get("RAZORPAY_KEY_ID");
  const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
  if (!keyId || !keySecret) return json(req, 503, { error: "payments_not_configured" });

  let b: Record<string, string>;
  try { b = await req.json(); } catch { return json(req, 400, { error: "invalid_json" }); }
  const { order_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = b ?? {};
  if (!order_id || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return json(req, 400, { error: "missing_fields" });
  }

  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: order } = await userClient
    .from("orders").select("id, total, razorpay_order_id, payment_status").eq("id", order_id).maybeSingle();
  if (!order) return json(req, 404, { error: "order_not_found" });
  if (order.razorpay_order_id !== razorpay_order_id) return json(req, 400, { error: "gateway_order_mismatch" });

  const expected = await hmacHex(keySecret, `${razorpay_order_id}|${razorpay_payment_id}`);
  if (!safeEqual(expected, String(razorpay_signature))) return json(req, 400, { error: "invalid_signature" });

  const payRes = await fetch(`${RZP_API}/v1/payments/${encodeURIComponent(razorpay_payment_id)}`, {
    headers: { Authorization: "Basic " + btoa(`${keyId}:${keySecret}`) },
  });
  const payment = await payRes.json().catch(() => ({}));
  if (!payRes.ok) return json(req, 502, { error: "gateway_lookup_failed" });
  const expectedAmount = Math.round(Number(order.total) * 100);
  if (payment.order_id !== razorpay_order_id || Number(payment.amount) !== expectedAmount) {
    return json(req, 400, { error: "payment_mismatch" });
  }

  let status = payment.status;
  if (status === "authorized") {
    const capRes = await fetch(`${RZP_API}/v1/payments/${encodeURIComponent(razorpay_payment_id)}/capture`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Basic " + btoa(`${keyId}:${keySecret}`) },
      body: JSON.stringify({ amount: expectedAmount, currency: "INR" }),
    });
    const cap = await capRes.json().catch(() => ({}));
    if (capRes.ok) status = cap.status;
  }
  if (status !== "captured") return json(req, 402, { error: "payment_not_captured", status });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await admin.rpc("payment_confirm", {
    p_order_id: order_id,
    p_gateway_order_id: razorpay_order_id,
    p_payment_id: razorpay_payment_id,
    p_amount_paise: expectedAmount,
    p_raw: { id: payment.id, method: payment.method, status, captured_at: payment.created_at },
  });
  if (error) return json(req, 409, { error: "confirm_failed" });
  return json(req, 200, data);
});
