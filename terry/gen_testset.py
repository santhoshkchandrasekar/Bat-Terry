"""Generate a held-out adversarial test set for the intake assistant.

Independence rules, so the score means something:
  - the generator is a different model (gpt-4o) from the classifier (gpt-4o-mini)
  - it sees only the city's own data for a type (name, reason, real case titles), never the
    resident-language descriptions that sit in the retrieval index
  - the set is generated once, frozen to data/tests/intake_heldout.csv, and never used for tuning

Mix (200 messages):
  120 types sampled by real 2024 frequency (what the call center actually sees)
   40 types sampled uniformly (rare types get tested too)
   40 ambiguous messages whose right answer is a follow-up question (expected_type = ASK)
Each type message gets a random style tier: clear, messy (typos, slang, no punctuation),
spanish, or compound (one main problem plus irrelevant detail).

Usage: python3 -m terry.gen_testset
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
from pydantic import BaseModel

from . import data
from .intake import catalog
from .llm import parse

OUT = data.ROOT / "data" / "tests" / "intake_heldout.csv"
GEN_MODEL = "gpt-4o"
STYLES = {
    "clear": "a clear, polite one- or two-sentence report",
    "messy": "a messy text-message style report: lowercase, typos, slang, no punctuation, a street name",
    "spanish": "a report written entirely in Spanish, as a Boston resident would type it",
    "compound": "a report with the main problem plus irrelevant personal detail or venting (but only ONE problem to fix)",
}


class Msg(BaseModel):
    message: str


class Ambig(BaseModel):
    messages: list[str]


def type_card(r) -> str:
    return (f"Request type: {r.type}\nDepartment: {data.DEPT_NAMES[r.department]}\nCity reason category: {r.reason}\n"
            f"Real internal case titles: {str(r.sample_titles)[:200]}")


def main(seed: int = 7, out=None, n_freq: int = 120, n_uniform: int = 40, ambiguous: bool = True):
    global OUT
    if out:
        OUT = out
    rng = np.random.default_rng(seed)
    cat = catalog().reset_index(drop=True)
    p = cat["count"].values / cat["count"].sum()
    picks = list(rng.choice(len(cat), size=n_freq, p=p)) + list(rng.choice(len(cat), size=n_uniform))
    rows = []
    for i, idx in enumerate(picks):
        r = cat.iloc[idx]
        style = rng.choice(list(STYLES))
        sys = ("You write realistic messages that Boston residents send to 311. Write ONE message for the request type "
               f"below, as {STYLES[style]}. Do not use the type's name verbatim. Make it sound like a real person.")
        m = parse([{"role": "system", "content": sys}, {"role": "user", "content": type_card(r)}], Msg,
                  model=GEN_MODEL, temperature=0.9)
        rows.append({"id": i + 1, "tier": style, "sampling": "frequency" if i < n_freq else "uniform",
                     "message": m.message.strip(), "expected_type": r.type, "expected_department": r.department,
                     "also_ok": ""})
        if (i + 1) % 20 == 0:
            print(f"{i + 1}/{len(picks)}")
    if not ambiguous:
        df = pd.DataFrame(rows)
        Path(OUT).parent.mkdir(parents=True, exist_ok=True)
        df.to_csv(OUT, index=False)
        print(f"wrote {len(df)} messages to {OUT}")
        return
    sys = ("Write 40 short messages a Boston resident might send to 311 that are genuinely ambiguous: a city "
           "dispatcher could not route them without asking one question. Mix: messages that name only an object "
           "(a tree, a sign, trash, a light) without saying what is wrong; messages with two unrelated problems; "
           "questions rather than reports; messages that could be private property or public. Vary tone and length.")
    a = parse([{"role": "system", "content": sys}, {"role": "user", "content": "Write them."}], Ambig,
              model=GEN_MODEL, temperature=0.9)
    for j, msg in enumerate(a.messages[:40]):
        rows.append({"id": 161 + j, "tier": "ambiguous", "sampling": "ambiguous", "message": msg.strip(),
                     "expected_type": "ASK", "expected_department": "", "also_ok": ""})
    df = pd.DataFrame(rows)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUT, index=False)
    print(f"wrote {len(df)} messages to {OUT}")
    print(df.groupby(["sampling", "tier"]).size().to_string())


if __name__ == "__main__":
    main()
