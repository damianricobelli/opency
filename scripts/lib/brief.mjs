// The brief: the questions a good account manager asks before anyone opens a file.
// Single source for the CLI (`opency brief`), the MCP server (elicitation) and references/brief.md.
// The questions are written in English; the agent asks them in the user's language.
//
// Each question has:
//   id        key the answer is stored under
//   ask       the question, in the user's words (no agency jargon)
//   why       what the agent uses it for (shown if the user hesitates)
//   type      text | choice | multi | date | number | boolean
//   options   for choice/multi
//   required  nothing gets designed without it
//   infer     where it can be inferred from before asking: never ask what is already known

export const BRIEFS = {
  brand: {
    title: "Load a brand",
    intro: "This is enough for pieces to look and sound like the brand. If there is a website I read it first and only ask what I cannot find.",
    questions: [
      { id: "name", ask: "What is the brand called?", type: "text", required: true },
      { id: "url", ask: "Does it have a website or an Instagram profile? Send me the link and I will read colors, typefaces, logo and copy.", type: "text", why: "So I do not ask you what is already published." },
      { id: "what", ask: "What does it do, and for whom? One or two sentences, the way you would tell a friend.", type: "text", required: true, infer: "website: title, description and headings" },
      { id: "goal", ask: "What is it on social media for?", type: "choice", options: ["Get known", "Generate leads or sales", "Retain existing customers", "Become a reference in its field", "Recruit"], required: true },
      { id: "audience", ask: "Who is it talking to? Picture one specific person: what they do, what worries them, what they have already tried.", type: "text", required: true },
      { id: "offer", ask: "What exactly does it sell, and how do people buy or hire it?", type: "text", infer: "website: CTAs and product sections" },
      { id: "feeling", ask: "What should someone feel when they see a post from the brand?", type: "multi", options: ["Trust", "Closeness", "Ambition", "Calm", "Urgency", "Curiosity", "Humor", "Luxury", "Technical rigor"], required: true, why: "It decides the dominant mode (photo or type), density and texture." },
      { id: "voice", ask: "How does it talk? Formal or informal? Does it use emoji? If you have 3 to 5 real texts (posts, emails, the website), paste them as they are.", type: "text", required: true, infer: "website: copy; Instagram: captions" },
      { id: "never", ask: "What would the brand never say or do? Words, topics, visual styles.", type: "text" },
      { id: "pillars", ask: "Which 3 to 5 topics does it always talk about?", type: "text", infer: "website: sections and services" },
      { id: "references", ask: "Any accounts or pieces you love or cannot stand? Tell me what about each one.", type: "text", why: "They inform structure and rhythm. They are never copied." },
      { id: "assets", ask: "Do you have the logo as SVG, the fonts (.woff2) and photos of your own? May I use stock photos?", type: "text", required: true },
      { id: "facts", ask: "Which facts can I state? Prices, results, clients, testimonials. Each with its source; I will not write anything that is not here.", type: "text", why: "Quality control blocks every figure without a source." },
      { id: "frequency", ask: "How many pieces per week, and on which networks?", type: "text", required: true },
      { id: "country", ask: "Which country is the audience in?", type: "text", infer: "website: language and domain", why: "For the commercial calendar." },
    ],
  },
  campaign: {
    title: "Campaign brief",
    intro: "A campaign is one message carried across several pieces. Before designing I need to know what should stay in the mind of whoever sees it.",
    questions: [
      { id: "message", ask: "What do you want to get across? If someone remembers one thing from the campaign, what should it be?", type: "text", required: true, why: "It is the thesis: every piece proves it from a different angle." },
      { id: "objective", ask: "What has to happen for you to call it a success?", type: "choice", options: ["More people know the brand", "Inquiries or leads", "Sales of something specific", "Saves and shares (teaching)", "Event attendance", "Launching something new"], required: true },
      { id: "audience", ask: "Who are we talking to this time? The usual audience or a specific group?", type: "text", required: true, infer: "brand-kit.md → audience" },
      { id: "offer", ask: "Is there an offer, a product or a specific date? Price, conditions, until when.", type: "text", why: "Only what you confirm here or what is in the verified facts gets stated." },
      { id: "proof", ask: "What do we prove it with? Data, cases, testimonials with permission, a product demo.", type: "text", why: "A campaign without proof is just adjectives." },
      { id: "feeling", ask: "What tone should it have? The usual one, or does something change this time?", type: "multi", options: ["The usual", "More urgent", "Warmer", "More technical", "More festive", "More restrained"], infer: "brand-kit.md → voice" },
      { id: "channels", ask: "Where will it run?", type: "multi", options: ["Instagram feed", "Instagram stories", "LinkedIn", "TikTok", "X", "YouTube", "Paid ads"], required: true },
      { id: "pieces", ask: "How many pieces, and of what kind? If you are not sure, I will propose a plan.", type: "text", infer: "objective and duration → proposed plan" },
      { id: "dates", ask: "From when to when? Is there a date that cannot move?", type: "text", required: true },
      { id: "cta", ask: "What should people do after seeing it? One single action.", type: "text", required: true },
      { id: "visuals", ask: "What images do we have?", type: "choice", options: ["Our own photos (I will send them)", "Stock photos", "Type and color only", "A mix: you decide"], required: true },
      { id: "mustInclude", ask: "Anything that must appear no matter what? A hashtag, legal text, a partner's logo, a phrase.", type: "text" },
      { id: "avoid", ask: "Anything you do not want to see or read?", type: "text" },
      { id: "approver", ask: "Who approves, and when do you need to see the first version?", type: "text" },
    ],
  },
  // The first-run wizard: four short chapters, chips instead of essays. `chapter` groups the questions into
  // screens; `suggest` gives the chips for a question depending on an earlier answer (by option index, so it
  // survives translation). The long brand brief above stays for when the agent needs depth.
  start: {
    title: "Set up your brand",
    intro: "Three short steps and your first piece. Everything can be changed later.",
    chapters: { brand: "Let's start with your brand", identity: "Load your identity", goal: "What should your content achieve?" },
    questions: [
      { id: "name", chapter: "brand", ask: "What is the brand called?", type: "text", required: true },
      { id: "what", chapter: "brand", ask: "What does it do? (optional)", type: "text", why: "One line, the way you would tell a friend." },
      { id: "url", chapter: "brand", ask: "Website, if it has one (optional)", type: "text", why: "I read colors, typefaces, logo and copy from it, so you do not have to type them." },
      { id: "frequency", chapter: "brand", ask: "How often do you want to post? (optional)", type: "choice", options: ["Daily", "3 per week", "2 per week", "1 per week", "Every two weeks", "Not sure yet"] },
      { id: "identity", chapter: "identity", ask: "Where does the identity come from?", type: "choice", options: ["Read it from my website", "Start from a preset", "I will give you colors and typefaces"], required: true, infer: "a website in the previous step" },
      { id: "objective", chapter: "goal", ask: "Main objective", type: "choice", options: ["Generate more sales", "Show what I know", "Present something new", "Build community", "Other"], required: true, why: "It decides which piece to make first." },
      { id: "audience", chapter: "goal", ask: "Who do you want to reach?", type: "text", required: true,
        suggest: [["Small-business owners", "B2B founders", "Whoever decides the purchase"], ["People in my field", "Potential customers", "Press and peers"], ["Current customers", "The waiting list", "A new audience"], ["People who already follow me", "People in the field", "Students and customers"], ["Potential customers", "People who already follow me"]] },
      { id: "offer", chapter: "goal", ask: "What do you want to tell or sell first? (optional)", type: "text",
        suggest: [["A call", "A service", "A product"], ["A method", "A lesson learned", "A point of view"], ["A launch", "A new feature", "An event"], ["A story", "A behind the scenes", "A question"], ["A product", "A story"]] },
    ],
  },
  piece: {
    title: "Piece brief",
    intro: "A single piece needs very little. If the request already says it, I do not ask.",
    questions: [
      { id: "message", ask: "What do you want to get across with this piece? One idea.", type: "text", required: true },
      { id: "intent", ask: "What should it achieve?", type: "choice", options: ["Give an opinion", "Teach", "Show the product", "Case / proof", "Sell", "News / event", "Community"], required: true, why: "It picks the recipe: number of slides, mode and structure." },
      { id: "format", ask: "Which format?", type: "choice", options: ["Carousel 4:5", "Post 4:5", "Post 1:1", "Story 9:16", "Landscape 16:9"], infer: "target network" },
      { id: "facts", ask: "Which concrete facts must it carry? Figures, prices, dates, names.", type: "text", why: "I do not make any up." },
      { id: "visuals", ask: "Is there a photo I should use, or do I solve it with type or stock?", type: "text" },
      { id: "date", ask: "When is it for?", type: "text" },
    ],
  },
};

/**
 * The same briefs in other languages, keyed by question id. English above is the source; a language that
 * is missing a string falls back to it. Ids, types and `required` never change with the language.
 */
const TRANSLATIONS = {
  es: {
    labels: { missing: "_Falta (obligatoria)._", empty: "_Sin respuesta._", more: "Unas más y arranco:", options: "Opciones (podés combinar o escribir otra)" },
    brand: {
      title: "Cargar una marca",
      intro: "Con esto alcanza para que las piezas se vean y suenen como la marca. Si hay web, la leo primero y solo pregunto lo que no encuentre.",
      questions: {
        name: { ask: "¿Cómo se llama la marca?" },
        url: { ask: "¿Tiene web o perfil de Instagram? Pasame el link y leo colores, tipografías, logo y textos.", why: "Así no te pregunto lo que ya está publicado." },
        what: { ask: "¿Qué hace y para quién? En una o dos frases, como se lo contarías a un amigo.", infer: "web: título, descripción y titulares" },
        goal: { ask: "¿Para qué quiere estar en redes?", options: ["Que la conozcan", "Generar consultas o ventas", "Fidelizar a quienes ya compran", "Posicionarse como referente", "Reclutar"] },
        audience: { ask: "¿A quién le habla? Pensá en una persona concreta: qué hace, qué le preocupa, qué ya probó." },
        offer: { ask: "¿Qué vende exactamente y cómo se compra o contrata?", infer: "web: CTAs y secciones de producto" },
        feeling: { ask: "¿Qué querés que sienta alguien al ver un post de la marca?", options: ["Confianza", "Cercanía", "Ambición", "Calma", "Urgencia", "Curiosidad", "Humor", "Lujo", "Rigor técnico"], why: "Decide el modo dominante (foto o tipografía), la densidad y la textura." },
        voice: { ask: "¿Cómo habla? ¿Formal o informal? ¿Usa emoji? Si tenés 3 a 5 textos reales (posts, mails, la web), pegalos tal cual.", infer: "web: textos; Instagram: captions" },
        never: { ask: "¿Qué no diría ni haría nunca la marca? Palabras, temas, estilos visuales." },
        pillars: { ask: "¿De qué 3 a 5 temas habla siempre?", infer: "web: secciones y servicios" },
        references: { ask: "¿Hay cuentas o piezas que te gusten o que no soportes? Decime qué de cada una.", why: "Informan estructura y ritmo. Nunca se copian." },
        assets: { ask: "¿Tenés el logo en SVG, las tipografías (.woff2) y fotos propias? ¿Puedo usar fotos de banco?" },
        facts: { ask: "¿Qué datos puedo afirmar? Precios, resultados, clientes, testimonios. Cada uno con su fuente; lo que no esté acá no lo escribo.", why: "El control de calidad bloquea toda cifra sin fuente." },
        frequency: { ask: "¿Cuántas piezas por semana y en qué redes?" },
        country: { ask: "¿En qué país está la audiencia?", infer: "web: idioma y dominio", why: "Para el calendario comercial." },
      },
    },
    campaign: {
      title: "Brief de campaña",
      intro: "Una campaña es un mensaje sostenido en varias piezas. Antes de diseñar necesito saber qué tiene que quedar en la cabeza de quien la vea.",
      questions: {
        message: { ask: "¿Qué querés transmitir? Si alguien se acuerda de una sola cosa de la campaña, ¿cuál tiene que ser?", why: "Es la tesis: cada pieza la prueba desde un ángulo distinto." },
        objective: { ask: "¿Qué tiene que pasar para que digas que funcionó?", options: ["Que más gente conozca la marca", "Consultas o leads", "Ventas de algo puntual", "Guardados y compartidos (enseñar)", "Asistentes a un evento", "Lanzar algo nuevo"] },
        audience: { ask: "¿A quién le hablamos esta vez? ¿La audiencia de siempre o un grupo puntual?", infer: "brand-kit.md → audiencia" },
        offer: { ask: "¿Hay una oferta, un producto o una fecha concreta? Precio, condiciones, hasta cuándo.", why: "Solo se afirma lo que confirmes acá o figure en los datos verificados." },
        proof: { ask: "¿Con qué lo probamos? Datos, casos, testimonios con permiso, demostración del producto.", why: "Una campaña sin prueba se queda en adjetivos." },
        feeling: { ask: "¿Qué tono tiene que tener? ¿El de siempre o esta vez cambia algo?", options: ["El de siempre", "Más urgente", "Más cálido", "Más técnico", "Más festivo", "Más sobrio"], infer: "brand-kit.md → voz" },
        channels: { ask: "¿Dónde va a salir?", options: ["Instagram feed", "Instagram stories", "LinkedIn", "TikTok", "X", "YouTube", "Anuncios pagos"] },
        pieces: { ask: "¿Cuántas piezas y de qué tipo? Si no sabés, te propongo un plan.", infer: "objetivo y duración → plan propuesto" },
        dates: { ask: "¿Desde cuándo y hasta cuándo? ¿Hay una fecha que no se puede mover?" },
        cta: { ask: "¿Qué querés que haga la persona después de verla? Una sola acción." },
        visuals: { ask: "¿Con qué imágenes contamos?", options: ["Fotos propias (te las paso)", "Fotos de banco", "Solo tipografía y color", "Mezcla: decidí vos"] },
        mustInclude: { ask: "¿Algo que tenga que aparecer sí o sí? Hashtag, legal, logo de un socio, una frase." },
        avoid: { ask: "¿Algo que no quieras ver ni leer?" },
        approver: { ask: "¿Quién aprueba y cuándo necesitás ver la primera versión?" },
      },
    },
    start: {
      title: "Armemos tu marca",
      intro: "Tres pasos cortos y tu primera pieza. Todo se puede cambiar después.",
      chapters: { brand: "Empecemos por tu marca", identity: "Cargá tu identidad", goal: "¿Qué tendría que lograr tu contenido?" },
      questions: {
        name: { ask: "¿Cómo se llama la marca?" },
        what: { ask: "¿A qué se dedica? (opcional)", why: "Una línea, como se lo contarías a un amigo." },
        url: { ask: "Sitio web, si tiene (opcional)", why: "De ahí leo colores, tipografías, logo y textos, así no los tenés que cargar." },
        frequency: { ask: "¿Cada cuánto querés postear? (opcional)", options: ["Diario", "3 por semana", "2 por semana", "1 por semana", "Quincenal", "Todavía no sé"] },
        identity: { ask: "¿De dónde sale la identidad?", options: ["Leela de mi sitio web", "Arrancar con un preset", "Te paso colores y tipografías"], infer: "un sitio web en el paso anterior" },
        objective: { ask: "Objetivo principal", options: ["Generar más ventas", "Mostrar lo que sé", "Presentar algo nuevo", "Crear comunidad", "Otro"], why: "Define qué pieza conviene hacer primero." },
        audience: { ask: "¿A quién querés llegar?",
          suggest: [["Dueños de pymes", "Founders B2B", "Quien decide la compra"], ["Gente de mi rubro", "Clientes potenciales", "Medios y colegas"], ["Clientes actuales", "Lista de espera", "Público nuevo"], ["Quienes ya me siguen", "Personas del rubro", "Alumnos y clientes"], ["Clientes potenciales", "Quienes ya me siguen"]] },
        offer: { ask: "¿Qué querés contar o vender primero? (opcional)",
          suggest: [["Una llamada", "Un servicio", "Un producto"], ["Un método", "Un aprendizaje", "Una opinión"], ["Un lanzamiento", "Una función nueva", "Un evento"], ["Una historia", "Un detrás de escena", "Una pregunta"], ["Un producto", "Una historia"]] },
      },
    },
    piece: {
      title: "Brief de una pieza",
      intro: "Para una pieza suelta alcanza con poco. Si el pedido ya lo dice, no lo pregunto.",
      questions: {
        message: { ask: "¿Qué querés transmitir con esta pieza? Una idea." },
        intent: { ask: "¿Qué tiene que lograr?", options: ["Opinar", "Enseñar", "Mostrar el producto", "Caso / prueba", "Vender", "Novedad / evento", "Comunidad"], why: "Elige la receta: cantidad de slides, modo y estructura." },
        format: { ask: "¿Qué formato?", options: ["Carrusel 4:5", "Post 4:5", "Post 1:1", "Story 9:16", "Horizontal 16:9"], infer: "red de destino" },
        facts: { ask: "¿Qué datos concretos tiene que llevar? Cifras, precios, fechas, nombres.", why: "No invento ninguno." },
        visuals: { ask: "¿Hay una foto que deba usar o lo resuelvo con tipografía o banco?" },
        date: { ask: "¿Para cuándo?" },
      },
    },
  },
};
const LABELS = { missing: "_Missing (required)._", empty: "_No answer._", more: "A few more and I will get started:", options: "Options (combine them or write your own)" };

export const briefLanguages = ["en", ...Object.keys(TRANSLATIONS)];
/** "es-AR" → "es"; anything without a translation → "en". */
export const briefLanguage = (lang) => { const base = String(lang ?? "").toLowerCase().split("-")[0]; return briefLanguages.includes(base) ? base : "en"; };
export const briefLabels = (lang) => ({ ...LABELS, ...(TRANSLATIONS[briefLanguage(lang)]?.labels ?? {}) });

/** The brief of a kind in a language: same ids and rules, the user's words. */
export function briefIn(kind, lang) {
  const base = BRIEFS[kind], tr = TRANSLATIONS[briefLanguage(lang)]?.[kind];
  if (!tr) return base;
  return { title: tr.title ?? base.title, intro: tr.intro ?? base.intro, ...(base.chapters ? { chapters: { ...base.chapters, ...(tr.chapters ?? {}) } } : {}), questions: base.questions.map((q) => ({ ...q, ...(tr.questions?.[q.id] ?? {}) })) };
}

export const briefKinds = Object.keys(BRIEFS);

/** What is still missing before design can start. */
export function missingAnswers(kind, answers = {}, lang) {
  return briefIn(kind, lang).questions.filter((q) => q.required && isEmpty(answers[q.id]));
}
const isEmpty = (v) => v === undefined || v === null || (typeof v === "string" && !v.trim()) || (Array.isArray(v) && !v.length);

/** Questions without an answer yet, in order: required ones first. */
export function nextQuestions(kind, answers = {}, limit = 4, lang) {
  const open = briefIn(kind, lang).questions.filter((q) => isEmpty(answers[q.id]));
  return [...open.filter((q) => q.required), ...open.filter((q) => !q.required)].slice(0, limit);
}

/** Flat schema for MCP elicitation (primitives only: string, enum, boolean, number). */
export function elicitationSchema(questions, lang) {
  const properties = {}, required = [], labels = briefLabels(lang);
  for (const q of questions) {
    const base = { title: q.ask.slice(0, 120), description: q.why ?? undefined };
    if (q.type === "choice") properties[q.id] = { ...base, type: "string", enum: q.options };
    else if (q.type === "multi") properties[q.id] = { ...base, type: "string", description: `${q.why ? q.why + " " : ""}${labels.options}: ${q.options.join(" · ")}` };
    else if (q.type === "boolean") properties[q.id] = { ...base, type: "boolean" };
    else if (q.type === "number") properties[q.id] = { ...base, type: "number" };
    else properties[q.id] = { ...base, type: "string" };
    if (q.required) required.push(q.id);
  }
  return { type: "object", properties, required };
}

export function renderMarkdown(kind, answers = {}, lang) {
  const b = briefIn(kind, lang), labels = briefLabels(lang);
  const lines = [`# ${b.title}`, ""];
  for (const q of b.questions) {
    const a = answers[q.id];
    lines.push(`**${q.ask}**`, isEmpty(a) ? (q.required ? labels.missing : labels.empty) : Array.isArray(a) ? a.join(", ") : String(a), "");
  }
  return lines.join("\n");
}

/** The index of a choice answer in its question's options, in whatever language it was given (−1: free text). */
export function optionIndex(kind, id, answer) {
  if (isEmpty(answer)) return -1;
  const norm = (x) => String(x).trim().toLowerCase();
  for (const lang of briefLanguages) {
    const i = (briefIn(kind, lang).questions.find((q) => q.id === id)?.options ?? []).findIndex((o) => norm(o) === norm(answer));
    if (i >= 0) return i;
  }
  return -1;
}
/** The chips for a question whose suggestions depend on an earlier choice (the objective, in the wizard). */
export function suggestionsFor(kind, id, dependsOnIndex, lang) {
  const q = briefIn(kind, lang).questions.find((x) => x.id === id);
  return q?.suggest?.[dependsOnIndex >= 0 ? dependsOnIndex : q.suggest.length - 1] ?? [];
}
