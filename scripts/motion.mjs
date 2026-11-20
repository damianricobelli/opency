#!/usr/bin/env node
// Video a partir de slides con animaciones CSS (@keyframes / transitions / Web Animations).
//
//   npx opentcy motion <pieza> --slide 1 [--duration 6]            un slide → render/slide-01.mp4
//   npx opentcy motion <pieza> --slides all [--duration 4]         todos los slides → render/reel.mp4 (fundido entre slides)
//   npx opentcy motion <pieza> --slides 1,3,5 --audio pista.mp3    con música (se recorta y funde al final)
//   opciones: --fps 30  --scale 1  --fade 0.4  --brand slug
//
// Render determinístico: pausa las animaciones y las posiciona cuadro por cuadro (no graba la pantalla,
// así que no hay saltos ni cuadros perdidos). Requiere ffmpeg. Salida H.264 yuv420p con faststart.
// El audio lo aporta la persona: el agente no descarga música.

import { mkdir, rm, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { FORMATS, parseArgs, readJSON, resolvePiece, launchBrowser } from "./lib/project.mjs";

const args = parseArgs(process.argv.slice(2));
const fail = (m) => { console.error(`✗ ${m}`); process.exit(1); };
let pieceDir; try { pieceDir = await resolvePiece(args._[0], args); } catch (e) { fail(`${e.message}\nUso: npx opentcy motion <pieza> [--slide 1 | --slides all] [--duration 6] [--audio archivo]`); }
if (spawnSync("ffmpeg", ["-version"]).status !== 0) fail("Falta ffmpeg (brew install ffmpeg / apt install ffmpeg).");

const piece = await readJSON(path.join(pieceDir, "piece.json"), {});
const spec = FORMATS[piece.format ?? "4:5"];
const all = (await readdir(pieceDir)).filter((f) => /^slide-\d+\.html$/.test(f)).sort().map((f) => Number(f.match(/\d+/)[0]));
const wanted = args.slides ? (args.slides === "all" || args.slides === true ? all : String(args.slides).split(",").map(Number)) : [Number(args.slide ?? 1)];
for (const n of wanted) if (!all.includes(n)) fail(`No existe el slide ${n}.`);
const duration = Number(args.duration ?? (wanted.length > 1 ? 4 : 6)), fps = Number(args.fps ?? 30), scale = Number(args.scale ?? 1), fade = Number(args.fade ?? 0.4);
if (args.audio && !existsSync(path.resolve(String(args.audio)))) fail(`No encontré el audio ${args.audio}`);
if (wanted.length > 1 && duration <= fade * 2) fail("--duration tiene que ser mayor al doble de --fade.");

const outDir = path.join(pieceDir, "render");
await mkdir(outDir, { recursive: true });
const pad = (n) => String(n).padStart(2, "0");
const ff = (a) => { const r = spawnSync("ffmpeg", ["-y", "-loglevel", "error", ...a], { stdio: "inherit" }); if (r.status !== 0) fail("ffmpeg falló"); };
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
  if (!count) console.warn(`⚠ slide ${n}: sin animaciones, queda como imagen fija. Agregá @keyframes (ver docs/video.md).`);
  const total = Math.round(duration * fps);
  for (let f = 0; f < total; f++) {
    await page.evaluate(async (t) => {
      document.getAnimations().forEach((a) => { a.pause(); a.currentTime = t; });
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); // que el compositor pinte el cuadro
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
  // Encadena con fundido: cada xfade empieza cuando termina el tramo acumulado menos el fundido
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
console.log(`→ ${path.relative(process.cwd(), final)} · ${length.toFixed(1)}s · ${fps} fps · ${spec.w * scale}×${spec.h * scale}${args.audio ? " · con audio" : ""}`);
