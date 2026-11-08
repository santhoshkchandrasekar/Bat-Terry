"""The hunt: an agent prices the fix for each confirmed predator by calling the simulator.

Technique: agents (OpenAI tool calling loop). The model decides which tools to call and in what order;
the tools do the arithmetic. Guardrails: every number in the agent's write-up is checked against its own
tool results (same check as the report chain); on a mismatch it is asked once to correct, and anything still
unmatched is returned in `unverified`. The loop records every call so the notebook can show the trace.
"""
from __future__ import annotations

import json

from .llm import MODEL, client
from .report import unverified_numbers
from .schemas import Predator
from .tools import TOOLS, call

SYSTEM = """You are Terry's hunting module. For the predator described, work out the crew plan that deals with it,
using the tools. Always, in this order:
1. Call do_nothing for the department (baseline: January crews all year).
2. Call optimize_plan in the requested mode. That plan is already built to survive forecast error.
3. Call simulate_plan on that plan with demand_mult 1.14, to see how it holds if demand runs 14% hot.
4. Call break_point on that plan.
Recommend the optimize_plan result unless a variant you simulated is cheaper AND holds at least the same on-time
rate at demand_mult 1.14.

Answer in JSON with keys: recommended_crews_by_month (12 ints), seasonal_by_month (12 ints, zeros unless Parks),
baseline_total_cost, plan_total_cost, baseline_ontime, plan_ontime, plan_ontime_at_plus14, break_pct, rationale.
rationale = exactly three plain sentences for the department manager:
  (1) the crew change, paraphrasing the plan's crew_schedule field exactly (it lists every month);
  (2) what it costs versus doing nothing, and the on-time rate it buys (both from tool results);
  (3) how it holds if demand runs 14% hot, and the break point (break_pct = extra demand at which on-time falls below 90%).
Copy every number exactly from a tool result (you may round: 0.917 -> 92%, 2805000 -> $2.81M). Never estimate."""

MAX_STEPS = 10


def _loop(msgs, trace):
    c = client()
    for _ in range(MAX_STEPS):
        # One tool call per turn: later steps need earlier results (break_point needs the plan).
        r = c.chat.completions.create(model=MODEL, messages=msgs, tools=TOOLS, temperature=0,
                                      parallel_tool_calls=False, response_format={"type": "json_object"})
        m = r.choices[0].message
        if m.tool_calls:
            msgs.append(m)
            for tc in m.tool_calls:
                args = json.loads(tc.function.arguments)
                try:
                    out = call(tc.function.name, args)
                except Exception as e:  # noqa: BLE001
                    out = {"error": str(e)}
                trace.append({"tool": tc.function.name, "args": args, "result": out})
                msgs.append({"role": "tool", "tool_call_id": tc.id, "content": json.dumps(out)})
            continue
        try:
            msgs.append({"role": "assistant", "content": m.content})
            return json.loads(m.content)
        except json.JSONDecodeError:
            msgs.append({"role": "user", "content": "Return the final answer as a JSON object only."})
    return {"error": "no final answer"}


def hunt(p: Predator, mode: str = "neutral") -> tuple[dict, list[dict]]:
    h = p.hypothesis
    user = (f"Predator: {h.name}\nDepartment: {h.department}\nType: {h.request_type}\nNeighborhood: {h.neighborhood}\n"
            f"Months: {h.months}\nEvidence: {p.evidence.detail}\nMode: {mode}")
    msgs = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": user}]
    trace: list[dict] = []
    fix = _loop(msgs, trace)
    totals = [t["result"]["total_cost"] for t in trace if isinstance(t["result"], dict) and "total_cost" in t["result"]]
    facts = {"tool_results": [t["result"] for t in trace], "months": list(range(1, 13)),
             "thresholds": [0.90, 0.14, 1.14], "differences": [a - b for a in totals for b in totals if a > b]}
    bad = unverified_numbers(fix.get("rationale", ""), facts)
    if bad:
        msgs.append({"role": "user", "content": f"These numbers in your rationale do not match any tool result: "
                     f"{', '.join(bad)}. Rewrite the JSON answer using only numbers from the tool results."})
        fix = _loop(msgs, trace)
        bad = unverified_numbers(fix.get("rationale", ""), facts)
    claims = _claim_errors(fix, trace)
    if claims:
        msgs.append({"role": "user", "content": "Some figures are attached to the wrong result: " + "; ".join(claims)
                     + ". Rewrite the JSON answer with these corrected; keep everything else."})
        fix = _loop(msgs, trace)
        bad = unverified_numbers(fix.get("rationale", ""), facts)
        claims = _claim_errors(fix, trace)
    fix["unverified"] = bad + claims
    finalize(fix, trace)
    return fix, trace


def finalize(fix: dict, trace: list[dict]) -> dict:
    """Replace the headroom sentence with one composed from the tool results, so it is exact by construction.
    Sentences 1-2 stay the model's (checked above); sentence 3 is the claim most easily blurred."""
    import re
    plus14 = next((t["result"] for t in reversed(trace) if t["tool"] == "simulate_plan"
                   and abs(t["args"].get("demand_mult", 1) - 1.14) < 0.02 and "ontime_rate" in t["result"]), None)
    bp = next((t["result"] for t in reversed(trace) if t["tool"] == "break_point" and "error" not in t["result"]), None)
    if not plus14 or not bp:
        return fix
    s3 = f"If demand runs 14% over forecast it still closes {plus14['ontime_rate']:.0%} of requests on time"
    s3 += (f"; on-time falls below 90% only once demand is {bp['break_pct']}% over forecast."
           if bp.get("break_pct") is not None else ", and it stays above 90% even at 60% over forecast.")
    sents = re.split(r"(?<=[.!?])\s+", fix.get("rationale", "").strip())
    fix["rationale"] = " ".join(sents[:2] + [s3])
    fix["unverified"] = [u for u in fix.get("unverified", []) if "break point" not in u and "+14%" not in u]
    return fix


def _pct_in(text: str, v: float) -> bool:
    import re
    return any(abs(float(m) - v * 100) <= 0.6 for m in re.findall(r"(\d+(?:\.\d+)?)\s*%", text))


def _claim_errors(fix: dict, trace: list[dict]) -> list[str]:
    """Semantic check: each headline claim must equal the specific tool result it comes from."""
    last = {}
    for t in trace:
        r = t["result"]
        if not isinstance(r, dict) or "error" in r:
            continue
        if t["tool"] == "simulate_plan" and abs(t["args"].get("demand_mult", 1) - 1.14) < 0.02:
            last["plus14"] = r
        elif t["tool"] in ("optimize_plan", "do_nothing", "break_point"):
            last[t["tool"]] = r
    errs, text = [], fix.get("rationale", "")
    if "plus14" in last and not _pct_in(text, last["plus14"]["ontime_rate"]):
        errs.append(f"on-time at +14% demand is {last['plus14']['ontime_rate']:.1%} (simulate_plan, demand_mult 1.14)")
    bp = last.get("break_point", {}).get("break_pct")
    if bp is not None and not _pct_in(text, bp / 100):
        errs.append(f"the break point is {bp}% extra demand (break_point)")
    if "optimize_plan" in last and not _pct_in(text, last["optimize_plan"]["ontime_rate"]):
        errs.append(f"the plan's on-time rate at forecast demand is {last['optimize_plan']['ontime_rate']:.1%} (optimize_plan)")
    return errs
