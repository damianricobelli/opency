#!/usr/bin/env node
// Brands: create, select, import from a website and check the palette.
//
//   npx @opency/cli brand list
//   npx @opency/cli brand new <slug> --name "Name"          creates brands/<slug>/ with the skeleton
//   npx @opency/cli brand use <slug>                         default active brand (brands/.active)
//   npx @opency/cli brand import <url> [--brand slug]        reads colors, typefaces, logo and copy from a website
//   npx @opency/cli brand check [--brand slug]               contrast of every palette combination + fonts
//
// `import` does not write tokens: it leaves a report in brands/<slug>/import/ so the agent can propose
// the palette and the user can approve it. `check` resolves colors in the browser (works for hex, oklch, color-mix).

import { mkdir, writeFile, cp, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT, BRANDS, parseArgs, listBrands, resolveBrand, brandDir, loadBrand, writeJSON, readJSON, slugify, launchBrowser, today } from "./lib/project.mjs";

const args = parseArgs(process.argv.slice(2));
const [cmd, target] = args._;
const fail = (m) => { console.error(`✗ ${m}`); process.exit(1); };

// ---------- Extraction (runs inside the page) ----------
export function extractBrand() {
  const cs = (el) => getComputedStyle(el);
  const cv = document.createElement("canvas"); cv.width = cv.height = 1;
  const cx = cv.getContext("2d", { willReadFrequently: true });
  const hex = (c) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = "#000"; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return d[3] < 20 ? null : "#" + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, "0")).join(""); };
  const fam = (el) => cs(el).fontFamily.split(",")[0].replace(/["']/g, "").trim();
  const q = (sel) => document.querySelector(sel);
  const type = (sel) => { const el = q(sel); if (!el) return null; const s = cs(el); return { family: fam(el), weight: s.fontWeight, size: s.fontSize, lineHeight: s.lineHeight, letterSpacing: s.letterSpacing, transform: s.textTransform, color: hex(s.color) }; };

  // Color census weighted by area (backgrounds) and by amount of text (inks)
  const bg = {}, ink = {}, strong = {};
  for (const el of document.querySelectorAll("body *")) {
    const s = cs(el), r = el.getBoundingClientRect();
    if (!r.width || !r.height || s.visibility === "hidden") continue;
    const b = hex(s.backgroundColor); if (b) bg[b] = (bg[b] || 0) + r.width * r.height;
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join("").length;
    if (own) { const c = hex(s.color); if (c) ink[c] = (ink[c] || 0) + own; }
    if (el.matches("button, a[class*=btn], a[class*=button], [role=button]") && b) strong[b] = (strong[b] || 0) + 1;
  }
  const top = (o, n = 8) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([c, v]) => ({ color: c, weight: Math.round(v) }));

  const vars = {};
  for (const sheet of document.styleSheets) {
    try { for (const r of sheet.cssRules) if (r.selectorText === ":root" || r.selectorText === "html") for (const p of r.style) if (p.startsWith("--") && /color|primary|secondary|accent|background|foreground|brand|muted|border|radius|font/i.test(p)) vars[p] = r.style.getPropertyValue(p).trim(); } catch {}
  }
  const fontFiles = [];
  for (const sheet of document.styleSheets) {
    try { for (const r of sheet.cssRules) if (r.constructor.name === "CSSFontFaceRule") fontFiles.push({ family: r.style.getPropertyValue("font-family").replace(/["']/g, ""), weight: r.style.getPropertyValue("font-weight"), src: (r.style.getPropertyValue("src").match(/url\("?([^")]+)/) || [])[1] }); } catch {}
  }
  const logoEl = q("header a[href='/'] img, header img[alt*=logo i], header svg, .logo img, [class*=logo] img, nav img");
  const text = (sel, n) => [...document.querySelectorAll(sel)].map((e) => e.innerText.replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, n);
  const body = cs(document.body);
  const btn = q("main button, main a[class*=btn], main a[class*=button]");
  return {
    url: location.href, title: document.title, lang: document.documentElement.lang,
    description: q('meta[name="description"]')?.content ?? q('meta[property="og:description"]')?.content ?? "",
    page: { background: hex(body.backgroundColor) ?? hex(cs(document.documentElement).backgroundColor), text: hex(body.color) },
    backgrounds: top(bg), inks: top(ink), buttons: top(strong, 4),
    type: { h1: type("h1"), h2: type("h2"), body: type("main p, p"), label: type("[class*=eyebrow], [class*=kicker], [class*=label], small") },
    button: btn ? { background: hex(cs(btn).backgroundColor), color: hex(cs(btn).color), radius: cs(btn).borderRadius } : null,
    cssVariables: vars, fontFiles: fontFiles.slice(0, 40),
    fontsLoaded: [...new Set([...document.fonts].filter((f) => f.status === "loaded").map((f) => `${f.family.replace(/["']/g, "")} ${f.weight}`))],
    logo: logoEl ? { tag: logoEl.tagName.toLowerCase(), src: logoEl.currentSrc || logoEl.src || null, svg: logoEl.tagName.toLowerCase() === "svg" ? logoEl.outerHTML.slice(0, 20000) : null } : null,
    icons: [...document.querySelectorAll('link[rel*="icon"]')].map((l) => l.href),
    headings: text("h1, h2", 12), ctas: [...new Set(text("button, a[class*=btn], a[class*=button]", 20))].slice(0, 8),
    social: [...new Set([...document.querySelectorAll("a[href]")].map((a) => a.href).filter((h) => /instagram\.com|linkedin\.com|x\.com|twitter\.com|tiktok\.com|facebook\.com|youtube\.com/.test(h)))],
  };
}

const lum = (h) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)]; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

try {
  if (cmd === "list") {
    const active = existsSync(path.join(BRANDS, ".active")) ? (await readFile(path.join(BRANDS, ".active"), "utf8")).trim() : "";
    for (const s of await listBrands()) { const b = await loadBrand(s); console.log(`${s === active ? "●" : " "} ${s.padEnd(20)} ${b.name}${b.loaded ? "" : "  (not set up)"}`); }
  } else if (cmd === "use") {
    if (!target || !existsSync(brandDir(target))) fail(`Brand "${target}" does not exist. Brands: ${(await listBrands()).join(", ")}`);
    await writeFile(path.join(BRANDS, ".active"), target + "\n");
    console.log(`✓ Active brand: ${target}`);
  } else if (cmd === "new") {
    if (!target) fail('Usage: npx @opency/cli brand new <slug> --name "Name"');
    const slug = slugify(target), dir = brandDir(slug), demo = brandDir("_demo");
    if (existsSync(dir)) fail(`brands/${slug} already exists`);
    for (const d of ["assets/logos", "assets/photos", "assets/textures", "assets/stock", "pieces", "templates"]) await mkdir(path.join(dir, d), { recursive: true });
    for (const f of ["brand-kit.md", "voice-samples.md", "tokens.css", "calendar.md", "decisions.md", "inspirations.md"]) await cp(path.join(demo, f), path.join(dir, f));
    await cp(path.join(demo, "assets/fonts"), path.join(dir, "assets/fonts"), { recursive: true });
    await writeJSON(path.join(dir, "assets/assets.json"), { assets: [] });
    await writeJSON(path.join(dir, "brand.json"), { name: typeof args.name === "string" ? args.name : "{{NOMBRE}}", slug, handle: "", language: "en", country: "", address: null, usesEmoji: false, usesDashes: false, pillars: [], defaults: { texture: "fine", grade: "editorial", dominantMode: "type" }, logos: {}, verified: [] });
    if ((await listBrands()).length === 1) await writeFile(path.join(BRANDS, ".active"), slug + "\n");
    console.log(`✓ brands/${slug}/ created with neutral tokens. Next: onboarding (references/onboarding.md) or npx @opency/cli brand import <url> --brand ${slug}`);
  } else if (cmd === "import") {
    if (!target) fail("Usage: npx @opency/cli brand import <url> [--brand slug]");
    const slug = await resolveBrand(args);
    const out = path.join(brandDir(slug), "import");
    await mkdir(out, { recursive: true });
    const browser = await launchBrowser();
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const url = /^(https?|file):/.test(target) ? target : existsSync(target) ? pathToFileURL(path.resolve(target)).href : `https://${target}`;
    await page.goto(url, { waitUntil: "networkidle", timeout: 45000 }).catch((e) => fail(`Could not open ${url}: ${e.message.split("\n")[0]}`));
    await page.evaluate(() => document.fonts.ready);
    const data = await page.evaluate(extractBrand);
    await page.screenshot({ path: path.join(out, "home.png") });
    // Logo: save the inline SVG or download the file
    if (data.logo?.svg) { await writeFile(path.join(out, "logo.svg"), data.logo.svg); data.logo.saved = "import/logo.svg"; delete data.logo.svg; }
    else if (data.logo?.src && /^https?:/.test(data.logo.src)) {
      try { const r = await page.request.get(data.logo.src); const ext = (data.logo.src.match(/\.(svg|png|webp|jpg|jpeg)(\?|$)/i) || [, "png"])[1]; await writeFile(path.join(out, `logo.${ext}`), await r.body()); data.logo.saved = `import/logo.${ext}`; } catch {}
    }
    await browser.close();
    data.importedAt = today();
    await writeJSON(path.join(out, "report.json"), data);
    console.log(`✓ ${data.title}`);
    console.log(`  background ${data.page.background} · text ${data.page.text} · button ${data.button?.background ?? "—"} (radius ${data.button?.radius ?? "—"})`);
    console.log(`  backgrounds: ${data.backgrounds.slice(0, 5).map((c) => c.color).join("  ")}`);
    console.log(`  inks:        ${data.inks.slice(0, 5).map((c) => c.color).join("  ")}`);
    console.log(`  headlines: ${data.type.h1?.family ?? "—"} ${data.type.h1?.weight ?? ""} · body: ${data.type.body?.family ?? "—"}`);
    console.log(`  logo: ${data.logo?.saved ?? data.logo?.src ?? "not found"} · social: ${data.social.length ? data.social.join(", ") : "none on the page"}`);
    console.log(`→ brands/${slug}/import/report.json and home.png. From these, propose the 7 roles and the typefaces; write tokens.css only once the user says yes.`);
  } else if (cmd === "check") {
    const slug = await resolveBrand(args), dir = brandDir(slug);
    const browser = await launchBrowser();
    const page = await browser.newPage();
    const probe = path.join(dir, ".check.html");
    await writeFile(probe, `<!doctype html><link rel="stylesheet" href="tokens.css"><body><p id="d" style="font-family:var(--font-display);font-weight:var(--weight-display)">Aa</p><p id="b" style="font-family:var(--font-body)">Aa</p><p id="m" style="font-family:var(--font-mono)">Aa</p>`);
    await page.goto(pathToFileURL(probe).href, { waitUntil: "networkidle" });
    const res = await page.evaluate(async () => {
      await document.fonts.ready;
      const names = ["primary", "secondary", "accent", "accent-inverse", "bg", "bg-alt", "ink", "ink-inverse", "ink-muted", "ink-inverse-muted"];
      const el = document.createElement("div"); document.body.append(el);
      const cv = document.createElement("canvas"); cv.width = cv.height = 1; const cx = cv.getContext("2d", { willReadFrequently: true });
      const colors = {};
      for (const n of names) {
        el.style.color = ""; el.style.color = `var(--${n})`;
        const raw = getComputedStyle(document.documentElement).getPropertyValue(`--${n}`).trim();
        if (!raw) continue;
        cx.clearRect(0, 0, 1, 1); cx.fillStyle = getComputedStyle(el).color; cx.fillRect(0, 0, 1, 1);
        const d = cx.getImageData(0, 0, 1, 1).data;
        colors[n] = "#" + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
      }
      const fonts = ["d", "b", "m"].map((id) => { const e = document.getElementById(id); const fam = getComputedStyle(e).fontFamily.split(",")[0].replace(/["']/g, "").trim(); return { role: { d: "display", b: "body", m: "mono" }[id], family: fam, loaded: [...document.fonts].some((f) => f.family.replace(/["']/g, "") === fam && f.status === "loaded") }; });
      return { colors, fonts };
    });
    await browser.close();
    const { unlink } = await import("node:fs/promises"); await unlink(probe).catch(() => {});
    const c = res.colors;
    console.log(`Palette for ${slug} (resolved values):`);
    for (const [k, v] of Object.entries(c)) console.log(`  --${k.padEnd(20)} ${v}`);
    const pairs = [["ink", "bg"], ["ink", "bg-alt"], ["ink-muted", "bg"], ["ink-muted", "bg-alt"], ["ink-inverse", "primary"], ["ink-inverse", "secondary"], ["ink-inverse-muted", "primary"], ["ink-inverse-muted", "secondary"],
      ["accent", "bg"], ["accent", "bg-alt"], ["accent-inverse", "primary"], ["accent-inverse", "secondary"], ["ink", "accent"], ["ink-inverse", "accent"]];
    console.log("\nContrast (text on background) · AA: 4.5 normal text · 3 large text or shapes");
    let bad = 0; const rows = [];
    for (const [fg, bg] of pairs) {
      if (!c[fg] || !c[bg] || c[fg] === c[bg]) continue;
      const r = ratio(c[fg], c[bg]);
      const verdict = r >= 4.5 ? "✓ any text" : r >= 3 ? "△ large text and shapes only" : "✗ do not use as text";
      const required = ["ink/bg", "ink/bg-alt", "ink-inverse/primary", "ink-inverse/secondary", "ink-muted/bg", "ink-inverse-muted/primary"].includes(`${fg}/${bg}`);
      if (required && r < 4.5) bad++;
      rows.push({ fg, bg, ratio: Number(r.toFixed(2)), verdict });
      console.log(`  ${(fg + " on " + bg).padEnd(34)} ${r.toFixed(2).padStart(5)}:1  ${verdict}${required && r < 4.5 ? "  ← fix: this is a base combination" : ""}`);
    }
    if (c.accent && c.ink && c["ink-inverse"]) {
      const best = ratio(c.ink, c.accent) >= ratio(c["ink-inverse"], c.accent) ? "ink" : "ink-inverse";
      console.log(`\n  Text on the accent (chips): --on-accent should be var(--${best}).`);
    }
    console.log("\nFonts:");
    for (const f of res.fonts) { console.log(`  ${f.role.padEnd(8)} ${f.family.padEnd(22)} ${f.loaded ? "✓ loads" : "✗ does NOT load (check @font-face and assets/fonts/)"}`); if (!f.loaded) bad++; }
    await writeJSON(path.join(dir, "palette-check.json"), { checkedAt: today(), colors: c, pairs: rows, fonts: res.fonts });
    console.log(bad ? `\n${bad} issue(s) to fix before designing.` : "\nPalette and fonts are in order.");
    if (bad) process.exit(2);
  } else {
    console.log((await readFile(new URL(import.meta.url), "utf8")).split("\n").filter((l) => l.startsWith("//")).map((l) => l.slice(3)).join("\n"));
  }
} catch (e) { fail(e.message); }
