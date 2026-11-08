"""One place for model access. Reads config/llm.local (gitignored) or the environment."""
from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODEL = os.environ.get("TERRY_MODEL", "gpt-4o-mini")


def load_keys() -> None:
    p = ROOT / "config" / "llm.local"
    if p.exists():
        for line in p.read_text().splitlines():
            if "=" in line and not line.startswith("#"):
                k, v = line.strip().split("=", 1)
                os.environ.setdefault(k, v)


def client():
    load_keys()
    from openai import OpenAI
    return OpenAI()


def parse(messages, schema, model: str = MODEL, temperature: float = 0.2):
    """Structured output: the model must return an instance of `schema` (a pydantic model)."""
    r = client().beta.chat.completions.parse(
        model=model, messages=messages, response_format=schema, temperature=temperature)
    return r.choices[0].message.parsed
