# Review artefacts

Independent checks that back claims in the notebook and README.

| File | What it is |
|---|---|
| `model_ruling.md` | Independent ruling on planning under uncertainty: scenario nodes, modes as service floors, the year-end backlog cost, Parks seasonal crews, ISD process lateness. The optimizer and simulator implement its checklist. |
| `full_plan_v1.log` | Results of the first (point-forecast) plan, kept as evidence of why it was replaced: it broke at +5% demand. |
| `ambiguous_to_label.csv`, `routing_targets.csv` | Inputs given to the blind labeler (no model predictions). |
| `ambiguous_labels.csv` | Blind labels for the 40 vague test messages (18 need a follow-up question, 22 are routable). |
| `forecast_backtest_winner.txt` | Backtest error of the chosen forecast, as given to the reviewer. |
| `final_review.md` | Pre-submission review of the whole deliverable, with the fixes it asked for. |
