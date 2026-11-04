/* Task 2.5 probe — signs a Bc03OrderEvent with the shared N8N_WEBHOOK_SECRET
   (read from .env.local, never printed) and POSTs it to the local webhook
   route. Text-only output: status + body. Usage:
     node scripts/probe-bc03-webhook.mjs <port> <order_ref> [email] [kind]
*/
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

const [, , port = "3300", orderRef = `SO-PROBE-${Date.now()}`, email = "", kind = ""] =
  process.argv;

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const line = env.split(/\r?\n/).find((l) => l.startsWith("N8N_WEBHOOK_SECRET="));
const secret = line ? line.split("=").slice(1).join("=").trim() : "";
if (!secret) {
  console.log("PROBE FAIL: N8N_WEBHOOK_SECRET not found in .env.local");
  process.exit(1);
}

const event = {
  event_type: "order_verified",
  provider: "internal",
  order_ref: orderRef,
  package_id: "silver",
  duration_days: 30,
  customer_name: "Probe Client",
  telegram_user_id: null,
  telegram_chat_id: null,
  email: email || null,
  phone: null,
  kind: kind || null,
  subscription_code: null,
};

const rawBody = JSON.stringify(event);
const ts = new Date().toISOString();
const sig = createHmac("sha256", secret).update(`${ts}.${rawBody}`).digest("hex");

const res = await fetch(`http://localhost:${port}/api/webhooks/bc03-order-event`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-BC-Timestamp": ts,
    "X-BC-Signature": sig,
  },
  body: rawBody,
});
const body = await res.text();
console.log(`STATUS ${res.status}`);
console.log(body);
