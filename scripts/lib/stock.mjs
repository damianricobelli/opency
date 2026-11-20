// Bancos de imágenes: Pexels, Unsplash y Openverse detrás de una sola interfaz.
//
//   searchStock(query, { provider, orientation, n, page })  → resultados normalizados
//   fetchStock(ref)                                          → { buf, desc, credit, license, source }
//
// - Pexels:    PEXELS_API_KEY        (gratis en pexels.com/api)
// - Unsplash:  UNSPLASH_ACCESS_KEY   (gratis en unsplash.com/developers)
// - Openverse: sin clave. Solo licencias que permiten uso comercial y modificación (CC0, dominio público, CC BY).
//
// provider "auto" consulta en paralelo todos los bancos disponibles e intercala los resultados,
// para que la elección no dependa de cuál respondió primero.

import { lookup } from "node:dns/promises";
import net from "node:net";

const UA = "opentcy (+https://github.com/damianricobelli/opentcy)";
const MAX_BYTES = 25 * 1024 * 1024;

// ---------- Descarga segura ----------
function isPrivate(ip) {
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v.startsWith("::ffff:")) return isPrivate(v.slice(7));
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80");
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

/** Rechaza todo lo que no sea http(s) público: evita que una URL pegada apunte a la red interna. */
export async function assertPublicUrl(url) {
  const u = new URL(url);
  if (!/^https?:$/.test(u.protocol)) throw new Error(`Solo se aceptan URLs http(s): ${url}`);
  const host = u.hostname.replace(/^\[|\]$/g, "");
  const addrs = net.isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => { throw new Error(`No pude resolver ${host}`); });
  if (addrs.some((a) => isPrivate(a.address))) throw new Error(`Dirección privada o interna rechazada: ${host}`);
  return u;
}

export async function fetchBuffer(url, headers = {}, { maxRedirects = 5 } = {}) {
  let current = String(url);
  for (let i = 0; i <= maxRedirects; i++) {
    await assertPublicUrl(current);
    const res = await fetch(current, { headers: { "User-Agent": UA, ...headers }, redirect: "manual", signal: AbortSignal.timeout(45000) });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) { current = new URL(res.headers.get("location"), current).href; headers = withoutAuth(headers); continue; }
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${new URL(current).host}`);
    if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) throw new Error("archivo de más de 25 MB");
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_BYTES) throw new Error("archivo de más de 25 MB");
    return { buf, type: res.headers.get("content-type") ?? "" };
  }
  throw new Error("demasiadas redirecciones");
}
// Las credenciales no viajan a otro host después de una redirección
const withoutAuth = (h) => Object.fromEntries(Object.entries(h).filter(([k]) => k.toLowerCase() !== "authorization"));

const getJSON = async (url, headers) => JSON.parse((await fetchBuffer(url, headers)).buf.toString("utf8"));

// ---------- Proveedores ----------
const ORIENT = {
  pexels: { portrait: "portrait", landscape: "landscape", square: "square" },
  unsplash: { portrait: "portrait", landscape: "landscape", square: "squarish" },
  openverse: { portrait: "tall", landscape: "wide", square: "square" },
};

export const PROVIDERS = {
  pexels: {
    label: "Pexels", license: "Pexels License", key: () => process.env.PEXELS_API_KEY, keyName: "PEXELS_API_KEY", signup: "https://www.pexels.com/api/",
    async search(query, { orientation, n, page }) {
      const u = new URL("https://api.pexels.com/v1/search");
      u.search = new URLSearchParams({ query, per_page: String(n), page: String(page), ...(orientation ? { orientation: ORIENT.pexels[orientation] } : {}) });
      const j = await getJSON(u, { Authorization: this.key() });
      return (j.photos ?? []).map((p) => ({ ref: `pexels:${p.id}`, provider: "pexels", w: p.width, h: p.height, by: p.photographer, alt: p.alt || "", preview: p.src.medium, page: p.url, license: "Pexels License", avgColor: p.avg_color ?? null }));
    },
    async get(id) {
      const p = await getJSON(`https://api.pexels.com/v1/photos/${encodeURIComponent(id)}`, { Authorization: this.key() });
      const { buf } = await fetchBuffer(p.src.original);
      return { buf, desc: p.alt, credit: `Foto: ${p.photographer} en Pexels (${p.url})`, license: "Pexels License", source: p.url };
    },
  },
  unsplash: {
    label: "Unsplash", license: "Unsplash License", key: () => process.env.UNSPLASH_ACCESS_KEY, keyName: "UNSPLASH_ACCESS_KEY", signup: "https://unsplash.com/developers",
    headers() { return { Authorization: `Client-ID ${this.key()}`, "Accept-Version": "v1" }; },
    async search(query, { orientation, n, page }) {
      const u = new URL("https://api.unsplash.com/search/photos");
      u.search = new URLSearchParams({ query, per_page: String(n), page: String(page), content_filter: "high", ...(orientation ? { orientation: ORIENT.unsplash[orientation] } : {}) });
      const j = await getJSON(u, this.headers());
      return (j.results ?? []).map((p) => ({ ref: `unsplash:${p.id}`, provider: "unsplash", w: p.width, h: p.height, by: p.user?.name ?? "", alt: p.alt_description || p.description || "", preview: p.urls.small, page: p.links.html, license: "Unsplash License", avgColor: p.color ?? null }));
    },
    async get(id) {
      const p = await getJSON(`https://api.unsplash.com/photos/${encodeURIComponent(id)}`, this.headers());
      // Requisito de la API de Unsplash: avisar la descarga antes de bajar el archivo.
      await fetchBuffer(p.links.download_location, this.headers()).catch(() => {});
      const { buf } = await fetchBuffer(`${p.urls.raw}${p.urls.raw.includes("?") ? "&" : "?"}w=4000&fm=jpg&q=92`);
      return { buf, desc: p.alt_description || p.description, credit: `Foto: ${p.user.name} en Unsplash (${p.links.html})`, license: "Unsplash License", source: p.links.html };
    },
  },
  openverse: {
    label: "Openverse", license: "CC0 / dominio público / CC BY", key: () => "sin-clave", keyName: null, signup: null,
    async search(query, { orientation, n, page }) {
      const u = new URL("https://api.openverse.org/v1/images/");
      u.search = new URLSearchParams({ q: query, page_size: String(Math.min(n, 20)), page: String(page), license: "cc0,pdm,by", size: "large", mature: "false", ...(orientation ? { aspect_ratio: ORIENT.openverse[orientation] } : {}) });
      const j = await getJSON(u);
      return (j.results ?? []).filter((p) => p.width && p.height).map((p) => ({ ref: `openverse:${p.id}`, provider: "openverse", w: p.width, h: p.height, by: p.creator ?? "", alt: p.title ?? "", preview: p.thumbnail ?? p.url, page: p.foreign_landing_url ?? p.url, license: ovLicense(p), avgColor: null }));
    },
    async get(id) {
      if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("id de Openverse inválido");
      const p = await getJSON(`https://api.openverse.org/v1/images/${id}/`);
      if (!["cc0", "pdm", "by"].includes(p.license)) throw new Error(`Licencia ${p.license} no permitida: solo CC0, dominio público o CC BY`);
      const { buf } = await fetchBuffer(p.url);
      const lic = ovLicense(p);
      const credit = p.license === "by" ? `"${p.title ?? "Sin título"}" por ${p.creator ?? "autor desconocido"}, ${lic} (${p.foreign_landing_url})` : `${p.creator ? `Foto: ${p.creator}, ` : ""}${lic} (${p.foreign_landing_url})`;
      return { buf, desc: p.title, credit, license: lic, source: p.foreign_landing_url ?? p.url, attributionRequired: p.license === "by" };
    },
  },
};
const ovLicense = (p) => (p.license === "cc0" ? "CC0 1.0" : p.license === "pdm" ? "Dominio público" : `CC ${String(p.license).toUpperCase()} ${p.license_version ?? ""}`.trim());

export const availableProviders = () => Object.keys(PROVIDERS).filter((k) => PROVIDERS[k].key());
export const missingKeys = () => Object.values(PROVIDERS).filter((p) => p.keyName && !p.key()).map((p) => ({ provider: p.label, env: p.keyName, signup: p.signup }));

/**
 * @param {string} query búsqueda en inglés (los bancos indexan en inglés)
 * @returns {{ results: object[], providers: string[], errors: {provider:string,error:string}[] }}
 */
export async function searchStock(query, { provider = "auto", orientation, n = 12, page = 1 } = {}) {
  if (!query?.trim()) throw new Error("Falta la búsqueda");
  if (orientation && !ORIENT.pexels[orientation]) throw new Error("orientation debe ser portrait, landscape o square");
  let names;
  if (provider === "auto" || provider === "all") names = availableProviders();
  else {
    if (!PROVIDERS[provider]) throw new Error(`Proveedor desconocido "${provider}". Opciones: auto, ${Object.keys(PROVIDERS).join(", ")}`);
    if (!PROVIDERS[provider].key()) throw new Error(`Falta ${PROVIDERS[provider].keyName} (gratis en ${PROVIDERS[provider].signup}). Sin clave podés usar --provider openverse.`);
    names = [provider];
  }
  const per = names.length > 1 ? Math.ceil(n / names.length) + 2 : n;
  const settled = await Promise.allSettled(names.map((k) => PROVIDERS[k].search(query, { orientation, n: per, page })));
  const lists = [], errors = [];
  settled.forEach((s, i) => (s.status === "fulfilled" ? lists.push(s.value) : errors.push({ provider: names[i], error: s.reason.message })));
  // Intercalar: una de cada banco por vuelta
  const results = [];
  for (let i = 0; results.length < n && lists.some((l) => i < l.length); i++) for (const l of lists) if (l[i] && results.length < n) results.push(l[i]);
  return { results, providers: names, errors };
}

export async function fetchStock(ref) {
  const i = String(ref).indexOf(":");
  const provider = String(ref).slice(0, i), id = String(ref).slice(i + 1);
  const p = PROVIDERS[provider];
  if (i < 1 || !p || !id) throw new Error("Formato: pexels:<id>, unsplash:<id> u openverse:<id>");
  if (!p.key()) throw new Error(`Falta ${p.keyName} (gratis en ${p.signup})`);
  return p.get(id);
}
