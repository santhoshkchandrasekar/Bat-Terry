# Demo video: 3 minutes

The brief asks for three things: the product, the architecture, and the part you're most proud of. This script opens
on the flip, the moment nobody else will have, then earns it with the evidence. Record the live Terry page (Flyover) and
the notebook at 1080p. About 400 words fits three minutes. Each teammate should voice at least one section.

---

## 0:00–0:25 · Cold open: the flip (live page, Flyover)

**On screen:** Flyover at rest: the 2025 timeline, crews hanging from the rail, Terry perched on top. Type in the chat:
*"All tickets closed on time in November in Dorchester."* Terry asks which department; tap **Transportation**. Terry
pushes back on 100%; tap **95%**. The timeline shrinks to a branch, Terry flips, the failure appears.

> "This is Terry. A manager gives it a goal, and the first thing Terry does is turn it upside down: it's December 31st,
> and you failed. Then it works out how."

## 0:25–1:10 · The product: echolocation and the escape

**On screen:** predators are named one by one; sonar pings; confirmed ones land on the timeline, rejected ones fall off.

> "Terry names the predators, the specific threats that would cause that failure, and tests every one against 2024's
> real 311 records. Watch this one fall off the branch: the data rejected it. The model proposes; the data decides."

**On screen:** press play. Two paths run through November: stay the course, and Terry's escape. Pause on **Dusk**.

> "Now the year runs. On the left, the plan as it is. On the right, Terry's escape, narrated as it goes. And this line
> is Dusk: the last day you can sign a crew who's working by November. New crews need a month of paid training, so you
> have to act two months before you can feel the problem."

## 1:10–1:40 · Ping

**On screen:** type *"What if snow hits around November 22nd?"*, read Terry's answer, then *"What if 20% of
Transportation crews quit in August?"*

> "Anything can go wrong, so you can ping Terry in plain English. It never guesses how big a storm is: it sizes it from
> the January 2022 blizzard in the data. Then it compares three choices: keep the plan, react when it hits, or prepare
> from January, and says which one still escapes." *(Read the verdict on screen.)*

## 1:40–2:25 · The architecture (notebook)

**On screen:** `docs/architecture.png`, then the notebook's plan table (§4.1) and cash-vs-trust table (§4.6).

> "Underneath: a day-level simulator that encodes every rule in the brief, and an optimizer that plans for the
> forecast's own error, because our first plan broke at just 5% extra demand. The plan spends about three million
> dollars more on crews and avoids over nine million in overdue costs. Every number Terry says comes from the simulator;
> the language model only parses what you type and words the story, and a guardrail checks it."

> "The brief's core AI piece is the intake assistant: a resident's message, in any language, routed to the city's real
> request type with retrieval and structured output. 82% right type on 200 held-out messages, 89% after the Spanish fix."

## 2:25–3:00 · What we're proudest of, and close

**On screen:** Dawn, the scorecard: stay vs escape.

> "What we're proudest of: most plans are a table that's right on January 1st. Terry is a plan that tells you when it's
> failing, and what to do while there's still time. That's Terry."

---

### Before you record
* Open the live page in a desktop browser, dark mode. Use the Netlify address, so live answers are on and the flip is written live.
* Run the exact goal and ping above once before recording and use the numbers on screen; LLM wording varies run to run.
* Check the notebook figures against the final run: the cash vs trust split (§4.6), held-out accuracy (§7).
