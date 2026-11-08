# Reproducibility check

Checked by Harrish Ebi Francis P on 8 November 2026.

## My setup
- Computer and OS: MacBook Air 15-inch (M4, 2025, 16 GB), macOS 27.0 (26A428)
- Python: <3.13.x> (Homebrew), in a virtual environment
- Node: v24.11.1

## What I ran
Cloned santhoshkchandrasekar/Bat-Terry in VS Code (Git: Clone), then in the VS Code terminal from the repo folder:

    python3.13 -m venv .venv
    source .venv/bin/activate
    python -m pip install -r requirements.txt
    python notebooks/build_notebook.py
    cd notebooks
    python -m nbconvert --to notebook --execute --output test_run.ipynb Boston311_Terry.ipynb

Changes from the README commands: I used a virtual environment, and Python 3.13 instead of my default Python 3.15 (see Problems and fixes). No OpenAI key was set, so the AI cells showed their saved results.

Time for the full run: the notebook itself executes in about 13 seconds (12.8 s, measured with `time` on a second run, using the committed notebook after restoring it). Setup took longer: installing Python 3.13 and the packages took roughly <X> minutes.

## Results
| Number | README says | My run | Match? |
| --- | --- | --- | --- |
| Plan cost | $15.62M | $15.62M (Section 4, neutral plan) | Yes |
| Savings | $6.19M | $6.19M less (Section 4; also Section 4.6, vs keeping January's crews) | Yes |
| Transportation crews | 6 by 31 Dec 2024 | Hire +6, decide by 2024-12-31 (Section 6.2 decision calendar; also Section 9 summary) | Yes |
| Intake accuracy | 82.5% | 82.5% on n = 200 (Section 7 table, "held-out v1, first model") | Yes |

Notes on the results:
- The Transportation decision is not stated directly in Section 4. Section 4's crew table shows it indirectly (18 crews in January, 24 in February). The explicit "+6 by 31 Dec 2024" is in the Section 6.2 decision calendar, which is computed by code, and in the Section 9 summary.
- The intake accuracy cell recomputes the score from saved per-message results (CSV files). Without an OpenAI key the classifier was not re-run, so this checks the calculation, not the model's answers. The same table shows 89.0% for the final model on the same 200 messages; the notebook explains that 82.5% is the clean held-out number.

## Problems and fixes
1. **Install failed on Python 3.15.** My default `python3` was Homebrew Python 3.15. `pip install -r requirements.txt` failed on `pydantic-core==2.46.5`, which has no prebuilt package for 3.15, so pip tried to build it from source with Rust. The Rust download then failed with `No space left on device`. Nothing was installed, so `build_notebook.py` failed with `No module named 'nbformat'` and nbconvert was missing.
   **Fix:** Freed some disk space and installed Python 3.13 (`brew install python@3.13`), deleted and recreated the virtual environment with `python3.13 -m venv .venv`, and reinstalled. Everything then installed and ran.
   **Suggestion:** The README should say Python 3.12 or 3.13, not "3.12 or newer". Python 3.15 does not work with the current requirements.

2. **Warning during the run:** nbconvert printed `Kernel is running over TCP without encryption`. This is a harmless local Jupyter warning and had no effect on the results.

3. **Build script overwrites the committed notebook.** Running `python notebooks/build_notebook.py` rewrote `notebooks/Boston311_Terry.ipynb`. Git showed a large change: 248 insertions, 6486 deletions. My guess is that the build script produces a notebook without the saved outputs that the committed version has, but I have not confirmed this. I did not commit the change and restored the file with `git restore`. My first nbconvert run used the regenerated notebook, and the four numbers matched. Since the README's steps include this script, a TA following them would also overwrite the submitted notebook. The README says this notebook has "every cell run, all outputs visible", so running the build script as the README instructs would undo that. It may be safer for the script to write to a different file name.