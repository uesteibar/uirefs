#!/usr/bin/env node
// Frame-by-frame comparison of a demo against the clip it recreates.
//
//   node frame-compare.mjs --demo demo.html --clip clip.mp4 --actions actions.json --out cmp \
//        [--start 4.2] [--dur 2] [--fps 30] [--crop W:H:X:Y] [--demo-crop X:Y:W:H] \
//        [--viewport 900x700] [--frames 8 | --at 0,0.1,0.25,0.5] [--tile 320x320] [--offset 0] [--webgl] [--direct] [--autoplay]
//
// What it does
//   1. Cuts `--dur` seconds of the clip, starting at `--start`, into frames at `--fps` (ffmpeg).
//      `--crop` is ffmpeg's crop=W:H:X:Y in clip pixels: use it to cut away the page around the subject.
//   2. Opens the demo in a sandboxed iframe (opaque origin, like the library's viewer; `--direct` loads it as a file).
//   3. Replays `actions.json` with real input events while recording the page (CDP screencast, with the
//      browser's own frame timestamps), then picks, for every clip frame time, the last demo frame shown by then.
//      `--demo-crop` crops the demo frames in CSS pixels.
//   4. Writes <out>/strip.png: the clip on the top row, the demo on the bottom row, same moments left to right.
//      Also <out>/report.json with the demo frame time chosen for each tile.
//
// actions.json: a list of steps, `t` in ms from the first action.
//   {"t":0,   "type":"move",  "x":120, "y":300}
//   {"t":200, "type":"move",  "x":400, "y":300, "ms":600}   // glides there over 600 ms
//   {"t":900, "type":"down"} {"t":950, "type":"up"} {"t":1000, "type":"click", "x":50, "y":60}
//   {"t":1200,"type":"wheel", "dx":0, "dy":240}  {"t":1500,"type":"key", "key":"ArrowRight"}
//
// Align the two timelines on the moment the action starts: `--start` is that moment in the clip. If the demo
// reacts later or earlier than the clip, shift it with `--offset` (ms) and say so in the report.
//
// `--autoplay`: for a demo that plays by itself on load (no input needed): the timeline starts at load, so `--start`
// is the second of the clip that matches the demo's first frame.
//
// Needs: node 18+, ffmpeg and ffprobe on PATH, and `npm install playwright` next to this file
// (set CHROME=/path/to/chromium to use an installed browser instead of Playwright's). `--webgl` turns on
// software WebGL. Time resolution is the browser's frame rate, so this checks the SHAPE of the motion, not
// exact spring constants.

import { chromium } from "playwright";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const opt = {};
for (let i = 0; i < argv.length; i++) {
  if (!argv[i].startsWith("--")) continue;
  const k = argv[i].slice(2);
  const next = argv[i + 1];
  if (next === undefined || next.startsWith("--")) opt[k] = true; else { opt[k] = next; i++; }
}
const need = ["demo", "clip", "actions", "out"].filter(k => !opt[k]);
if (need.length) { console.error("missing: " + need.map(k => "--" + k).join(", ")); process.exit(2); }

const fps = +(opt.fps || 30), start = +(opt.start || 0), dur = +(opt.dur || 2), offset = +(opt.offset || 0);
const [vw, vh] = (opt.viewport || "900x700").split("x").map(Number);
const [tw, th] = (opt.tile || "320x320").split("x").map(Number);
const out = path.resolve(opt.out);
const run = (cmd, a) => { const r = spawnSync(cmd, a, { encoding: "utf8" }); if (r.status !== 0) { console.error(cmd, a.join(" "), "\n", r.stderr); process.exit(1); } return r; };
for (const d of ["orig", "raw", "demo"]) { fs.rmSync(path.join(out, d), { recursive: true, force: true }); fs.mkdirSync(path.join(out, d), { recursive: true }); }

// 1. the clip
const vf = [`fps=${fps}`, opt.crop ? `crop=${opt.crop}` : null, `scale=${tw}:${th}:force_original_aspect_ratio=decrease`, `pad=${tw}:${th}:(ow-iw)/2:(oh-ih)/2:color=gray`].filter(Boolean).join(",");
run("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(start), "-t", String(dur), "-i", opt.clip, "-vf", vf, path.join(out, "orig/%03d.png")]);
const n = fs.readdirSync(path.join(out, "orig")).length;
if (n < 2) { console.error("the clip gave no frames: check --start and --dur"); process.exit(1); }

// 2. the demo, driven with real input and recorded
const actions = JSON.parse(fs.readFileSync(opt.actions, "utf8"));
const html = fs.readFileSync(opt.demo, "utf8");
const args = ["--no-sandbox"];
if (opt.webgl) args.push("--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist");
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args });
const page = await browser.newPage({ viewport: { width: vw, height: vh } });
const errors = [];
page.on("pageerror", e => errors.push(e.message));
page.on("console", m => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
// With --autoplay the demo plays by itself from the moment it loads: recording starts first and the
// timeline starts when the page is loaded, so the clip and the demo begin together.
const load = async () => {
  if (opt.direct) await page.goto("file://" + path.resolve(opt.demo));
  else await page.evaluate(h => { document.getElementById("f").srcdoc = h; }, html);
};
if (!opt.direct) await page.setContent(`<!doctype html><body style="margin:0"><iframe id="f" sandbox="allow-scripts" style="border:0;width:${vw}px;height:${vh}px"></iframe>`);
if (!opt.autoplay) { await load(); await page.waitForTimeout(1200); } // let fonts, images and the first frame settle

const cdp = await page.context().newCDPSession(page);
const raw = []; let seq = 0;
cdp.on("Page.screencastFrame", ev => {
  const i = seq++; fs.writeFileSync(path.join(out, "raw", String(i).padStart(4, "0") + ".png"), Buffer.from(ev.data, "base64"));
  raw.push({ i, ms: ev.metadata.timestamp * 1000 });
  cdp.send("Page.screencastFrameAck", { sessionId: ev.sessionId }).catch(() => {});
});
await cdp.send("Page.startScreencast", { format: "png", everyNthFrame: 1 });
await page.waitForTimeout(250);
if (opt.autoplay) { await load(); await page.waitForTimeout(30); }

const sleep = ms => new Promise(r => setTimeout(r, Math.max(0, ms)));
const T0 = Date.now();
const at = a => T0 + a.t;
let pos = { x: vw / 2, y: vh / 2 };
for (const a of actions) {
  await sleep(at(a) - Date.now());
  if (a.type === "move") {
    const from = pos, ms = a.ms || 0, steps = Math.max(1, Math.round(ms / 16));
    for (let s = 1; s <= steps; s++) { await page.mouse.move(from.x + (a.x - from.x) * s / steps, from.y + (a.y - from.y) * s / steps); if (ms) await sleep(ms / steps); }
    pos = { x: a.x, y: a.y };
  } else if (a.type === "down") await page.mouse.down();
  else if (a.type === "up") await page.mouse.up();
  else if (a.type === "click") { await page.mouse.move(a.x, a.y); await page.mouse.click(a.x, a.y); pos = { x: a.x, y: a.y }; }
  else if (a.type === "wheel") await page.mouse.wheel(a.dx || 0, a.dy || 0);
  else if (a.type === "key") await page.keyboard.press(a.key);
  else console.error("unknown action type: " + a.type);
}
await sleep(T0 + offset + dur * 1000 + 300 - Date.now());
await cdp.send("Page.stopScreencast");
await browser.close();
if (!raw.length) { console.error("no frames recorded"); process.exit(1); }

// 3. for each clip frame time, the last demo frame shown by then
const report = []; let maxLag = 0;
for (let k = 0; k < n; k++) {
  const target = T0 + offset + (k * 1000) / fps;
  let pick = raw[0];
  for (const f of raw) if (f.ms <= target) pick = f; else break;
  const lag = Math.max(0, target - pick.ms);
  report.push({ tile: k, clip_ms: Math.round((k * 1000) / fps), demo_frame: pick.i, demo_age_ms: Math.round(lag) });
  maxLag = Math.max(maxLag, lag);
  fs.copyFileSync(path.join(out, "raw", String(pick.i).padStart(4, "0") + ".png"), path.join(out, "demo", String(k + 1).padStart(3, "0") + ".png"));
}
const dvf = [opt["demo-crop"] ? `crop=${opt["demo-crop"].split(":")[2]}:${opt["demo-crop"].split(":")[3]}:${opt["demo-crop"].split(":")[0]}:${opt["demo-crop"].split(":")[1]}` : null,
  `scale=${tw}:${th}:force_original_aspect_ratio=decrease`, `pad=${tw}:${th}:(ow-iw)/2:(oh-ih)/2:color=gray`].filter(Boolean).join(",");
fs.mkdirSync(path.join(out, "demo_s"), { recursive: true });
run("ffmpeg", ["-y", "-loglevel", "error", "-i", path.join(out, "demo/%03d.png"), "-vf", dvf, path.join(out, "demo_s/%03d.png")]);

// 4. the strip: clip above, demo below, same moments
let idx;
if (opt.at) idx = String(opt.at).split(",").map(s => Math.min(n - 1, Math.max(0, Math.round(parseFloat(s) * fps))));
else { const K = Math.max(2, +(opt.frames || 8)); idx = Array.from({ length: K }, (_, i) => Math.round((i * (n - 1)) / (K - 1))); }
if (idx.length < 2) { console.error("need at least 2 moments"); process.exit(1); }
const files = d => idx.map(i => path.join(out, d, String(i + 1).padStart(3, "0") + ".png"));
const inputs = [...files("orig"), ...files("demo_s")].flatMap(f => ["-i", f]);
const K = idx.length;
const row = (from) => Array.from({ length: K }, (_, j) => `[${from + j}]`).join("") + `hstack=inputs=${K}`;
run("ffmpeg", ["-y", "-loglevel", "error", ...inputs, "-filter_complex", `${row(0)}[a];${row(K)}[b];[a][b]vstack=inputs=2`, "-frames:v", "1", path.join(out, "strip.png")]);
fs.writeFileSync(path.join(out, "report.json"), JSON.stringify({ fps, start, dur, offset, moments_s: idx.map(i => +(i / fps).toFixed(3)), page_errors: errors, max_demo_age_ms: Math.round(maxLag), tiles: report }, null, 1));
fs.rmSync(path.join(out, "raw"), { recursive: true, force: true });

console.log(`strip: ${path.join(out, "strip.png")}  (top: clip, bottom: demo)`);
console.log(`moments (s): ${idx.map(i => (i / fps).toFixed(2)).join("  ")}`);
console.log(`demo frame age at those moments: max ${Math.round(maxLag)} ms` + (maxLag > 2000 / fps ? "  <- the page showed nothing new for a while there; that is fine if it was at rest" : ""));
console.log(errors.length ? "PAGE ERRORS:\n" + errors.join("\n") : "no page errors");
