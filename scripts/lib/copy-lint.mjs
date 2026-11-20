// Copy linter. Detects what makes a post sound templated or AI-written.
// The brand's own phrases (brand/voice-samples.md) are exempt: if the brand uses them, they are fine.
//
// The phrase lists and regexes are organized per language in LISTS (Spanish `es`, English `en`). The linter picks
// the block from the piece's language, then the brand's language, then falls back to `es`.
// The lists are detection data, not UI text: each block is written natively in its language, not translated.
// Adding a language means adding one block to LISTS with the same keys (aiPhrases, fillerHashtags, genericCta,
// stop, figures, and optionally address); nothing else in this file needs to change.
// The category keys (contraste, cierre_generico, …) are part of the issue codes (copy_ai_phrase:<category>)
// and are shared by every language so reports stay comparable: they must not be renamed.

const rx = (s) => new RegExp(s, "imu");

// ---------- Spanish ----------
// Our own categories. Each pattern is a sample of its family, not a closed list:
// the agent must avoid the whole family, not just these forms.
// (The few English patterns in this block predate the English block and stay so Spanish reports do not change.)
const ES_AI_PHRASES = {
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
    // three loose adjectives/nouns in a row: "simple, rápido y efectivo"
    rx(String.raw`\b([\wáéíóúñ]{4,}(ble|ivo|iva|oso|osa|ente|ante|ido|ida|al)),\s+([\wáéíóúñ]{4,}),?\s+(y|e|and)\s+([\wáéíóúñ]{4,})\b`),
  ],
};

const ES_FILLER_HASHTAGS = new Set([
  "love","instagood","photooftheday","fashion","beautiful","happy","follow","followme","like4like","likeforlike",
  "instadaily","picoftheday","motivation","inspiration","viral","fyp","foryou","parati","explore","explorepage",
  "marketing","marketingdigital","emprendedores","emprendimiento","emprender","exito","success","business","negocios",
  "trending","reels","instagram","tbt","goals",
]);

const ES_GENERIC_CTA = [
  rx(String.raw`^\s*(m[aá]s info(rmaci[oó]n)?|saber m[aá]s|ver m[aá]s|learn more|click here|link en (la )?bio)\.?\s*$`),
  rx(String.raw`\b(no dudes en|no dudés en) (contactarnos|escribirnos)\b`),
  rx(String.raw`\b(seguinos|s[ií]guenos) para m[aá]s\b`),
];

const ES_STOP = new Set("para como pero porque cuando donde desde hasta sobre entre este esta estos estas todo toda todos todas sus nuestro nuestra tiene tienen hacer cada mismo misma también tambien with that this your from they have about what more into than then them were been their there which would could should".split(" "));
// Figures that look like results or prices (group 1 = the number).
const ES_FIGURES = /(\d+[.,]?\d*)\s*(%|por ciento|x\b|veces|k\b|mil\b|millones|usd|\$|clientes|usuarios|seguidores|ventas|empresas)|[$€]\s?\d[\d.,]*/giu;

// ---------- English ----------
// Same families and the same category keys as the Spanish block. The rules prefer precision over recall:
// a missed cliché costs less than a warning on a concrete sentence. Each trade-off is noted next to its rule.
const A = String.raw`['’]`; // straight or typographic apostrophe
const BE = String.raw`(?:${A}s|${A}re| is| are)`;
const SUBJ = String.raw`(?:it|this|that|we|they)`;
// Three-item lists only count as a triad when all three words are adjectives. English adjectives have no
// reliable ending, so this is a lexicon of the usual copy adjectives plus the unambiguous suffixes
// (-able/-ible/-ive/-ous/-ful/-less). Endings shared with nouns (-al, -ic, -ent, -y) are left out on purpose:
// "eggs, flour and butter" or "design, music and travel" must not fire.
const EN_ADJ = String.raw`(?:simple|fast|easy|quick|clear|clean|bold|smart|fresh|bright|strong|safe|secure|smooth|sleek|modern|stylish|elegant|beautiful|reliable|scalable|flexible|affordable|efficient|effective|intuitive|powerful|professional|practical|personal|unique|friendly|sustainable|transparent|convenient|accessible|agile|dynamic|authentic|faster|smarter|better|easier|simpler|cheaper|stronger|safer|cleaner|bolder|leaner|[a-z]{3,}(?:able|ible|ive|ous|ful|less))`;

const EN_AI_PHRASES = {
  contraste: [
    // "it's not X, it's Y" · "it's not about X. It's about Y" · "this isn't just X, it's Y".
    // X is capped at 40 characters inside one clause. A literal correction ("It's not ready. It's coming in May")
    // also matches: accepted, the construction is the tell and it is only a warning.
    rx(String.raw`\b${SUBJ}${BE} not (?:just |only |merely |simply |really )?(?:about )?[^.!?\n]{1,40}?[,;:.—–-]+\s*(?:but )?${SUBJ}${BE}\b`),
    rx(String.raw`\b(?:is|are|was)n${A}t (?:just |only |merely |simply |really )?(?:about )?[^.!?\n]{1,40}?[,;:.—–-]+\s*(?:but )?${SUBJ}${BE}\b`),
    // "more than just" always; "more than a/an X" only as a closed claim ("More than a gym.") and never with a
    // quantity ("more than a year", "more than a dozen").
    rx(String.raw`\bmore than just\b`),
    rx(String.raw`\bmore than an? (?!year|month|week|weekend|day|decade|century|hour|minute|second|dozen|hundred|thousand|million|billion|third|quarter|half|few|couple|little|bit|handful|lot)[\w-]+(?: [\w-]+)?\s*(?:[.!:,;—–]|$)`),
    rx(String.raw`\bnot (?:only|just|merely) [^.!?\n]{1,60}?,? but (?:also )?`),
  ],
  cierre_generico: [
    rx(String.raw`\bit${A}?s (?:really |just )?(?:that|as) (?:simple|easy)\b|\b(?:simple|easy) as that\b`),
    rx(String.raw`\b(?:and )?the rest is history\b`),
    rx(String.raw`\bdon${A}?t miss (?:out|it|this|your chance)\b|\byou (?:won${A}?t|don${A}?t) want to miss\b`),
    rx(String.raw`\bwhat are you waiting for\b`),
    rx(String.raw`\bstay tuned\b`),
    rx(String.raw`\bthe (?:possibilities|opportunities|options) are (?:endless|limitless)\b|\bthe sky${A}?s the limit\b`),
    rx(String.raw`\bbecause you(?: deserve|${A}re worth) (?:it|the best|better)\b`),
    rx(String.raw`\b(?:let us know|tell us|share your thoughts|sound off|drop (?:a|an|your) [\w-]+) (?:down )?in the comments\b`),
    rx(String.raw`\b(?:we )?can${A}?t wait to (?:see|welcome|meet) you\b`),
    // Bare "that's it" is ordinary speech; only the wrap-up forms count.
    rx(String.raw`\band that${A}?s it\b|\bthat${A}?s all (?:there is to it|it takes)\b`),
  ],
  verbo_folleto: [
    // "unlock" stays literal for things that have a lock ("unlock your phone").
    rx(String.raw`\bunlock(?:s|ed|ing)?\b(?! (?:the |your |a |my )?(?:door|phone|screen|device|account|car|bike|lock|gate|box|safe)\b)`),
    rx(String.raw`\b(?:unleash|supercharg|turbocharg|skyrocket|revolutioni[sz]|reimagin|redefin)(?:e|es|ed|ing|s)?\b`),
    rx(String.raw`\bempower(?:s|ed|ing|ment)?\b`),
    // "elevated" alone is often literal (elevated heart rate, elevated train): only the verb forms count.
    rx(String.raw`\belevat(?:e|es|ing)\b|\belevated (?:your|our|the way)\b`),
    // "transform" is a plain verb in "we transform CSV exports into dashboards": only the promise forms count
    // (transform your …, transform the way …, transform lives). "Transform your CSV into a chart" still fires.
    rx(String.raw`\btransform(?:s|ed|ing)? (?:your|the way|how (?:you|we|teams|people)|lives|businesses|everything)\b`),
    rx(String.raw`\btak(?:e|es|ing) [^.!?\n]{1,40}? to (?:the|a) (?:next|whole new|new|another) level\b`),
    rx(String.raw`\bharness(?:es|ed|ing)? the (?:full |true |raw )?(?:power|potential) of\b`),
    rx(String.raw`\b(?:discover|experience|embrace|tap into) the (?:power|magic|future|difference) of\b`),
    // "boost/maximize/amplify your …" is the promise form; "optimize" is left out (too common in technical copy).
    rx(String.raw`\b(?:boost|maximi[sz]e|amplify) your\b`),
    // "leverage" as a noun is a finance term: only verb + typical object.
    rx(String.raw`\bleverag(?:e|es|ed|ing) (?:your|our|the|ai|data|technology)\b`),
    // "dive into the reef" is literal: only "delve" and the abstract dives count ("let's dive in" is an opener).
    rx(String.raw`\bdelv(?:e|es|ed|ing)\b|\bdeep dive\b|\b(?:dive|dives|diving) (?:deep(?:er)? )?into (?:the world|the details|the data|how|why|what)\b`),
  ],
  adjetivo_vacio: [
    // "next-level" is skipped inside "to the next level" (already reported as a brochure verb).
    rx(String.raw`\b(?:game[- ]chang(?:ing|ers?)|cutting[- ]edge|state[- ]of[- ]the[- ]art|world[- ]class|best[- ]in[- ]class|next[- ]gen|top[- ]notch|industry[- ]leading|second to none|one[- ]of[- ]a[- ]kind|(?:high|top|premium)[- ]quality)\b|(?<!to the )\bnext[- ]level\b`),
    rx(String.raw`\b(?:innovative|unparalleled|unrivall?ed|unmatched|groundbreaking|transformative|amazing|incredible|awesome|stunning|unforgettable)\b`),
    // "seamless" is a product term for garments and building materials.
    rx(String.raw`\bseamless(?:ly)?\b(?! (?:leggings?|bras?|underwear|socks|tights|knit|gutters?|pipes?|tub(?:e|es|ing)|steel|flooring|pattern|texture|loop)\b)`),
    rx(String.raw`\brevolutionary\b(?! (?:war|guard|era|period|france)\b)`),
    // "robust" is fine in a technical spec ("robust to packet loss"): only the brochure collocations count.
    rx(String.raw`\brobust (?:solutions?|platform|suite|ecosystem|offering|feature set|set of (?:features|tools))\b`),
  ],
  apertura_gastada: [
    rx(String.raw`\bdid you know\b`),
    // Only sentence-initial "Imagine …" (the hypothetical opener), not "hard to imagine" or the band.
    rx(String.raw`(?<=^\s*|[.!?…]\s+)imagine\b(?! dragons)|\bpicture this\b`),
    rx(String.raw`\bin today${A}?s (?:(?:fast[- ]paced|digital|modern|competitive|busy|ever[- ]changing|hyper[- ]?connected) )?(?:world|age|era|landscape|market|economy|society|environment)\b`),
    rx(String.raw`\bever[- ](?:evolving|changing)\b|\bin (?:the|an?|our) (?:fast[- ]paced|rapidly (?:evolving|changing))\b`),
    rx(String.raw`\bnow more than ever\b|\bmore (?:important|relevant|critical) than ever\b`),
    rx(String.raw`\bin a world (?:where|that|full of)\b`),
    rx(String.raw`\blet${A}?s (?:dive|jump|dig) (?:right |straight )?in\b|\blet${A}?s (?:break it down|unpack (?:this|that|it)|face it|be honest)\b`),
    rx(String.raw`\b(?:have you )?ever (?:wondered|asked yourself|stopped to think)\b`),
    rx(String.raw`\bhere${A}?s the (?:thing|truth|deal|kicker)\b`),
    // The ad-style question opener: "Tired of …?", "Struggling with …?".
    rx(String.raw`(?<=^\s*|[.!?…]\s+)(?:are you )?(?:tired of|sick of|struggling (?:with|to))\b[^.!?\n]*\?`),
  ],
  triada: [
    // three loose adjectives in a row: "simple, fast and effective" (see EN_ADJ for why it is a lexicon)
    rx(String.raw`\b${EN_ADJ},\s+${EN_ADJ},?\s+(?:and|&)\s+${EN_ADJ}\b`),
  ],
};

// Tags that reach everyone and therefore no one. Niche tags (#sourdough, #b2bsaas) are never filler.
const EN_FILLER_HASHTAGS = new Set([
  "love","instagood","photooftheday","picoftheday","instadaily","instalike","instamood","beautiful","happy","cute","life","lifestyle",
  "follow","followme","follow4follow","f4f","like4like","likeforlike","l4l","likes","followforfollowback",
  "viral","viralpost","fyp","foryou","foryoupage","explore","explorepage","trending","trendingnow","reels","reelsinstagram","instagram","tiktok","tbt","goals",
  "motivation","motivationmonday","inspiration","inspo","mindset","hustle","grind","quotes","quoteoftheday",
  "success","business","marketing","digitalmarketing","socialmedia","socialmediamarketing","entrepreneur","entrepreneurship","entrepreneurlife","fashion",
]);

// Tested against the last line of a caption. The first rule only matches when the CTA is the whole line
// ("Learn more.", "Link in bio", "Learn more: link in bio"): "Link in bio to book a 20-minute audit" names
// the object and is fine.
const EN_CTA_ACTION = String.raw`(?:learn|find out|read|see|discover|know) more(?: (?:here|now|today|below))?|(?:click|tap) here|check (?:it|this|us) out|get started(?: (?:today|now))?|shop now|sign up (?:today|now)|contact us(?: today)?|get in touch|visit (?:our|the) (?:website|site|page)|swipe up|follow (?:us )?for more`;
const EN_CTA_LINK = String.raw`(?:(?:click|tap|hit|see|check|visit|use|via|at|through) )?(?:the )?link in (?:our |the |my )?bio`;
const EN_GENERIC_CTA = [
  rx(String.raw`^[^\p{L}\p{N}]*(?:(?:${EN_CTA_ACTION})(?:[^\p{L}\p{N}]+${EN_CTA_LINK})?|${EN_CTA_LINK}(?: (?:to|for) (?:${EN_CTA_ACTION}))?)[^\p{L}\p{N}]*$`),
  rx(String.raw`\b(?:don${A}?t|do not) hesitate to (?:contact|reach out|get in touch|message|call|email|dm|ask)\b`),
  rx(String.raw`\bfeel free to (?:contact|reach out|get in touch|message|dm)\b`),
  rx(String.raw`\bfollow (?:us )?for more\b`),
  rx(String.raw`\blike,? (?:comment,? )?(?:and|&) (?:share|follow|subscribe)\b`),
];

const EN_STOP = new Set("with that this your from they have about what more into than then them were been their there which would could should will just also only when where while these those some most very much many each every other over under after before because does doing done being here make makes made want need like same such even still ours yours ourselves yourself".split(" "));

// "times" is left out ("3 times a week" is a schedule, and multipliers are written "3x").
const EN_FIGURES = /(\d+[.,]?\d*)\s*(%|percent|per cent|x\b|k\b|thousand|million|billion|usd|\$|customers|clients|users|followers|subscribers|members|downloads|sales|companies|businesses)|[$€£]\s?\d[\d.,]*/giu;

// ---------- Language blocks ----------
// `address: true` enables the form-of-address check (vos/tú/usted), which only exists in Spanish.
export const LISTS = {
  es: { aiPhrases: ES_AI_PHRASES, fillerHashtags: ES_FILLER_HASHTAGS, genericCta: ES_GENERIC_CTA, stop: ES_STOP, figures: ES_FIGURES, address: true },
  en: { aiPhrases: EN_AI_PHRASES, fillerHashtags: EN_FILLER_HASHTAGS, genericCta: EN_GENERIC_CTA, stop: EN_STOP, figures: EN_FIGURES, address: false },
};
export const DEFAULT_LANGUAGE = "es";
// Kept for backwards compatibility: the Spanish lists under their original names.
export const AI_PHRASES = ES_AI_PHRASES;
export const FILLER_HASHTAGS = ES_FILLER_HASHTAGS;

// "en-US" → "en". Returns the first candidate that has a block (piece, then brand), else the default.
export function resolveLanguage(...candidates) {
  for (const c of candidates) {
    const code = typeof c === "string" ? c.trim().toLowerCase().split(/[-_]/)[0] : "";
    if (code && Object.hasOwn(LISTS, code)) return code;
  }
  return DEFAULT_LANGUAGE;
}

const EMOJI = /\p{Extended_Pictographic}/u;
const DASH = /[—–]/;
const MARKDOWN = /(\*\*[^*]+\*\*|__[^_]+__|^#{1,6}\s|`[^`]+`)/m;

// content words, reduced to a 5-letter stem (llevar/llevá → lleva)
const words = (s, stop) => (s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").match(/[a-zñ0-9]{4,}/g) ?? []).filter((w) => !stop.has(w)).map((w) => w.slice(0, 5));
const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();

export function jaccard(a, b, language = DEFAULT_LANGUAGE) {
  const stop = LISTS[resolveLanguage(language)].stop;
  const A = new Set(words(a, stop)), B = new Set(words(b, stop));
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

// Form of address (Spanish only): detects voseo / tuteo / usted from common verb forms.
// Unambiguous forms only: "prueba", "mira" or "entra" can be nouns or third person.
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
 * @param {{n:number, texts:{id:string, role:string, text:string}[]}[]} p.slides  visible texts per slide
 * @param {object} p.captions  { instagram, linkedin, tiktok, x: { thread: [] } }
 * @param {string} p.voiceSamples  contents of voice-samples.md (exempts phrases the brand uses)
 * @param {string|null} p.address  form of address from the brand kit: "vos" | "tú" | "usted" | null (Spanish copy only)
 * @param {string|null} p.language  the piece's language ("es" | "en"); selects the phrase lists
 * @param {string|null} p.brandLanguage  the brand's language, used when the piece has none. Neither → "es"
 * @param {boolean} p.brandUsesEmoji / brandUsesDashes
 */
export function lintCopy({ slides, captions = {}, voiceSamples = "", address = null, brandUsesEmoji = false, brandUsesDashes = false, brandName = "", verified = [], sources = [], language = null, brandLanguage = null }) {
  const lang = resolveLanguage(language, brandLanguage);
  const L = LISTS[lang];
  const issues = [];
  const add = (code, where, msg, severity = "warn") => issues.push({ code, where, msg, severity });
  const voice = norm(voiceSamples);
  // Backed numbers: those that appear in verified data or in the piece's sources
  const backed = new Set();
  const flat = (x) => (typeof x === "string" ? x : Object.values(x ?? {}).join(" "));
  for (const item of [...(Array.isArray(verified) ? verified : [verified]), ...sources]) for (const n of flat(item).match(/\d[\d.,]*/g) ?? []) backed.add(n.replace(/[^\d]/g, ""));
  const exempt = (match) => match && voice.includes(norm(match));

  const checkText = (where, text) => {
    if (!text) return;
    for (const [cat, list] of Object.entries(L.aiPhrases)) {
      for (const r of list) {
        const m = text.match(r);
        if (m && !exempt(m[0])) { add(`copy_ai_phrase:${cat}`, where, `"${m[0].trim()}" — replace with a concrete fact in the brand's own words`); break; }
      }
    }
    if (!brandUsesDashes && DASH.test(text)) add("copy_dash", where, "long dash (—/–): the brand does not use them");
    if (!brandUsesEmoji && EMOJI.test(text)) add("copy_emoji", where, "emoji: the brand does not use them");
    if (MARKDOWN.test(text)) add("copy_markdown", where, "visible Markdown (** # `)");
    // Figures that look like results or prices: each one must appear in the brand's verified data
    // or in one of the piece's sources (piece.sources). Validated figure by figure.
    for (const m of text.matchAll(L.figures)) {
      const num = (m[1] ?? m[0]).replace(/[^\d]/g, "");
      if (num && !backed.has(num)) add("unsourced_figure", where, `"${m[0].trim()}": unsourced figure. It must appear in brand.json (verified) or in piece.sources with that figure`, "error");
    }
    if (address && L.address) {
      const others = detectAddress(text).filter((x) => x !== address);
      if (others.length) add("copy_address_mismatch", where, `form of address "${others.join("/")}" but the brand uses "${address}"`);
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
      if (n > 8) add("cover_too_long", `slide 1 #${head.id}`, `${n}-word cover (max. 8)`);
    }
    if (head && support && jaccard(head.text, support.text, lang) >= 0.4)
      add("copy_support_repeats_headline", `slide ${s.n}`, "the supporting line repeats the headline in other words");

    if (brandName) {
      const count = s.texts.filter((t) => !t.chrome).reduce((c, t) => c + (norm(t.text).split(norm(brandName)).length - 1), 0);
      if (count > 1) add("copy_brand_repeated", `slide ${s.n}`, `the brand name appears ${count} times in the content`);
    }

    const body = s.texts.filter((t) => !t.chrome).map((t) => t.text).join(" ");
    for (const g of ngrams(body)) {
      if (!allSlideNgrams.has(g)) allSlideNgrams.set(g, new Set());
      allSlideNgrams.get(g).add(s.n);
    }
  }
  const repeated = [...allSlideNgrams].filter(([, set]) => set.size > 1);
  if (repeated.length) add("copy_repeated_phrase", "slides " + [...new Set(repeated.flatMap(([, s]) => [...s]))].join(","), `phrase repeated across slides: "${repeated[0][0]}"`);

  // --- Captions ---
  const cover = slides[0]?.texts.find((t) => t.role === "headline")?.text ?? "";
  const LIMITS = { instagram: 2200, linkedin: 3000, tiktok: 4000 };
  for (const [net, limit] of Object.entries(LIMITS)) {
    const c = captions[net];
    if (!c) continue;
    const where = `caption ${net}`;
    checkText(where, c);
    if (c.length > limit) add("caption_too_long", where, `${c.length} characters (limit ${limit})`, "error");
    const nWords = c.trim().split(/\s+/).length;
    if (net === "instagram" && nWords > 150) add("caption_long", where, `${nWords} words (recommended ≤ 150)`);
    const firstLine = c.split("\n").find((l) => l.trim()) ?? "";
    if (cover && jaccard(firstLine, cover, lang) >= 0.5) add("caption_repeats_cover", where, "the first line repeats the cover; it has to add something new");
    const tags = c.match(/#[\p{L}\p{N}_]+/gu) ?? [];
    if (tags.length > 3) add("copy_too_many_hashtags", where, `${tags.length} hashtags (max. 3)`);
    const filler = tags.filter((t) => L.fillerHashtags.has(t.slice(1).toLowerCase()));
    if (filler.length) add("copy_filler_hashtags", where, `filler hashtags: ${filler.join(" ")}`);
    if (net === "linkedin" && (EMOJI.test(c) || tags.length > 3)) add("linkedin_style", where, "LinkedIn: plain text, no emoji or hashtag chains");
    const lines = c.split("\n").map((l) => l.trim()).filter((l) => l && !/^(#[\p{L}\p{N}_]+\s*)+$/u.test(l));
    const last = lines[lines.length - 1] ?? "";
    if (L.genericCta.some((r) => r.test(last))) add("copy_generic_cta", where, `generic CTA: "${last}" — name the object (what, where, how)`);
  }
  const thread = captions.x?.thread ?? [];
  thread.forEach((tw, i) => {
    checkText(`x tweet ${i + 1}`, tw);
    if (tw.length > 280) add("x_tweet_too_long", `x tweet ${i + 1}`, `${tw.length} characters (max. 280)`, "error");
  });
  if (thread.length > 25) add("x_thread_too_long", "x", `${thread.length} tweets (max. 25)`, "error");

  return issues;
}
