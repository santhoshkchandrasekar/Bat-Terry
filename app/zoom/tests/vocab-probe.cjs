// Probe: ask Ping "What is a flyway?" and print the answer's markup (the term should be wrapped in .tw)
const B = require("../bshoot.cjs"), { sleep } = B, h = require("../b1808-shoot.cjs");
(async () => { await new Promise(r => B.srv.listen(B.PORT, r)); const b = await B.chromium.launch({ args: B.ARGS });
  const p = await B.open(b, { seen: true, noguide: true, w: 1440, h: 900 });
  await h.until(p, () => window.__zoom && __zoom.ready && window.TerryProj && TerryProj.kit, 90000); await sleep(3000);
  await p.click(".dk-in"); await p.fill(".dk-in", "What is a flyway?"); await p.press(".dk-in", "Enter");
  await h.until(p, () => document.querySelector("#dock").dataset.busy !== "1" && /answer/.test(document.querySelector("#dock").dataset.mode), 60000); await sleep(1500);
  console.log(await p.evaluate(() => [document.querySelector("#dock").dataset.mode, (document.querySelector(".dk-text") || {}).innerHTML, [...document.querySelectorAll("#dock .tw")].length]));
  console.log(p.errs); await b.close(); B.srv.close(); process.exit(0); })();
