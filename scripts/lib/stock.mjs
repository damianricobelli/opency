// Stock image libraries: Openverse and Unsplash behind a single interface.
//
//   searchStock(query, { provider, orientation, n, page })  → normalized results
//   fetchStock(ref)                                          → { buf, desc, credit, license, source }
//
// - Unsplash:  UNSPLASH_ACCESS_KEY   (free at unsplash.com/developers)
// - Openverse: no key. Only licenses that allow commercial use and modification (CC0, public domain, CC BY).
//
// provider "auto" queries every available library in parallel and interleaves the results,
// so the choice does not depend on which one answered first.

import { lookup } from "node:dns/promises";
import net from "node:net";

const UA = "opency (+https://github.com/damianricobelli/opency)";
const MAX_BYTES = 25 * 1024 * 1024;

// ---------- Safe download ----------
function isPrivate(ip) {
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v.startsWith("::ffff:")) return isPrivate(v.slice(7));
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80");
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

/** Rejects anything that is not public http(s): keeps a pasted URL from pointing at the internal network. */
export async function assertPublicUrl(url) {
  const u = new URL(url);
  if (!/^https?:$/.test(u.protocol)) throw new Error(`Only http(s) URLs are accepted: ${url}`);
  const host = u.hostname.replace(/^\[|\]$/g, "");
  const addrs = net.isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => { throw new Error(`Could not resolve ${host}`); });
  if (addrs.some((a) => isPrivate(a.address))) throw new Error(`Private or internal address rejected: ${host}`);
  return u;
}

export async function fetchBuffer(url, headers = {}, { maxRedirects = 5 } = {}) {
  let current = String(url);
  for (let i = 0; i <= maxRedirects; i++) {
    await assertPublicUrl(current);
    const res = await fetch(current, { headers: { "User-Agent": UA, ...headers }, redirect: "manual", signal: AbortSignal.timeout(45000) });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) { current = new URL(res.headers.get("location"), current).href; headers = withoutAuth(headers); continue; }
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${new URL(current).host}`);
    if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) throw new Error("file larger than 25 MB");
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_BYTES) throw new Error("file larger than 25 MB");
    return { buf, type: res.headers.get("content-type") ?? "" };
  }
  throw new Error("too many redirects");
}
// Credentials do not travel to another host after a redirect
const withoutAuth = (h) => Object.fromEntries(Object.entries(h).filter(([k]) => k.toLowerCase() !== "authorization"));

const getJSON = async (url, headers) => JSON.parse((await fetchBuffer(url, headers)).buf.toString("utf8"));

// ---------- Providers ----------
const ORIENT = {
  unsplash: { portrait: "portrait", landscape: "landscape", square: "squarish" },
  openverse: { portrait: "tall", landscape: "wide", square: "square" },
};

export const PROVIDERS = {
  unsplash: {
    label: "Unsplash", license: "Unsplash License", key: () => process.env.UNSPLASH_ACCESS_KEY, keyName: "UNSPLASH_ACCESS_KEY", signup: "https://unsplash.com/developers",
    headers() { return { Authorization: `Client-ID ${this.key()}`, "Accept-Version": "v1" }; },
    /** Checks a key the user just pasted, without storing it. */
    async verify(key) {
      const res = await fetch("https://api.unsplash.com/search/photos?query=coffee&per_page=1", { headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1", "User-Agent": UA }, signal: AbortSignal.timeout(20000) });
      return res.ok ? { ok: true, remaining: res.headers.get("x-ratelimit-remaining") } : { ok: false, error: `${res.status} ${res.statusText}` };
    },
    async search(query, { orientation, n, page }) {
      const u = new URL("https://api.unsplash.com/search/photos");
      u.search = new URLSearchParams({ query, per_page: String(n), page: String(page), content_filter: "high", ...(orientation ? { orientation: ORIENT.unsplash[orientation] } : {}) });
      const j = await getJSON(u, this.headers());
      return (j.results ?? []).map((p) => ({ ref: `unsplash:${p.id}`, provider: "unsplash", w: p.width, h: p.height, by: p.user?.name ?? "", alt: p.alt_description || p.description || "", preview: p.urls.small, page: p.links.html, license: "Unsplash License", avgColor: p.color ?? null }));
    },
    async get(id) {
      const p = await getJSON(`https://api.unsplash.com/photos/${encodeURIComponent(id)}`, this.headers());
      // Unsplash API requirement: report the download before fetching the file.
      await fetchBuffer(p.links.download_location, this.headers()).catch(() => {});
      const { buf } = await fetchBuffer(`${p.urls.raw}${p.urls.raw.includes("?") ? "&" : "?"}w=4000&fm=jpg&q=92`);
      return { buf, desc: p.alt_description || p.description, credit: `Photo: ${p.user.name} on Unsplash (${p.links.html})`, license: "Unsplash License", source: p.links.html };
    },
  },
  openverse: {
    label: "Openverse", license: "CC0 / public domain / CC BY", key: () => "no-key", keyName: null, signup: null,
    async search(query, { orientation, n, page }) {
      const u = new URL("https://api.openverse.org/v1/images/");
      u.search = new URLSearchParams({ q: query, page_size: String(Math.min(n, 20)), page: String(page), license: "cc0,pdm,by", size: "large", mature: "false", ...(orientation ? { aspect_ratio: ORIENT.openverse[orientation] } : {}) });
      const j = await getJSON(u);
      return (j.results ?? []).filter((p) => p.width && p.height).map((p) => ({ ref: `openverse:${p.id}`, provider: "openverse", w: p.width, h: p.height, by: p.creator ?? "", alt: p.title ?? "", preview: p.thumbnail ?? p.url, page: p.foreign_landing_url ?? p.url, license: ovLicense(p), avgColor: null }));
    },
    async get(id) {
      if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("invalid Openverse id");
      const p = await getJSON(`https://api.openverse.org/v1/images/${id}/`);
      if (!["cc0", "pdm", "by"].includes(p.license)) throw new Error(`License ${p.license} not allowed: only CC0, public domain or CC BY`);
      const { buf } = await fetchBuffer(p.url);
      const lic = ovLicense(p);
      const credit = p.license === "by" ? `"${p.title ?? "Untitled"}" by ${p.creator ?? "unknown author"}, ${lic} (${p.foreign_landing_url})` : `${p.creator ? `Photo: ${p.creator}, ` : ""}${lic} (${p.foreign_landing_url})`;
      return { buf, desc: p.title, credit, license: lic, source: p.foreign_landing_url ?? p.url, attributionRequired: p.license === "by" };
    },
  },
};
const ovLicense = (p) => (p.license === "cc0" ? "CC0 1.0" : p.license === "pdm" ? "Public domain" : `CC ${String(p.license).toUpperCase()} ${p.license_version ?? ""}`.trim());

export const availableProviders = () => Object.keys(PROVIDERS).filter((k) => PROVIDERS[k].key());
export const missingKeys = () => Object.values(PROVIDERS).filter((p) => p.keyName && !p.key()).map((p) => ({ provider: p.label, env: p.keyName, signup: p.signup }));

/**
 * @param {string} query search query in English (the libraries index in English)
 * @returns {{ results: object[], providers: string[], errors: {provider:string,error:string}[] }}
 */
export async function searchStock(query, { provider = "auto", orientation, n = 12, page = 1 } = {}) {
  if (!query?.trim()) throw new Error("Missing search query");
  if (orientation && !ORIENT.unsplash[orientation]) throw new Error("orientation must be portrait, landscape or square");
  let names;
  if (provider === "auto" || provider === "all") names = availableProviders();
  else {
    if (!PROVIDERS[provider]) throw new Error(`Unknown provider "${provider}". Options: auto, ${Object.keys(PROVIDERS).join(", ")}`);
    if (!PROVIDERS[provider].key()) throw new Error(`${PROVIDERS[provider].keyName} is missing (free at ${PROVIDERS[provider].signup}). Without a key you can use --provider openverse.`);
    names = [provider];
  }
  const per = names.length > 1 ? Math.ceil(n / names.length) + 2 : n;
  // A library that answers 5xx is usually back a moment later: one retry before reporting it.
  const once = (k) => PROVIDERS[k].search(query, { orientation, n: per, page });
  const settled = await Promise.allSettled(names.map((k) => once(k).catch((e) => (/^5\d\d\b/.test(e.message) ? new Promise((r) => setTimeout(r, 1200)).then(() => once(k)) : Promise.reject(e)))));
  const lists = [], errors = [];
  settled.forEach((s, i) => (s.status === "fulfilled" ? lists.push(s.value) : errors.push({ provider: names[i], error: s.reason.message })));
  // Interleave: one from each library per round
  const results = [];
  for (let i = 0; results.length < n && lists.some((l) => i < l.length); i++) for (const l of lists) if (l[i] && results.length < n) results.push(l[i]);
  return { results, providers: names, errors };
}

export async function fetchStock(ref) {
  const i = String(ref).indexOf(":");
  const provider = String(ref).slice(0, i), id = String(ref).slice(i + 1);
  const p = PROVIDERS[provider];
  if (i < 1 || !p || !id) throw new Error("Format: unsplash:<id> or openverse:<id>");
  if (!p.key()) throw new Error(`${p.keyName} is missing (free at ${p.signup})`);
  return p.get(id);
}
