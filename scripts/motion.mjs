#!/usr/bin/env node
// Video from slides with CSS animations (@keyframes / transitions / Web Animations).
//
//   npx opentcy motion <piece> --slide 1 [--duration 6]            one slide → render/slide-01.mp4
//   npx opentcy motion <piece> --slides all [--duration 4]         every slide → render/reel.mp4 (crossfade between slides)
//   npx opentcy motion <piece> --slides 1,3,5 --audio track.mp3    with music (trimmed and faded out at the end)
//   options: --fps 30  --scale 1  --fade 0.4  --brand slug
//
// Deterministic render: pauses the animations and seeks them frame by frame (it does not record the screen,
// so there are no jumps or dropped frames). Requires ffmpeg. Output is H.264 yuv420p with faststart.
// The user provides the audio: the agent does not download music.

import { mkdir, rm, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { FORMATS, parseArgs, readJSON, resolvePiece, launchBrowser } from "./lib/project.mjs";

const args = parseArgs(process.argv.slice(2));
const fail = (m) => { console.error(`✗ ${m}`); process.exit(1); };
let pieceDir; try { pieceDir = await resolvePiece(args._[0], args); } catch (e) { fail(`${e.message}\nUsage: npx opentcy motion <piece> [--slide 1 | --slides all] [--duration 6] [--audio file]`); }
if (spawnSync("ffmpeg", ["-version"]).status !== 0) fail("ffmpeg is missing (brew install ffmpeg / apt install ffmpeg).");

const piece = await readJSON(path.join(pieceDir, "piece.json"), {});
const spec = FORMATS[piece.format ?? "4:5"];
const all = (await readdir(pieceDir)).filter((f) => /^slide-\d+\.html$/.test(f)).sort().map((f) => Number(f.match(/\d+/)[0]));
const wanted = args.slides ? (args.slides === "all" || args.slides === true ? all : String(args.slides).split(",").map(Number)) : [Number(args.slide ?? 1)];
for (const n of wanted) if (!all.includes(n)) fail(`Slide ${n} does not exist.`);
const duration = Number(args.duration ?? (wanted.length > 1 ? 4 : 6)), fps = Number(args.fps ?? 30), scale = Number(args.scale ?? 1), fade = Number(args.fade ?? 0.4);
if (args.audio && !existsSync(path.resolve(String(args.audio)))) fail(`Audio file not found: ${args.audio}`);
if (wanted.length > 1 && duration <= fade * 2) fail("--duration must be greater than twice --fade.");

const outDir = path.join(pieceDir, "render");
await mkdir(outDir, { recursive: true });
const pad = (n) => String(n).padStart(2, "0");
const ff = (a) => { const r = spawnSync("ffmpeg", ["-y", "-loglevel", "error", ...a], { stdio: "inherit" }); if (r.status !== 0) fail("ffmpeg failed"); };
const ENC = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart"];

const browser = await launchBrowser().catch((e) => fail(e.message));
const clips = [];
for (const n of wanted) {
  const framesDir = path.join(outDir, `.frames-${n}`);
  await rm(framesDir, { recursive: true, force: true });
  await mkdir(framesDir, { recursive: true });
  const page = await browser.newPage({ viewport: { width: spec.w, height: spec.h }, deviceScaleFactor: scale });
  await page.goto(pathToFileURL(path.join(pieceDir, `slide-${pad(n)}.html`)).href, { waitUntil: "networkidle" });
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((i) => i.decode().catch(() => {}))); });
  const count = await page.evaluate(() => { const a = document.getAnimations(); a.forEach((x) => x.pause()); return a.length; });
  if (!count) console.warn(`⚠ slide ${n}: no animations, it stays a still image. Add @keyframes (see docs/video.md).`);
  const total = Math.round(duration * fps);
  for (let f = 0; f < total; f++) {
    await page.evaluate(async (t) => {
      document.getAnimations().forEach((a) => { a.pause(); a.currentTime = t; });
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); // let the compositor paint the frame
    }, (f / fps) * 1000);
    await page.screenshot({ path: path.join(framesDir, `${String(f).padStart(5, "0")}.png`), clip: { x: 0, y: 0, width: spec.w, height: spec.h } });
  }
  await page.close();
  const clip = path.join(outDir, `slide-${pad(n)}.mp4`);
  ff(["-framerate", String(fps), "-i", path.join(framesDir, "%05d.png"), ...ENC, clip]);
  await rm(framesDir, { recursive: true, force: true });
  clips.push(clip);
  console.log(`✓ slide ${pad(n)} · ${duration}s`);
}
await browser.close();

let final = clips[0];
if (clips.length > 1) {
  // Chain with crossfades: each xfade starts where the accumulated run ends, minus the fade
  const inputs = clips.flatMap((c) => ["-i", c]);
  let filter = "", last = "[0:v]", offset = 0;
  for (let i = 1; i < clips.length; i++) {
    offset += duration - fade;
    const out = i === clips.length - 1 ? "[v]" : `[x${i}]`;
    filter += `${last}[${i}:v]xfade=transition=fade:duration=${fade}:offset=${offset.toFixed(3)}${out};`;
    last = out;
  }
  final = path.join(outDir, "reel.mp4");
  ff([...inputs, "-filter_complex", filter.replace(/;$/, ""), "-map", "[v]", ...ENC, final]);
}
const length = clips.length > 1 ? clips.length * duration - (clips.length - 1) * fade : duration;

if (args.audio) {
  const withAudio = final.replace(/\.mp4$/, "-audio.mp4");
  ff(["-i", final, "-i", path.resolve(String(args.audio)), "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
    "-af", `afade=t=out:st=${Math.max(0, length - 1).toFixed(2)}:d=1`, "-t", length.toFixed(2), "-movflags", "+faststart", withAudio]);
  final = withAudio;
}
console.log(`→ ${path.relative(process.cwd(), final)} · ${length.toFixed(1)}s · ${fps} fps · ${spec.w * scale}×${spec.h * scale}${args.audio ? " · with audio" : ""}`);
