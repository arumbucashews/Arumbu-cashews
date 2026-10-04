// Arumbu Cashews — send queued notifications (notification_outbox).
//
// Email is sent through Resend only when RESEND_API_KEY and
// NOTIFY_FROM_EMAIL are configured; otherwise nothing is sent and the
// queue is left untouched (reported as configured: false).
// WhatsApp / SMS providers need approved templates and are not wired —
// rows on those channels are marked 'skipped'.
//
// Who may run it: an authenticated Arumbu admin (Admin -> Notifications
// -> "Send queued"), or a scheduled job calling with the service role key.
import { createClient } from "npm:@supabase/supabase-js@2";

// Overridable only for local testing against a mock mail API.
const RESEND_API = Deno.env.get("RESEND_API_BASE") ?? "https://api.resend.com";

const allowed = (Deno.env.get("ALLOWED_ORIGINS") ?? "*").split(",").map((s) => s.trim());
function cors(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const allow = allowed.includes("*") ? "*" : (allowed.includes(origin) ? origin : allowed[0]);
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}
function json(req: Request, status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } });
}

const SUBJECTS: Record<string, string> = {
  order_placed: "Order received",
  payment_confirmed: "Payment received",
  order_confirmed: "Order confirmed",
  order_shipped: "Order shipped",
  order_out_for_delivery: "Out for delivery",
  order_delivered: "Order delivered",
  order_cancelled: "Order cancelled",
  order_refunded: "Order refunded",
  wholesale_enquiry: "New wholesale enquiry",
  contact_message: "New contact message",
  gifting_enquiry: "New gifting enquiry",
  low_stock: "Low stock",
};
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

function render(row: any) {
  const p = row.payload ?? {};
  const subject = `Arumbu Cashews — ${SUBJECTS[row.event] ?? row.event}${p.order_number ? " " + p.order_number : ""}`;
  const lines: string[] = [];
  if (p.order_number) lines.push(`Order: ${esc(p.order_number)}`);
  if (p.status) lines.push(`Status: ${esc(String(p.status).replace(/_/g, " "))}`);
  if (p.total != null) lines.push(`Total: ₹${esc(p.total)}`);
  if (p.courier_name) lines.push(`Courier: ${esc(p.courier_name)}`);
  if (p.tracking_number) lines.push(`Tracking: ${esc(p.tracking_number)}`);
  if (p.item) lines.push(`Item: ${esc(p.item)} — stock ${esc(p.stock_qty)}`);
  if (p.name) lines.push(`From: ${esc(p.name)}`);
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1B0E06">
    <p><strong>${esc(SUBJECTS[row.event] ?? row.event)}</strong></p><p>${lines.join("<br>")}</p>
    <p style="color:#6b5a4a;font-size:13px">Arumbu Cashews · +91 99760 55524</p></div>`;
  return { subject, html };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, 405, { error: "method_not_allowed" });

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";
  const bearer = authHeader.replace(/^Bearer\s+/i, "");

  // Caller must be the service role (scheduler) or a signed-in admin.
  if (bearer !== serviceKey) {
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: isAdmin } = await userClient.rpc("is_admin");
    if (isAdmin !== true) return json(req, 403, { error: "forbidden" });
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("NOTIFY_FROM_EMAIL");
  if (!resendKey || !from) return json(req, 200, { configured: false, sent: 0, message: "Email provider not configured" });

  const admin = createClient(url, serviceKey);
  const { data: rows, error } = await admin.rpc("notifications_claim", { p_limit: 25 });
  if (error) return json(req, 500, { error: "claim_failed" });

  let sent = 0, failed = 0, skipped = 0;
  for (const row of rows ?? []) {
    if (row.channel !== "email" || !row.recipient) {
      await admin.rpc("notifications_complete", { p_id: row.id, p_status: "skipped", p_error: "channel or recipient not supported" });
      skipped++; continue;
    }
    const { subject, html } = render(row);
    const res = await fetch(`${RESEND_API}/emails`, {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [row.recipient], subject, html }),
    });
    if (res.ok) { sent++; await admin.rpc("notifications_complete", { p_id: row.id, p_status: "sent" }); }
    else {
      failed++;
      const msg = (await res.text()).slice(0, 500);
      await admin.rpc("notifications_complete", { p_id: row.id, p_status: row.attempts >= 5 ? "failed" : "queued", p_error: msg });
    }
  }
  return json(req, 200, { configured: true, sent, failed, skipped });
});
