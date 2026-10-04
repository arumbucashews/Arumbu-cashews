// Arumbu Cashews — create a Razorpay order for an existing Arumbu order.
//
// Called by checkout.js with the signed-in customer's JWT. The amount is
// read from the database (orders.total) — never from the browser.
//
// Required secrets (Supabase Dashboard -> Edge Functions -> Secrets):
//   RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
// Provided automatically by Supabase: SUPABASE_URL, SUPABASE_ANON_KEY,
//   SUPABASE_SERVICE_ROLE_KEY
// Optional: ALLOWED_ORIGINS (comma-separated) — defaults to "*".
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, 405, { error: "method_not_allowed" });

  const keyId = Deno.env.get("RAZORPAY_KEY_ID");
  const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
  if (!keyId || !keySecret) return json(req, 503, { error: "payments_not_configured" });

  let body: { order_id?: string };
  try { body = await req.json(); } catch { return json(req, 400, { error: "invalid_json" }); }
  if (!body.order_id || !/^[0-9a-f-]{36}$/i.test(body.order_id)) return json(req, 400, { error: "invalid_order_id" });

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  // RLS: a customer can only read their own order.
  const { data: order, error } = await userClient
    .from("orders")
    .select("id, order_number, total, currency, payment_method, payment_status, order_status, customer_name, customer_email, contact_phone")
    .eq("id", body.order_id)
    .maybeSingle();
  if (error) return json(req, 400, { error: "order_lookup_failed" });
  if (!order) return json(req, 404, { error: "order_not_found" });
  if (order.payment_method !== "razorpay") return json(req, 409, { error: "not_an_online_payment_order" });
  if (order.payment_status === "paid") return json(req, 409, { error: "already_paid" });
  if (["cancelled", "refunded"].includes(order.order_status)) return json(req, 409, { error: "order_cancelled" });

  const amount = Math.round(Number(order.total) * 100);
  if (!Number.isFinite(amount) || amount < 100) return json(req, 409, { error: "invalid_amount" });

  const rzpRes = await fetch(`${RZP_API}/v1/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Basic " + btoa(`${keyId}:${keySecret}`) },
    body: JSON.stringify({ amount, currency: "INR", receipt: order.order_number, notes: { order_id: order.id, order_number: order.order_number } }),
  });
  const rzp = await rzpRes.json().catch(() => ({}));
  if (!rzpRes.ok || !rzp.id) return json(req, 502, { error: "gateway_order_failed" });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { error: attachErr } = await admin.rpc("payment_attach_gateway_order", {
    p_order_id: order.id, p_gateway_order_id: rzp.id, p_amount: order.total,
  });
  if (attachErr) return json(req, 409, { error: "order_not_payable" });

  return json(req, 200, {
    key_id: keyId,
    razorpay_order_id: rzp.id,
    amount,
    currency: "INR",
    order_number: order.order_number,
    prefill: { name: order.customer_name, email: order.customer_email, contact: order.contact_phone },
    notes: { order_id: order.id, order_number: order.order_number },
  });
});
