# Notebook progress (IE 5374 Boston 311)

Build: `python3 notebooks/build_notebook.py` then
`python3 -m nbconvert --to notebook --execute --inplace notebooks/Boston311_Terry.ipynb` (keys load from gitignored config/llm.local via terry.llm.load_keys).

## 2026-11-04
- [x] §8.1 "Two sides of the coin" added to build_notebook.py (quadrant scatter, loop test, findings, conclusion); method from app/zoom/redesign/loop_test_draft.py, numbers verified identical to the draft's output.
- [x] §6.6 Ping eval: node notebooks/ping_eval.cjs --json runs (40 q, all 100%).
- [x] Fix: §6.6 overwrote S (plans) with the ping summary, breaking §9; renamed to PS.
- [x] Full rebuild + execute end to end: 80 cells, 45 code, 0 errors, all outputs, 71 s, live OpenAI key (LLM cells live)
- [x] Dash check (none in §8.1 text or outputs), committed
