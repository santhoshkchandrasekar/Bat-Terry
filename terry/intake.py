"""311 intake assistant: a resident's sentence -> request type, department, queue.

Techniques: RAG (retrieve candidate types with embeddings over type names plus their real
case titles), structured output (the answer is a pydantic object), prompt engineering
(the model must pick from the retrieved candidates or ask a follow-up).

Why retrieve first: 163 types with their messy titles is too much to put in every prompt,
and the model picks better from 8 good candidates than from 163 mixed ones.
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Literal, Optional

import numpy as np
import pandas as pd
from pydantic import BaseModel, Field

from . import data
from .llm import client, parse

EMB_MODEL = "text-embedding-3-small"
CACHE = data.P / "type_embeddings.npy"
TOP_K = 8
MIN_USES = 25
PRIOR_WEIGHT = 0.0005  # popularity prior in the fused score: common types win close calls


class Intake(BaseModel):
    request_type: Optional[str] = Field(description="Exact type from the candidates, or null if a follow-up is needed")
    department: Optional[Literal["PWDx", "BTDT", "PARK", "ISD"]] = None
    queue: Optional[str] = None
    confidence: float = Field(ge=0, le=1)
    follow_up: Optional[str] = Field(description="One short question to ask the resident when the message is unclear, else null")
    reasoning: str = Field(description="One sentence")


@lru_cache
def catalog() -> pd.DataFrame:
    """One row per (type, department, queue): the real routing targets, with sample titles for retrieval."""
    t = data.types()
    t = t[t.department.isin(data.DEPT_NAMES)].copy()
    # Several types are routed to one district crew per area (e.g. potholes: 12 'PWDx_District ...' queues).
    # Collapse those so the reported queue is the real routing, not the largest single district.
    import re
    t["queue"] = t.queue.str.replace(r"_District \w+:.*$|_District \d+$", "_District crew (by location)", regex=True)
    # Dominant queue per type, with the share of that type it actually handles
    q = t.groupby(["type", "department", "queue"], as_index=False)["count"].sum()
    q["share"] = q["count"] / q.groupby("type")["count"].transform("sum")
    best_q = q.sort_values("count", ascending=False).drop_duplicates("type").set_index("type")
    tot = t.groupby("type")["count"].sum()
    # One routing target per type: its dominant department and queue (a few types appear in two
    # departments, e.g. Tree Maintenance in Parks 12,443 times and Public Works 479 times)
    t = t.sort_values("count", ascending=False).drop_duplicates(["type"]).copy()
    t["department"] = t.type.map(best_q.department)
    t["queue"] = t.type.map(best_q.queue)
    t["queue_share"] = t.type.map(best_q.share).round(2)
    t["count"] = t.type.map(tot)
    # The brief asks for a short, de-duplicated list. Types used fewer than MIN_USES times in
    # 2023-24 (e.g. 'BWSC Pothole', 2 uses) are noise routing targets; dropping them keeps 99.9% of requests.
    t = t[t["count"] >= MIN_USES]
    desc_path = data.P / "type_descriptions.csv"
    if desc_path.exists():  # resident-language descriptions written once by an LLM (describe_types.py)
        d = pd.read_csv(desc_path).fillna("")
        t = t.merge(d, on="type", how="left").fillna({"description": "", "examples": "", "not_this": ""})
    else:
        t["description"], t["examples"] = "", ""
    t["doc"] = (t.type + ". " + t.description + " Residents say: " + t.examples
                + ". City labels: " + t.sample_titles.fillna("")).str.slice(0, 900)
    return t.reset_index(drop=True)


def _embed(texts: list[str]) -> np.ndarray:
    out = client().embeddings.create(model=EMB_MODEL, input=texts)
    v = np.array([e.embedding for e in out.data], dtype=np.float32)
    return v / np.linalg.norm(v, axis=1, keepdims=True)


@lru_cache
def index() -> np.ndarray:
    if CACHE.exists():
        v = np.load(CACHE)
        if len(v) == len(catalog()):
            return v
    v = _embed(catalog().doc.tolist())
    np.save(CACHE, v)
    return v


@lru_cache
def _bm25():
    from rank_bm25 import BM25Okapi
    return BM25Okapi([_tok(d) for d in catalog().doc])


def _tok(s: str) -> list[str]:
    import re
    return re.findall(r"[a-z0-9]+", s.lower())


def retrieve(message: str, k: int = TOP_K) -> pd.DataFrame:
    """Hybrid retrieval: dense (embeddings) and sparse (BM25) ranks fused with reciprocal rank fusion."""
    q = _embed([message])[0]
    dense = index() @ q
    sparse = _bm25().get_scores(_tok(message))
    r_dense = np.argsort(np.argsort(-dense))
    r_sparse = np.argsort(np.argsort(-sparse))
    fused = 1 / (60 + r_dense) + 1 / (60 + r_sparse) + PRIOR_WEIGHT * np.log10(catalog()["count"].values)
    top = np.argsort(-fused)[:k]
    c = catalog().iloc[top].copy()
    c["score"] = fused[top]
    return c


SYSTEM = """You are the Boston 311 intake assistant. A resident describes a problem in plain language.
Pick the single best request type from the candidates (they are the city's real routing targets, retrieved for this message).
Copy request_type, department and queue exactly from the candidate you choose.
If the message could reasonably be two different candidates, or lacks a detail that changes the routing
(for example whether a tree is on a street or in a park, or whether trash was missed or is improperly stored),
set request_type to null and ask ONE short follow-up question. Confidence is your honest probability that the chosen type is right.
Each candidate shows how often the city used it in 2023-24. When two candidates both fit, prefer the common one unless
the message is specific to the rare one (a 'BWSC' type is Water and Sewer; a street pothole is 'Request for Pothole Repair').
A vague message that names only a thing (a tree, a sign, trash) and not what is wrong with it needs a follow-up.
Praise, opinions or policy comments with no problem to fix go to 'General Comments For a Program or Policy'."""


class Rewrite(BaseModel):
    problem: str = Field(description="The problem in plain English, 5-15 words, no address, no venting")
    problem_is_stated: bool = Field(description="False if the message only names a thing, asks a policy question, "
                                                "or could be private vs public in a way that changes who handles it")


REWRITE = """Rewrite a resident's 311 message as a short plain-English statement of the problem to fix.
Translate if it is not in English. Drop greetings, addresses, venting and irrelevant detail.
Say what is wrong with what (e.g. 'streetlight not working', 'car parked during street cleaning',
'car not moved in weeks, may be abandoned'). Set problem_is_stated honestly."""


def rewrite(message: str) -> Rewrite:
    return parse([{"role": "system", "content": REWRITE}, {"role": "user", "content": message}], Rewrite, temperature=0)


def classify(message: str, k: int = TOP_K, use_rewrite: bool = True) -> tuple[Intake, pd.DataFrame]:
    """Query rewriting -> hybrid retrieval -> structured choice among candidates."""
    rw = rewrite(message) if use_rewrite else None
    # Union retrieval: the original message keeps English detail; the rewrite rescues other
    # languages and rambling messages (A/B on held-out v2: rewrite-only helped Spanish +18 pts
    # but cost English a little, so we retrieve with both and keep the best of each).
    cands = retrieve(message, k)
    if rw:
        extra = retrieve(rw.problem, k)
        cands = (pd.concat([cands, extra]).sort_values("score", ascending=False)
                   .drop_duplicates("type").head(k + 4))
    cand_text = "\n".join(
        f"- type: {r.type} | department: {r.department} | queue: {r.queue} | used {r.count:,} times in 2023-24 | "
        f"typical titles: {str(r.sample_titles)[:140]}"
        for r in cands.itertuples())
    msgs = [{"role": "system", "content": SYSTEM},
            {"role": "user", "content": f"Resident message: \"{message}\"\n"
             + (f"Plain-English problem: {rw.problem}\nProblem clearly stated: {rw.problem_is_stated}\n" if rw else "")
             + f"\nCandidates:\n{cand_text}"}]
    out = parse(msgs, Intake, temperature=0)
    if out.request_type and out.request_type.strip().lower() in {"null", "none", ""}:
        out.request_type = None
    if out.request_type and out.request_type not in set(cands.type):  # must come from the candidates
        out.follow_up = out.follow_up or "Could you say a little more about the problem?"
        out.request_type, out.department, out.queue = None, None, None
    return out, cands


def evaluate(test_path: Path | str, k: int = TOP_K, verbose: bool = True) -> pd.DataFrame:
    """Run the test set. A row is correct when the predicted type matches; a follow-up counts as
    correct only if the expected answer is also a follow-up (expected_type == 'ASK')."""
    tests = pd.read_csv(test_path)
    rows = []
    for t in tests.itertuples():
        pred, cands = classify(t.message, k)
        retrieved = t.expected_type in set(cands.type) or t.expected_type == "ASK"
        also_ok = set(str(getattr(t, "also_ok", "")).split("|")) - {"", "nan"}
        if pred.request_type is None:
            correct = t.expected_type == "ASK" or "ASK" in also_ok
        else:
            correct = pred.request_type == t.expected_type or pred.request_type in also_ok
        dept_ok = (pred.department == t.expected_department) if (pred.department and t.expected_type != "ASK") else None
        # Queue accuracy: what actually routes the request. Same queue = same crew picks it up.
        cat = catalog().set_index("type")
        exp_q = cat.queue.get(t.expected_type) if t.expected_type != "ASK" else None
        queue_ok = correct or (pred.queue is not None and exp_q is not None and pred.queue == exp_q)
        rows.append({"id": t.id, "tier": t.tier, "message": t.message, "expected": t.expected_type,
                     "predicted": pred.request_type, "asked": pred.follow_up, "confidence": pred.confidence,
                     "retrieved": retrieved, "type_correct": correct, "queue_correct": queue_ok, "dept_correct": dept_ok})
        if verbose:
            mark = "ok " if correct else "XX "
            print(f"{mark} [{t.tier}] {t.message[:60]!r} -> {pred.request_type or 'ASK: ' + str(pred.follow_up)} ({pred.confidence:.2f})")
    r = pd.DataFrame(rows)
    print(f"\nType accuracy: {r.type_correct.mean():.1%}  |  Queue accuracy: {r.queue_correct.mean():.1%}  |  "
          f"Department accuracy: {r.dept_correct.dropna().mean():.1%}  |  Retriever recall@{k}: {r.retrieved.mean():.1%}")
    g = r.groupby("tier").agg(type_acc=("type_correct", "mean"), queue_acc=("queue_correct", "mean"), n=("id", "size"))
    print(g.round(3).to_string())
    return r
