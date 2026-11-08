"""Terry: goal inversion planner for Boston 311 crew staffing.

flip      goal -> inverted failure statement + predator hypotheses   (structured output)
echo      hypotheses -> confirmed / rejected against real data       (data, no LLM)
tools     simulator and data lookups exposed as callable tools       (agent tool use)
hunt      agent prices the fix for each confirmed predator           (agents)
calendar  plan -> dated decisions                                    (data)
report    chain writes the first-person analysis                     (LangChain)
"""
