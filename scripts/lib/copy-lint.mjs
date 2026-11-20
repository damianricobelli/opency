// Linter de copy. Detecta lo que hace que un post suene a plantilla o a IA.
// Las frases de la marca (brand/voice-samples.md) quedan exentas: si la marca las usa, valen.

const rx = (s) => new RegExp(s, "imu");

// Categorías propias. Cada patrón es una muestra de la familia, no una lista cerrada:
// el agente debe evitar la familia entera, no solo estas formas.
export const AI_PHRASES = {
  contraste: [
    rx(String.raw`\bno es (s[oó]lo |solamente |simplemente )?(un[ao]? )?[\wáéíóúñ]+(,| sino|\.|;)?\s*(es|sino)\b`),
    rx(String.raw`\bno se trata (solo |s[oó]lo )?de\b`),
    rx(String.raw`\bm[aá]s (que|de) (un|una) [\wáéíóúñ]+,? (es|somos)\b`),
    rx(String.raw`\bno (solo|s[oó]lo) [\wáéíóúñ ]{1,30},? sino (tambi[eé]n )?`),
    rx(String.raw`\bit'?s not (just )?(about )?[\w ]{1,25}[,;.—-]+ ?it'?s\b`),
    rx(String.raw`\bmore than (just )?an? \w+`),
  ],
  cierre_generico: [
    rx(String.raw`\bas[ií] de (simple|f[aá]cil)\b`),
    rx(String.raw`\b(y )?el resto es historia\b`),
    rx(String.raw`\bno te lo pierdas\b`),
    rx(String.raw`\b¿?qu[eé] esper[aá]s\??`),
    rx(String.raw`\b(te|los|las) esperamos\b`),
    rx(String.raw`\bporque (vos|t[uú]) (lo )?vale(s|[eé]s)\b`),
    rx(String.raw`\b(contanos|cu[eé]ntanos) en (los )?comentarios\b`),
    rx(String.raw`\bthat'?s (it|all)\b|\bthe rest is history\b|\bwhat are you waiting for\b`),
  ],
  verbo_folleto: [
    rx(String.raw`\bpotenci(á|a|ar|amos|e)\b`),
    rx(String.raw`\btransform(á|a|ar|amos)\b(?! [\d])`),
    rx(String.raw`\brevolucion(á|a|ar|amos)\b`),
    rx(String.raw`\bimpuls(á|a|ar)\s+(tu|su|el|la)\b`),
    rx(String.raw`\beleva(r|á)?\s+(tu|su)\b`),
    rx(String.raw`\bdesbloque(á|a|ar)\b`),
    rx(String.raw`\bmaximiz(á|a|ar)\s+(tu|su)\b`),
    rx(String.raw`\bsumerg(ite|ete|irse)\b`),
    rx(String.raw`\bdescubr[ií] (el poder|c[oó]mo|todo lo)\b`),
    rx(String.raw`\bllev(á|a|ar) (tu|su|el|la) [\wáéíóúñ ]{1,25} al (siguiente|pr[oó]ximo|otro) nivel\b`),
    rx(String.raw`\b(unlock|elevate|supercharge|unleash|empower|revolutioni[sz]e)\b`),
    rx(String.raw`\btake (your|it) [\w ]{0,20}to the next level\b`),
    rx(String.raw`\bdive (in|into)\b`),
  ],
  adjetivo_vacio: [
    rx(String.raw`\b(incre[ií]ble|imperdible|[uú]nic[oa]s? en su tipo|innovador[a]?|revolucionari[oa]|inigualable|espectacular|de primer nivel|de alta calidad|de excelencia|sin igual|asombros[oa])s?\b`),
    rx(String.raw`\b(amazing|incredible|game[- ]changer|cutting[- ]edge|seamless|world[- ]class|best[- ]in[- ]class|next[- ]level)\b`),
  ],
  apertura_gastada: [
    rx(String.raw`^\s*¿?sab[ií]as que\b`),
    rx(String.raw`^\s*imagin(á|a|ate|emos)\b`),
    rx(String.raw`\ben (el mundo|la era|los tiempos) (de hoy|actual|digital|que corren)\b`),
    rx(String.raw`\bhoy m[aá]s que nunca\b`),
    rx(String.raw`\ben un mundo (donde|en el que|cada vez)\b`),
    rx(String.raw`^\s*¿?alguna vez te (preguntaste|has preguntado)\b`),
    rx(String.raw`\b(in today'?s (fast[- ]paced )?world|in a world where|have you ever wondered|did you know)\b`),
  ],
  triada: [
    // tres adjetivos/sustantivos sueltos en serie: "simple, rápido y efectivo"
    rx(String.raw`\b([\wáéíóúñ]{4,}(ble|ivo|iva|oso|osa|ente|ante|ido|ida|al)),\s+([\wáéíóúñ]{4,}),?\s+(y|e|and)\s+([\wáéíóúñ]{4,})\b`),
  ],
};

export const FILLER_HASHTAGS = new Set([
  "love","instagood","photooftheday","fashion","beautiful","happy","follow","followme","like4like","likeforlike",
  "instadaily","picoftheday","motivation","inspiration","viral","fyp","foryou","parati","explore","explorepage",
  "marketing","marketingdigital","emprendedores","emprendimiento","emprender","exito","success","business","negocios",
  "trending","reels","instagram","tbt","goals",
]);

const GENERIC_CTA = [
  rx(String.raw`^\s*(m[aá]s info(rmaci[oó]n)?|saber m[aá]s|ver m[aá]s|learn more|click here|link en (la )?bio)\.?\s*$`),
  rx(String.raw`\b(no dudes en|no dudés en) (contactarnos|escribirnos)\b`),
  rx(String.raw`\b(seguinos|s[ií]guenos) para m[aá]s\b`),
];

const EMOJI = /\p{Extended_Pictographic}/u;
const DASH = /[—–]/;
const MARKDOWN = /(\*\*[^*]+\*\*|__[^_]+__|^#{1,6}\s|`[^`]+`)/m;

const STOP = new Set("para como pero porque cuando donde desde hasta sobre entre este esta estos estas todo toda todos todas sus nuestro nuestra tiene tienen hacer cada mismo misma también tambien with that this your from they have about what more into than then them were been their there which would could should".split(" "));
// palabras de contenido, reducidas a una raíz de 5 letras (llevar/llevá → lleva)
const words = (s) => (s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").match(/[a-zñ0-9]{4,}/g) ?? []).filter((w) => !STOP.has(w)).map((w) => w.slice(0, 5));
const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();

export function jaccard(a, b) {
  const A = new Set(words(a)), B = new Set(words(b));
  if (!A.size || !B.size) return 0;
  let i = 0; for (const w of A) if (B.has(w)) i++;
  return i / (A.size + B.size - i);
}

function ngrams(s, n = 4) {
  const w = norm(s).split(/[^a-zñ0-9]+/).filter(Boolean);
  const out = new Set();
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(" "));
  return out;
}

// Trato: detecta voseo / tuteo / usted por formas verbales frecuentes.
// Solo formas inequívocas: "prueba", "mira" o "entra" pueden ser sustantivos o tercera persona.
const VOS = /(^|[^\p{L}])(tenés|podés|sabés|querés|hacés|necesitás|probá|mirá|entrá|descargá|agendá|pedinos|sumate|registrate|contanos|escribinos|vos)(?![\p{L}])/iu;
const TU  = /(^|[^\p{L}])(tienes|puedes|sabes|quieres|haces|necesitas|regístrate|súmate|cuéntanos|escríbenos|agenda tu|tú)(?![\p{L}])/iu;
const UD  = /(^|[^\p{L}])(usted|ustedes|escríbanos|contáctenos|agende|solicite|conozca)(?![\p{L}])/iu;

export function detectAddress(text) {
  const found = [];
  if (VOS.test(text)) found.push("vos");
  if (TU.test(text)) found.push("tú");
  if (UD.test(text)) found.push("usted");
  return found;
}

/**
 * @param {object} p
 * @param {{n:number, texts:{id:string, role:string, text:string}[]}[]} p.slides  textos visibles por slide
 * @param {object} p.captions  { instagram, linkedin, tiktok, x: { thread: [] } }
 * @param {string} p.voiceSamples  contenido de voice-samples.md (exime frases que la marca usa)
 * @param {string|null} p.address  trato del brand kit: "vos" | "tú" | "usted" | null
 * @param {boolean} p.brandUsesEmoji / brandUsesDashes
 */
export function lintCopy({ slides, captions = {}, voiceSamples = "", address = null, brandUsesEmoji = false, brandUsesDashes = false, brandName = "", verified = [], sources = [] }) {
  const issues = [];
  const add = (code, where, msg, severity = "warn") => issues.push({ code, where, msg, severity });
  const voice = norm(voiceSamples);
  // Números respaldados: los que aparecen en datos verificados o en las fuentes de la pieza
  const backed = new Set();
  const flat = (x) => (typeof x === "string" ? x : Object.values(x ?? {}).join(" "));
  for (const item of [...(Array.isArray(verified) ? verified : [verified]), ...sources]) for (const n of flat(item).match(/\d[\d.,]*/g) ?? []) backed.add(n.replace(/[^\d]/g, ""));
  const exempt = (match) => match && voice.includes(norm(match));

  const checkText = (where, text) => {
    if (!text) return;
    for (const [cat, list] of Object.entries(AI_PHRASES)) {
      for (const r of list) {
        const m = text.match(r);
        if (m && !exempt(m[0])) { add(`copy_ai_phrase:${cat}`, where, `"${m[0].trim()}" — reemplazar por un hecho concreto en palabras de la marca`); break; }
      }
    }
    if (!brandUsesDashes && DASH.test(text)) add("copy_dash", where, "guion largo (—/–): la marca no los usa");
    if (!brandUsesEmoji && EMOJI.test(text)) add("copy_emoji", where, "emoji: la marca no los usa");
    if (MARKDOWN.test(text)) add("copy_markdown", where, "Markdown visible (** # `)");
    // Cifras que parecen resultados o precios: cada una tiene que figurar en un dato verificado de la marca
    // o en una fuente de la pieza (piece.sources). Se valida cifra por cifra.
    for (const m of text.matchAll(/(\d+[.,]?\d*)\s*(%|por ciento|x\b|veces|k\b|mil\b|millones|usd|\$|clientes|usuarios|seguidores|ventas|empresas)|[$€]\s?\d[\d.,]*/giu)) {
      const num = (m[1] ?? m[0]).replace(/[^\d]/g, "");
      if (num && !backed.has(num)) add("unsourced_figure", where, `"${m[0].trim()}": cifra sin fuente. Tiene que estar en brand.json (verified) o en piece.sources con esa cifra`, "error");
    }
    if (address) {
      const others = detectAddress(text).filter((x) => x !== address);
      if (others.length) add("copy_address_mismatch", where, `trato "${others.join("/")}" pero la marca usa "${address}"`);
    }
  };

  // --- Slides ---
  const allSlideNgrams = new Map();
  for (const s of slides) {
    const head = s.texts.find((t) => t.role === "headline");
    const support = s.texts.find((t) => t.role === "support");
    for (const t of s.texts) checkText(`slide ${s.n} #${t.id}`, t.text);

    if (s.n === 1 && head) {
      const n = head.text.trim().split(/\s+/).filter(Boolean).length;
      if (n > 8) add("cover_too_long", `slide 1 #${head.id}`, `portada de ${n} palabras (máx. 8)`);
    }
    if (head && support && jaccard(head.text, support.text) >= 0.4)
      add("copy_support_repeats_headline", `slide ${s.n}`, "la bajada repite el titular con otras palabras");

    if (brandName) {
      const count = s.texts.filter((t) => !t.chrome).reduce((c, t) => c + (norm(t.text).split(norm(brandName)).length - 1), 0);
      if (count > 1) add("copy_brand_repeated", `slide ${s.n}`, `el nombre de la marca aparece ${count} veces en el contenido`);
    }

    const body = s.texts.filter((t) => !t.chrome).map((t) => t.text).join(" ");
    for (const g of ngrams(body)) {
      if (!allSlideNgrams.has(g)) allSlideNgrams.set(g, new Set());
      allSlideNgrams.get(g).add(s.n);
    }
  }
  const repeated = [...allSlideNgrams].filter(([, set]) => set.size > 1);
  if (repeated.length) add("copy_repeated_phrase", "slides " + [...new Set(repeated.flatMap(([, s]) => [...s]))].join(","), `frase repetida entre slides: "${repeated[0][0]}"`);

  // --- Captions ---
  const cover = slides[0]?.texts.find((t) => t.role === "headline")?.text ?? "";
  const LIMITS = { instagram: 2200, linkedin: 3000, tiktok: 4000 };
  for (const [net, limit] of Object.entries(LIMITS)) {
    const c = captions[net];
    if (!c) continue;
    const where = `caption ${net}`;
    checkText(where, c);
    if (c.length > limit) add("caption_too_long", where, `${c.length} caracteres (límite ${limit})`, "error");
    const nWords = c.trim().split(/\s+/).length;
    if (net === "instagram" && nWords > 150) add("caption_long", where, `${nWords} palabras (recomendado ≤ 150)`);
    const firstLine = c.split("\n").find((l) => l.trim()) ?? "";
    if (cover && jaccard(firstLine, cover) >= 0.5) add("caption_repeats_cover", where, "la primera línea repite la portada; tiene que aportar algo nuevo");
    const tags = c.match(/#[\p{L}\p{N}_]+/gu) ?? [];
    if (tags.length > 3) add("copy_too_many_hashtags", where, `${tags.length} hashtags (máx. 3)`);
    const filler = tags.filter((t) => FILLER_HASHTAGS.has(t.slice(1).toLowerCase()));
    if (filler.length) add("copy_filler_hashtags", where, `hashtags de relleno: ${filler.join(" ")}`);
    if (net === "linkedin" && (EMOJI.test(c) || tags.length > 3)) add("linkedin_style", where, "LinkedIn: texto plano, sin emoji ni cadenas de hashtags");
    const lines = c.split("\n").map((l) => l.trim()).filter((l) => l && !/^(#[\p{L}\p{N}_]+\s*)+$/u.test(l));
    const last = lines[lines.length - 1] ?? "";
    if (GENERIC_CTA.some((r) => r.test(last))) add("copy_generic_cta", where, `CTA genérico: "${last}" — nombrar el objeto (qué, dónde, cómo)`);
  }
  const thread = captions.x?.thread ?? [];
  thread.forEach((tw, i) => {
    checkText(`x tweet ${i + 1}`, tw);
    if (tw.length > 280) add("x_tweet_too_long", `x tweet ${i + 1}`, `${tw.length} caracteres (máx. 280)`, "error");
  });
  if (thread.length > 25) add("x_thread_too_long", "x", `${thread.length} tweets (máx. 25)`, "error");

  return issues;
}
