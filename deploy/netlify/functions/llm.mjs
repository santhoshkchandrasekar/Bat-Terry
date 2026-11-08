// The hosted site's only server code: forwards one round of a Bat-Terry prompt to OpenAI's gpt-6.1-sol (Responses API, low
// reasoning effort) with the site's key, and keeps the bill small. Limits (Netlify environment variables, with defaults):
// TERRY_DAY_USD, the whole site's spend per UTC day (3.00); TERRY_VISITOR_CALLS, model rounds per visitor per day (60, about 15
// questions). Over either limit it answers 429 and the page falls back to its own rules. It only forwards prompts the page itself
// writes (they start with one of PREFIXES). The page speaks chat-style messages; this file turns them into Responses input and the
// answer back into a chat-style message, so the page's tool loop is unchanged. A tool round is chained to the previous response
// (previous_response_id), which carries the model's reasoning, so only the new tool results are sent.
import { getStore } from "@netlify/blobs";

const MODEL = "gpt-6.1-sol", EFFORT = "low", MAX_OUT = 4000, IN_USD = 2 / 1e6, OUT_USD = 10 / 1e6;
const PREFIXES = ["You are Terry", "You are the Boston 311", "Rewrite a resident", "You are editing a short answer", "You read messages for Terry"];
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const env = (k, d) => { const v = Number(Netlify.env.get(k)); return Number.isFinite(v) && v > 0 ? v : d; };
async function hash(s) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return [...new Uint8Array(b)].slice(0, 12).map(x => x.toString(16).padStart(2, "0")).join(""); }

export default async (req, context) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const key = Netlify.env.get("OPENAI_API_KEY"); if (!key) return json({ error: "not_configured" }, 503);
  const origin = req.headers.get("origin");
  if (origin) { try { if (new URL(origin).host !== new URL(req.url).host) return json({ error: "forbidden" }, 403); } catch (e) { return json({ error: "forbidden" }, 403); } }
  const raw = await req.text(); if (raw.length > 400000) return json({ error: "too_large" }, 413);
  let body; try { body = JSON.parse(raw); } catch (e) { return json({ error: "bad_request" }, 400); }
  const messages = Array.isArray(body.messages) ? body.messages.slice(0, 40) : null;
  const first = messages && messages.find(m => m && m.role === "user");
  if (!first || typeof first.content !== "string" || !PREFIXES.some(p => first.content.startsWith(p))) return json({ error: "forbidden" }, 403);
  // tools arrive chat-style ({type, function:{name, description, parameters}}); Responses wants them flat
  const tools = Array.isArray(body.tools) && body.tools.length ? body.tools.slice(0, 16).map(t => (t && t.function ? { type: "function", name: t.function.name, description: t.function.description, parameters: t.function.parameters } : t)) : undefined;
  const prev = typeof body.prev === "string" && /^resp_[A-Za-z0-9_-]{6,200}$/.test(body.prev) ? body.prev : null;

  const day = new Date().toISOString().slice(0, 10), store = getStore({ name: "terry-limits", consistency: "strong" });
  const who = await hash((context.ip || req.headers.get("x-nf-client-connection-ip") || "unknown") + "|" + day);
  const [spent, calls] = await Promise.all([store.get(`spend/${day}`, { type: "json" }), store.get(`visitor/${day}/${who}`, { type: "json" })]);
  if ((spent || 0) >= env("TERRY_DAY_USD", 3)) return json({ error: "rate_limited", scope: "site" }, 429);
  if ((calls || 0) >= env("TERRY_VISITOR_CALLS", 60)) return json({ error: "rate_limited", scope: "visitor" }, 429);

  const wantJson = !!body.json && messages.some(m => typeof m.content === "string" && /json/i.test(m.content));
  // chat messages -> Responses input. First round: the whole conversation. A tool round: only the tool results after the last
  // assistant turn, chained to the previous response (which holds the model's tool calls and reasoning).
  const item = m => m.role === "tool" ? { type: "function_call_output", call_id: String(m.tool_call_id || ""), output: String(m.content == null ? "" : m.content) }
    : { role: m.role === "assistant" ? "assistant" : m.role === "system" ? "developer" : "user", content: String(m.content == null ? "" : m.content) };
  let input;
  if (prev) { let k = messages.length; while (k > 0 && messages[k - 1] && messages[k - 1].role === "tool") k--; input = messages.slice(k).map(item); }
  else input = messages.filter(m => m && m.role !== "tool" && !(m.role === "assistant" && Array.isArray(m.tool_calls) && m.tool_calls.length)).map(item);
  if (!input.length) return json({ error: "bad_request" }, 400);
  let r, j;
  try {
    r = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, input, tools, previous_response_id: prev || undefined, reasoning: { effort: EFFORT }, max_output_tokens: MAX_OUT,
        text: wantJson ? { format: { type: "json_object" } } : undefined, store: true }) });
    j = await r.json();
  } catch (e) { return json({ error: "upstream_error" }, 502); }
  if (!r.ok || !j || !Array.isArray(j.output)) return json({ error: "upstream_error", status: r.status }, 502);
  // Responses output -> one chat-style assistant message
  const callsOut = j.output.filter(o => o && o.type === "function_call").map(o => ({ id: o.call_id, type: "function", function: { name: o.name, arguments: o.arguments || "{}" } }));
  const text = j.output.filter(o => o && o.type === "message").flatMap(o => (o.content || []).filter(c => c && c.type === "output_text").map(c => c.text || "")).join("");
  const message = { role: "assistant", content: text || null }; if (callsOut.length) message.tool_calls = callsOut;
  const finish = j.status === "incomplete" && j.incomplete_details && j.incomplete_details.reason === "max_output_tokens" ? "length" : callsOut.length ? "tool_calls" : "stop";
  const u = j.usage || {}, cost = (u.input_tokens || 0) * IN_USD + (u.output_tokens || 0) * OUT_USD;
  await Promise.all([store.setJSON(`spend/${day}`, (spent || 0) + cost), store.setJSON(`visitor/${day}/${who}`, (calls || 0) + 1)]);
  return json({ message, finish, id: j.id, usage: { input: u.input_tokens || 0, output: u.output_tokens || 0 } });
};

export const config = { path: "/api/llm" };
