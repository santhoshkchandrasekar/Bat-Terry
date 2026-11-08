"""Build the knowledge base Ping Terry retrieves from.

    python3 -I app/zoom/build_kb.py        writes app/zoom/kb.json and app/zoom/kb.js

Sources (nothing is invented here, the text is only cut and cleaned):
  docs/analysis_report.md   the headline, the four department sections and the decisions
  README.md                 Headlines, The Terry page, Key modeling decisions
  app/zoom/kb_glossary.md   one chunk per glossary entry (written from the engine code and the notebook); an "Aliases:" line under
                            a heading holds search words for that entry, indexed but never shown

A chunk is 150 to 250 words with a title and a source label. A glossary entry that is shorter than 150 words stays whole,
because a citation should point at one term. kb.js is the same data as a script, so the page needs no extra network call.
"""
import json
import math
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
MAX_WORDS = 250


def clean(text: str) -> str:
    text = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", text)          # links
    text = text.replace("`", "").replace("**", "")
    text = re.sub(r"(?<!\w)\*(?=\S)([^*\n]+?)(?<=\S)\*(?!\w)", r"\1", text)   # *italic*
    text = text.replace("—", ", ").replace("–", " to ").replace("--", ", ")
    text = re.sub(r"\s+,", ",", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


def table_to_text(rows):
    cells = [[c.strip() for c in r.strip().strip("|").split("|")] for r in rows]
    head, body = cells[0], [r for r in cells[2:]]
    out = []
    if head[0] == "plan" and head[1].startswith("expected cost"):      # the headline cost table reads better as sentences
        return [f"The {r[0]} plan has an expected cost of ${r[1]}M." for r in body]
    for r in body:
        pairs = [f"{h} {v}" for h, v in zip(head[1:], r[1:]) if v]
        if pairs:
            out.append(f"{r[0]} ({head[0]}): " + ", ".join(pairs) + ".")
    return out


def paragraphs(body: str):
    """Split a section body into paragraph units: prose paragraphs, list items, table rows."""
    units, lines, i = [], body.split("\n"), 0
    cur = []
    def flush():
        nonlocal cur
        if cur:
            units.append(" ".join(cur)); cur = []
    while i < len(lines):
        ln = lines[i]
        if ln.strip().startswith("|"):
            flush(); tbl = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                tbl.append(lines[i]); i += 1
            units.extend(table_to_text(tbl)); continue
        if ln.strip().startswith("```"):                           # skip code blocks
            flush(); i += 1
            while i < len(lines) and not lines[i].strip().startswith("```"):
                i += 1
            i += 1; continue
        if not ln.strip():
            flush()
        elif re.match(r"^\s*(\*|-|\d+\.)\s+", ln) and not ln.startswith("  "):
            flush(); cur = [re.sub(r"^\s*(\*|-|\d+\.)\s+", "", ln).strip()]
        else:
            cur.append(ln.strip())
        i += 1
    flush()
    return [clean(u) for u in units if clean(u)]


def sentences(p):
    return re.findall(r"(?s).+?[.!?]+[\"')]*(?=\s|$)|.+$", p)


def pack(units, max_words=MAX_WORDS):
    """Greedy pack of units into balanced chunks of at most max_words."""
    flat = []
    for u in units:                      # sentences, so chunks can be balanced; a table row sentence stays whole
        flat.extend(s.strip() for s in sentences(u) if s.strip())
    total = sum(len(u.split()) for u in flat)
    n = max(1, math.ceil(total / max_words))
    target = total / n
    chunks, cur, w = [], [], 0
    for u in flat:
        uw = len(u.split())
        if cur and (w + uw > max_words or (w >= target and len(chunks) < n - 1)):
            chunks.append(" ".join(cur)); cur, w = [], 0
        cur.append(u); w += uw
    if cur:
        chunks.append(" ".join(cur))
    return chunks


def sections(md: str, level: str):
    """Yield (heading, body) for headings that start with `level` (e.g. '## ')."""
    parts = re.split(rf"(?m)^({re.escape(level)}[^\n]*)\n", md)
    for k in range(1, len(parts), 2):
        yield parts[k][len(level):].strip(), parts[k + 1]


def slug(s):
    s = s.replace("'", "")
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def add(chunks, source, key, title, units, keep_whole=False):
    texts = [" ".join(units)] if keep_whole and sum(len(u.split()) for u in units) <= MAX_WORDS else pack(units)
    for j, t in enumerate(texts, 1):
        suffix = f" ({j})" if len(texts) > 1 else ""
        chunks.append({"id": f"{key}-{slug(title)}" + (f"-{j}" if len(texts) > 1 else ""), "title": title + suffix, "source": source, "text": t, "words": len(t.split())})


def build():
    chunks = []
    # --- the analysis report
    rep = (ROOT / "docs/analysis_report.md").read_text()
    rep = re.sub(r"(?m)^\*(Built from|Figures placed by code)[^\n]*\n", "", rep)
    rep = re.sub(r"(?m)^\*Terry's flip[^\n]*?:\*\s*", "Terry's flip, the imagined failure built from 2024 figures: ", rep)
    for h2, body in sections(rep, "## "):
        h2 = re.sub(r"\s*\[[^\]]*\]", "", re.sub(r"^\d+\.\s*", "", h2))
        if h2 == "Department sections":
            for h3, b3 in sections(body, "### "):
                add(chunks, "Analysis report", "report", h3, paragraphs(b3))
        else:
            add(chunks, "Analysis report", "report", {"Headline": "The 2025 plan and its cost", "Decisions, assumptions and limitations": "Decisions and limitations"}.get(h2, h2), paragraphs(body))
    # --- the README's method parts
    rd = (ROOT / "README.md").read_text()
    for h2, body in sections(rd, "## "):
        if h2 in ("Headlines", "The Terry page", "Key modeling decisions"):
            add(chunks, "README", "readme", {"Headlines": "Headline results", "The Terry page": "The Terry page"}.get(h2, h2), paragraphs(body))
    # --- the glossary: one chunk per entry
    gl = (OUT / "kb_glossary.md").read_text()
    for h2, body in sections(gl, "## "):
        m = re.search(r"(?m)^Aliases:\s*(.+)$", body)          # retrieval hints, indexed but never shown
        before = len(chunks)
        add(chunks, "Glossary", "glossary", h2, paragraphs(re.sub(r"(?m)^Aliases:.*$", "", body)), keep_whole=True)
        if m:
            for c in chunks[before:]:
                c["aliases"] = m.group(1).strip()
    return chunks


def check(chunks):
    bad = []
    seen = set()
    for c in chunks:
        if c["id"] in seen: bad.append(f"duplicate id {c['id']}")
        seen.add(c["id"])
        for pat, why in ((r"[—–]|--", "dash"), (r"\bAI\b", "AI"), (r"(?i)generated", "generated"), (r"(?i)\bLLM\b", "LLM"), (r"[`*|]", "markdown")):
            if re.search(pat, c["text"] + " " + c["title"]):
                bad.append(f"{c['id']}: {why}")
    return bad


if __name__ == "__main__":
    ch = build()
    bad = check(ch)
    if bad:
        sys.exit("kb check failed:\n  " + "\n  ".join(bad))
    kb = {"version": 1, "chunks": ch}
    (OUT / "kb.json").write_text(json.dumps(kb, indent=1, ensure_ascii=False) + "\n")
    (OUT / "kb.js").write_text("/* Built by build_kb.py from the analysis report, the README and kb_glossary.md. Do not edit. */\n"
                                "(function (r) { r.TerryKB = " + json.dumps(kb, ensure_ascii=False) + "; })(typeof window !== \"undefined\" ? window : globalThis);\n")
    ws = [c["words"] for c in ch]
    print(f"{len(ch)} chunks, words min {min(ws)} median {sorted(ws)[len(ws)//2]} max {max(ws)}")
    for c in ch:
        print(f"  {c['words']:4d}  {c['id']}")
