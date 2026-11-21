// The brand's taste memory: what the user said they like and what they rejected.
//
// brands/<slug>/taste.json
//   inspirations: [{ id, kind: "link"|"image", url, title, file, note, addedAt }]
//       a reference the user handed over, with what THEY said about it. Never an asset: it cannot be placed in a piece.
//   feedback:     [{ id, piece, version, slide, verdict: "liked"|"rejected"|"changes", note, recipes: [ids], date }]
//       an explicit review of a piece (or one slide). The recipes it touched are what the compositor learns from.
//
// The compositor reads `recipes`: +1 per liked, −1 per rejected. A "changes" review teaches nothing about structure.

import path from "node:path";
import { brandDir, readJSON, writeJSON } from "./project.mjs";

export const tasteFile = (brand) => path.join(brandDir(brand), "taste.json");

export async function readTaste(brand) {
  const t = await readJSON(tasteFile(brand), null);
  return { inspirations: t?.inspirations ?? [], feedback: t?.feedback ?? [] };
}
export const writeTaste = (brand, taste) => writeJSON(tasteFile(brand), taste);

/** What the compositor and the agent read before designing. */
export function profile(taste) {
  const recipes = {};
  for (const f of taste.feedback) {
    const delta = f.verdict === "liked" ? 1 : f.verdict === "rejected" ? -1 : 0;
    for (const r of f.recipes ?? []) if (delta) recipes[r] = (recipes[r] ?? 0) + delta;
  }
  const by = (v) => taste.feedback.filter((f) => f.verdict === v).map((f) => ({ piece: f.piece, slide: f.slide ?? null, note: f.note, date: f.date }));
  return {
    recipes,
    liked: by("liked"), rejected: by("rejected"), changes: by("changes"),
    inspirations: taste.inspirations.map((i) => ({ id: i.id, kind: i.kind, title: i.title ?? null, url: i.url ?? null, file: i.file ?? null, note: i.note })),
  };
}
export const loadTaste = async (brand) => profile(await readTaste(brand));
