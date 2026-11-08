"""Voice: the analysis report, in each manager's first person.

Design: code places every figure; the LLM writes the interpretation.
  - Opening: Terry's flipped sentence for the department (already checked against the data by flip.py).
  - "What the data shows" and "what I'd watch": written by a LangChain chain with structured output, from
    pre-formatted facts that each carry their scope ("full year 2024, citywide").
  - The plan paragraph (decisions, costs, scenarios, break point): assembled from the model outputs in code.
Guardrails on the LLM-written parts: every number must match a fact (within rounding), and a second chain (critic)
lists claims the facts do not support. Either triggers one rewrite; anything still flagged is returned with the text.
"""
from __future__ import annotations

import json
import re

from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

from .llm import MODEL, load_keys

NUM = re.compile(r"\$?\d[\d,]*\.?\d*\s*(?:%|[kKmM]\b)?")


def _llm(t=0.2):
    load_keys()
    return ChatOpenAI(model=MODEL, temperature=t)


# ---------------------------------------------------------------- number check
def _parse(s: str):
    s = s.strip()
    mult = 1.0
    if s.endswith("%"):
        s = s[:-1]
    elif s[-1:] in "kK":
        mult, s = 1e3, s[:-1]
    elif s[-1:] in "mM":
        mult, s = 1e6, s[:-1]
    s = s.replace("$", "").replace(",", "").strip()
    try:
        return float(s) * mult
    except ValueError:
        return None


def _numbers_in_facts(obj) -> list[float]:
    out = []

    def walk(o):
        if isinstance(o, bool):
            return
        if isinstance(o, (int, float)):
            out.append(float(o))
        elif isinstance(o, str):
            for m in NUM.finditer(o):
                v = _parse(m.group())
                if v is not None:
                    out.append(v)
        elif isinstance(o, dict):
            for v in o.values():
                walk(v)
        elif isinstance(o, (list, tuple)):
            for v in o:
                walk(v)
    walk(obj)
    return out


def unverified_numbers(text: str, facts) -> list[str]:
    """Numbers in `text` that match no fact within rounding (2%, or abs 0.6), allowing % <-> fraction."""
    pool = _numbers_in_facts(facts)
    pool += [v * 100 for v in pool if 0 < abs(v) <= 1.5]
    pool += list(range(2020, 2031)) + list(range(1, 32))
    bad = []
    for m in NUM.finditer(text):
        raw = m.group().strip()
        v = _parse(raw)
        if v is None:
            continue
        if not any(abs(v - p) <= max(0.6, 0.02 * abs(p)) for p in pool):
            bad.append(raw)
    return bad


# ---------------------------------------------------------------- critic
class Critique(BaseModel):
    unsupported_claims: list[str] = Field(description="Claims in the TEXT that the FACTS do not support or that contradict "
                                                      "them, each quoted briefly with the reason. Empty if none.")


CRITIC = ChatPromptTemplate.from_messages([
    ("system",
     "You fact-check two short paragraphs of a city staffing report against FACTS. List only real problems: a figure "
     "attached to the wrong place, period or thing; a cause, event or decision the facts do not state; a comparison the "
     "facts say is not comparable. Rounding is fine (90.4% written as 90% is correct). Paraphrase is fine. Opinions "
     "phrased as the manager's intent ('I will watch...') are fine if they follow from the facts. Wording such as 'a total "
     "of 3,802 X requests' that quotes one figure from FACTS is fine; flag a total only if it adds figures together. Linking a "
     "type's late requests to the cost of those late requests ('costing $420k', 'resulting in a cost of $261k') is what that "
     "field means and is fine."),
    ("human", "FACTS:\n{facts}\n\nTEXT:\n{text}"),
])


def critique(text: str, facts_json: str) -> list[str]:
    chain = CRITIC | _llm(0).with_structured_output(Critique)
    return chain.invoke({"facts": facts_json, "text": text}).unsupported_claims


# ---------------------------------------------------------------- the writer
class Narrative(BaseModel):
    data_paragraph: str = Field(description="2-3 sentences, first person: what the 2024 evidence shows about where this "
                                            "department's requests go late, quoting figures with their scope exactly as given")


WRITER = ChatPromptTemplate.from_messages([
    ("system",
     "You are Terry, writing in the first person ('I') as the {dept_name} manager of the City of Boston, for a 2025 crew "
     "staffing report. Write one paragraph on what the 2024 evidence shows: where requests went late and what it cost. "
     "Write plainly, like a capable public manager, no hype. Use ONLY the FACTS. Copy every figure exactly as formatted, "
     "together with its scope (for example 'in 2024, citywide'). Never move a figure to a different place, period or "
     "request type. Give a cost as 'at the brief's rates'. Quote each figure on its own; do not add figures together or call one a total. Do not explain causes "
     "unless a FACTS 'note' states them. No em dashes.{correction}"),
    ("human", "FACTS:\n{facts}"),
])


def _narrative(dept_name: str, facts: dict, correction: str = "") -> Narrative:
    chain = WRITER | _llm(0.2).with_structured_output(Narrative)
    return chain.invoke({"dept_name": dept_name, "facts": json.dumps(facts, indent=1), "correction": correction})


def _plain(text: str) -> str:
    """Wording fix before the checks: one quoted figure is never 'a total' (the critic reads that as a sum), no dashes."""
    text = re.sub(r"\b[Aa] total of\s+", "", text)
    text = re.sub(r"\btotal(?:l?ed|ling|ing)\b", "came to", text)
    return re.sub(r"\s*[\u2014\u2013]\s*", ", ", text)


def write_section(dept_name: str, narrative_facts: dict, opening: str, plan_paragraph: str,
                  watch_paragraph: str) -> tuple[str, list[str]]:
    """Opening (Terry's flip), LLM data paragraph (checked), code-built plan and watch paragraphs."""
    fj = json.dumps(narrative_facts, indent=1)
    text = _plain(_narrative(dept_name, narrative_facts).data_paragraph)
    bad, claims = unverified_numbers(text, narrative_facts), critique(text, fj)
    if bad or claims:
        notes = ([f"numbers not in FACTS: {', '.join(bad)}"] if bad else []) + \
                (["unsupported: " + " | ".join(claims)] if claims else [])
        text = _narrative(dept_name, narrative_facts, correction=" A fact-checker rejected your previous draft ("
                          + "; ".join(notes) + "). Fix those problems.").data_paragraph
        text = _plain(text)
        bad, claims = unverified_numbers(text, narrative_facts), critique(text, fj)
    body = f"*Terry's flip (the imagined failure, built from 2024 figures):* \"{opening}\"\n\n{text}\n\n{plan_paragraph}\n\n{watch_paragraph}"
    return body, bad + [f"claim: {c}" for c in claims]


class Summary(BaseModel):
    paragraph: str = Field(description="4-6 sentences for the city's operations director")


SUMMARY = ChatPromptTemplate.from_messages([
    ("system",
     "You are Terry, writing the executive summary of a 2025 crew staffing plan for four Boston departments, for the "
     "city's operations director. Lead with the single most important decision. Copy every figure exactly as formatted "
     "in FACTS. Use ONLY the FACTS; respect the 'meaning' notes.{correction}"),
    ("human", "FACTS:\n{facts}"),
])


def write_summary(facts: dict) -> tuple[str, list[str]]:
    fj = json.dumps(facts, indent=1)
    chain = SUMMARY | _llm(0.2).with_structured_output(Summary)
    text = chain.invoke({"facts": fj, "correction": ""}).paragraph
    bad, claims = unverified_numbers(text, facts), critique(text, fj)
    if bad or claims:
        notes = ([f"numbers not in FACTS: {', '.join(bad)}"] if bad else []) + \
                (["unsupported: " + " | ".join(claims)] if claims else [])
        text = chain.invoke({"facts": fj, "correction": " A fact-checker rejected your previous draft (" + "; ".join(notes)
                             + "). Fix those problems."}).paragraph
        bad, claims = unverified_numbers(text, facts), critique(text, fj)
    return text, bad + [f"claim: {c}" for c in claims]
