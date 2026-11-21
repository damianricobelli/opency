// What makes a photo usable under type, measured instead of guessed.
//
//   textRoom(buf)                  where the image is calm enough to take text: { zone, calm, zones }
//   rankStock(results, { format }) orders search results by what a designer checks first:
//                                  does it cover the format, does its shape match, is it a cliché, is there room for type
//
// Nothing here judges whether a photo is beautiful: the agent still looks at the previews. It only pushes
// down what cannot work (too small, wrong shape, no place to put a headline) and what reads as stock.

import sharp from "sharp";
import { FORMATS } from "./project.mjs";

const ZONES = { top: [0, 0, 1, 0.42], bottom: [0, 0.58, 1, 0.42], left: [0, 0, 0.45, 1], right: [0.55, 0, 0.45, 1] };

/** Detail in a region: mean absolute difference between neighboring pixels (0 = flat, ~0.12+ = busy). */
function detail(px, w, h, [rx, ry, rw, rh]) {
  const x0 = Math.floor(rx * w), y0 = Math.floor(ry * h), x1 = Math.min(w - 1, Math.floor((rx + rw) * w)), y1 = Math.min(h - 1, Math.floor((ry + rh) * h));
  let sum = 0, n = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = y * w + x; sum += Math.abs(px[i] - px[i + 1]) + Math.abs(px[i] - px[i + w]); n += 2; }
  return n ? sum / n / 255 : 1;
}

/**
 * Where a headline can sit. `calm` is 0–1 (1 = a flat area such as sky, a wall or deep shadow).
 * zone is null when no side of the image is calm enough: text there needs a heavy veil, or another photo.
 */
export async function textRoom(buf) {
  const { data, info } = await sharp(buf, { failOn: "none" }).rotate().resize(64, 80, { fit: "fill" }).greyscale().raw().toBuffer({ resolveWithObject: true });
  const zones = Object.fromEntries(Object.entries(ZONES).map(([k, r]) => [k, Math.round(Math.max(0, 1 - detail(data, info.width, info.height, r) / 0.09) * 100) / 100]));
  const [zone, calm] = Object.entries(zones).sort((a, b) => b[1] - a[1])[0];
  return { zone: calm >= 0.45 ? zone : null, calm, zones };
}

/** Words that, in a stock description, almost always mean the photo could belong to any brand. */
const CLICHE = /\b(handshake|shaking hands|thumbs? up|high five|business (people|team|man|woman|meeting)|businessm[ae]n|team ?work|brainstorm\w*|smiling at (the )?camera|looking at (the )?camera|isolated on white|white background|concept|stock photo|call cent(er|re)|headset|pointing at|success|diverse group|cheering|light ?bulb|puzzle pieces?|piggy bank|word cloud|3d render|illustration|vector|clip ?art|mock ?up|copy ?space banner)\b/i;

/**
 * @param {object[]} results  from searchStock: { ref, provider, w, h, alt, … } (+ room from textRoom, when measured)
 * @returns the same results with `score` and `fit` (the reasons, in words), best first; `unusable` ones last
 */
export function rankStock(results, { format = "4:5" } = {}) {
  const f = FORMATS[format] ?? FORMATS["4:5"], target = f.w / f.h;
  return results.map((r) => {
    const fit = [];
    let score = 50;
    const cover = Math.min(r.w / f.w, r.h / f.h);
    if (cover >= 2) { score += 14; fit.push(`covers ${format} at 2K`); }
    else if (cover >= 1) { score += 8; fit.push(`covers ${format} at 1080`); }
    else if (cover >= 0.7) { score -= 12; fit.push(`too small for a full ${format} background (${Math.round(cover * 100)} %): a partial block only`); }
    else { score -= 40; fit.push(`too small (${Math.round(cover * 100)} % of a ${format} canvas)`); }
    const kept = Math.min(target / (r.w / r.h), (r.w / r.h) / target);
    if (kept >= 0.85) { score += 8; fit.push("shape matches the format"); }
    else if (kept < 0.6) { score -= 10; fit.push(`${Math.round((1 - kept) * 100)} % of it is cropped away in ${format}`); }
    if (CLICHE.test(r.alt ?? "")) { score -= 18; fit.push("reads as generic stock"); }
    if (r.provider === "unsplash") score += 4;
    if (r.room) {
      if (r.room.zone) { score += Math.round(r.room.calm * 14); fit.push(`calm area at the ${r.room.zone} for the headline`); }
      else { score -= 8; fit.push("busy everywhere: text needs a heavy veil"); }
    }
    return { ...r, score, fit, unusable: cover < 0.7 };
  }).sort((a, b) => b.score - a.score);
}
