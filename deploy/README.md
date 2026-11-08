# Bat-Terry on Netlify

The hosted site is the page in `app/` plus `host.js`, which gives the page the two capabilities it uses:

- **sample**: GPT-6.1 Sol (OpenAI Responses API, low reasoning effort), through the site's one function, `/api/llm`.
- **downloads**: a plain browser download.

The OpenAI key lives only in Netlify's environment, never in the page.

## What the function allows

| Limit | Default | Netlify variable |
|---|---|---|
| Whole site, per UTC day | $3.00 of model spend | `TERRY_DAY_USD` |
| One visitor, per UTC day | 60 model rounds (a Ping question is 2 to 6 rounds; a chase is about 5) | `TERRY_VISITOR_CALLS` |

The function keeps the page cheap and safe to share:

- **Prompts:** it forwards only prompts the page itself writes.
- **Origin:** it refuses requests from other websites.
- **Model:** it always uses `gpt-6.1-sol` at low reasoning effort, with at most 4,000 output tokens (reasoning included). A tool round is chained to the previous response, which holds the model's reasoning.

Over a limit, the page answers from its own rules. Ping says "Today's live answers are used up". Nothing breaks.

At GPT-6.1 Sol prices ($2 in, $10 out per million tokens), a Ping question costs about 3 cents (about 8,300 input tokens a question, measured), so $3 a day covers roughly 100 questions.

## Deploy from GitHub (no tools on your computer)

1. On Netlify: Add new site, Import an existing project, GitHub, pick this repo.
2. Base directory: `deploy`. Build command and publish directory are read from `netlify.toml` (`python3 build.py`, `site`).
3. Before the first deploy, add the environment variable `OPENAI_API_KEY` (Site configuration, Environment variables; mark it secret).
4. Deploy. Every push to `main` deploys again.

## Deploy (Netlify CLI, free plan)

```bash
cd deploy
npm install                      # @netlify/blobs, for the daily counters
python3 build.py                 # fills site/ from app/
npx netlify-cli login            # once, opens the browser
npx netlify-cli sites:create --name bat-terry-boston     # once; any free name, gives https://<name>.netlify.app
npx netlify-cli env:set OPENAI_API_KEY sk-...            # once; the key stays in Netlify
npx netlify-cli deploy --prod
```

After any change to `app/`, run `python3 build.py`, then `npx netlify-cli deploy --prod` again.

To switch off live answers without taking the site down, run `npx netlify-cli env:set TERRY_DAY_USD 0.0001` and redeploy. The page keeps working on its rules.

## Files

- `build.py`: copies the page and every file it loads into `site/`, and puts `host.js` first.
- `host.js`: provides `window.terryHost.use("sample" | "downloads")`. It runs the tool loop in the browser, so the tools stay page functions.
- `netlify/functions/llm.mjs`: one model round per call, with the key and the limits.
- `netlify.toml`: tells Netlify where the site and the function are.
