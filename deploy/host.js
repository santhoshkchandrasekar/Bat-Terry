/* The page's connection to its language model. It gives the page the two things it uses: "sample" (a language model with tools,
   here GPT-4o mini through the site's own function at /api/llm, which holds the key and the daily limits) and "downloads" (a
   plain browser download). If the function is missing, over its limit or down, every call fails cleanly and the page answers
   from its own rules, exactly as it does with no model at all. If window.terryHost is already set (a test harness), this file does nothing. */
(function () {
  "use strict";
  if (window.terryHost && window.terryHost.use) return;
  const EP = "/api/llm";
  window.TerryHost = { model: "GPT-4o mini", note: "Questions you type are sent to OpenAI to answer them." };
  const fail = (code, message) => { const e = new Error(message || code); e.code = code; e.message = message || code; return e; };
  async function call(body, signal) {
    let r;
    try { r = await fetch(EP, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal }); }
    catch (e) { throw fail(signal && signal.aborted ? "cancelled" : "upstream_error"); }
    if (r.status === 429) throw fail("rate_limited", "Today's live answers are used up.");
    if (!r.ok) throw fail("upstream_error", "The live model did not answer.");
    try { return await r.json(); } catch (e) { throw fail("upstream_error"); }
  }
  const toMsgs = input => (typeof input === "string" ? [{ role: "user", content: input }] : (Array.isArray(input) ? input : []).map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "") })));
  function parseJson(t) {
    t = String(t || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    try { return JSON.parse(t); } catch (e) {}
    const a = t.indexOf("{"), b = t.lastIndexOf("}");
    if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (e) {} }
    throw fail("invalid_response", "The answer was not JSON.");
  }
  // the tool loop runs here, in the page: the function only forwards one round at a time, so tools stay page functions
  async function run(input, opts, wantJson) {
    opts = opts || {};
    const tools = Array.isArray(opts.tools) ? opts.tools : [], msgs = toMsgs(input);
    const spec = tools.map(t => ({ type: "function", function: { name: t.name, description: String(t.description || "").slice(0, 1000), parameters: t.inputSchema || { type: "object", properties: {} } } }));
    for (let round = 0; round < 10; round++) {
      if (opts.signal && opts.signal.aborted) throw fail("cancelled");
      const j = await call({ messages: msgs, tools: spec.length ? spec : undefined, json: !!wantJson }, opts.signal), m = j && j.message;
      if (!m) throw fail("upstream_error");
      if (m.tool_calls && m.tool_calls.length) {
        msgs.push({ role: "assistant", content: m.content || null, tool_calls: m.tool_calls });
        for (const c of m.tool_calls) {
          const name = c.function && c.function.name, t = tools.find(x => x.name === name); let out;
          try {
            if (!t) throw new Error(`There is no tool named ${name}. Your tools are: ${tools.map(x => x.name).join(", ")}.`);
            let a = {}; try { a = JSON.parse(c.function.arguments || "{}"); } catch (e) {}
            out = JSON.stringify(await t.execute(a));
          } catch (e) { if (opts.signal && opts.signal.aborted) throw fail("cancelled"); out = JSON.stringify({ error: String((e && e.message) || e).slice(0, 300) }); }
          msgs.push({ role: "tool", tool_call_id: c.id, content: String(out).slice(0, 60000) });
        }
        continue;
      }
      const text = m.content || "";
      if (typeof opts.onText === "function") { try { opts.onText({ text, delta: text }); } catch (e) {} }
      return wantJson ? parseJson(text) : { text, truncated: j.finish === "length" };
    }
    throw fail("too_many_rounds");
  }
  const sample = (input, opts) => run(input, opts, false);
  sample.json = (input, opts) => run(input, opts, true);
  sample.limits = async () => ({ images: false, maxPromptBytes: 262144, tools: { maxCount: 16 } });
  const downloads = {
    save: async ({ filename, data }) => {
      const blob = data instanceof Blob ? data : new Blob([data], { type: /\.csv$/i.test(filename || "") ? "text/csv" : "text/plain" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename || "download"; document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); return { saved: true };
    } };
  window.terryHost = { use: async name => (name === "sample" ? sample : name === "downloads" ? downloads : null) };
})();
