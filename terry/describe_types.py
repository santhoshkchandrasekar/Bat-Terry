"""One-time LLM pass over the 163 request types: plain-language descriptions and example
resident phrasings, so retrieval matches how people talk, not how the CRM labels things.

Technique: structured output in batches. Output cached to data/processed/type_descriptions.csv.
Usage: python3 -m terry.describe_types
"""
from __future__ import annotations

import pandas as pd
from pydantic import BaseModel

from . import data
from .intake import catalog
from .llm import parse

OUT = data.P / "type_descriptions.csv"


class TypeDesc(BaseModel):
    type: str
    description: str          # one sentence, what problem this covers, in resident words
    examples: list[str]       # 4 short things a resident might type, varied wording
    not_this: str             # one phrase: a nearby type people confuse it with, or ""


class Batch(BaseModel):
    items: list[TypeDesc]


SYSTEM = """You write plain-language descriptions of Boston 311 request types for a search index.
For each type you are given its internal name, department, the city's own reason category, sample internal
case titles (messy, may contain codes), and a few sibling types in the same department.
Write how a RESIDENT would describe the problem, not how the city labels it. Examples must be varied, casual,
and specific (streets, objects, what's wrong). Keep the 'type' string exactly as given."""


def run(batch_size: int = 15) -> pd.DataFrame:
    cat = catalog()
    rows = []
    for i in range(0, len(cat), batch_size):
        chunk = cat.iloc[i:i + batch_size]
        text = "\n\n".join(
            f"type: {r.type}\ndepartment: {data.DEPT_NAMES[r.department]}\nreason: {r.reason}\n"
            f"sample titles: {str(r.sample_titles)[:200]}\nsiblings: "
            + ", ".join(cat[(cat.department == r.department) & (cat.type != r.type)].type.head(6))
            for r in chunk.itertuples())
        b = parse([{"role": "system", "content": SYSTEM}, {"role": "user", "content": text}], Batch)
        got = {d.type: d for d in b.items}
        for r in chunk.itertuples():
            d = got.get(r.type)
            rows.append({"type": r.type, "description": d.description if d else "", "examples": " | ".join(d.examples) if d else "",
                         "not_this": d.not_this if d else ""})
        print(f"{min(i + batch_size, len(cat))}/{len(cat)}")
    df = pd.DataFrame(rows)
    df.to_csv(OUT, index=False)
    return df


if __name__ == "__main__":
    df = run()
    print(df.head(8).to_string())
