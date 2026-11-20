// El brief: las preguntas que un buen ejecutivo de cuentas hace antes de que alguien abra un archivo.
// Fuente única para el CLI (`opentcy brief`), el servidor MCP (elicitation) y references/brief.md.
//
// Cada pregunta tiene:
//   id        clave donde se guarda la respuesta
//   ask       la pregunta, en palabras de la persona (no jerga de agencia)
//   why       para qué la usa el agente (se muestra si la persona duda)
//   type      text | choice | multi | date | number | boolean
//   options   para choice/multi
//   required  sin esto no se diseña
//   infer     de dónde puede deducirse antes de preguntar: no se pregunta lo que ya está

export const BRIEFS = {
  brand: {
    title: "Cargar una marca",
    intro: "Con esto alcanza para que las piezas se vean y suenen como la marca. Si hay web, la leo primero y solo pregunto lo que no encuentre.",
    questions: [
      { id: "name", ask: "¿Cómo se llama la marca?", type: "text", required: true },
      { id: "url", ask: "¿Tiene web o perfil de Instagram? Pasame el link y leo colores, tipografías, logo y textos.", type: "text", why: "Evita preguntarte lo que ya está publicado." },
      { id: "what", ask: "¿Qué hace y para quién? En una o dos frases, como se lo contarías a alguien en un asado.", type: "text", required: true, infer: "web: título, descripción y titulares" },
      { id: "goal", ask: "¿Para qué quiere estar en redes?", type: "choice", options: ["Que la conozcan", "Generar consultas o ventas", "Fidelizar a quienes ya compran", "Posicionarse como referente", "Reclutar"], required: true },
      { id: "audience", ask: "¿A quién le habla? Pensá en una persona concreta: qué hace, qué le preocupa, qué ya probó.", type: "text", required: true },
      { id: "offer", ask: "¿Qué vende exactamente y cómo se compra o contrata?", type: "text", infer: "web: CTAs y secciones de producto" },
      { id: "feeling", ask: "¿Qué querés que sienta alguien al ver un post de la marca?", type: "multi", options: ["Confianza", "Cercanía", "Ambición", "Calma", "Urgencia", "Curiosidad", "Humor", "Lujo", "Rigor técnico"], required: true, why: "Decide el modo dominante (foto o tipografía), la densidad y la textura." },
      { id: "voice", ask: "¿Cómo habla? ¿De vos, de tú o de usted? ¿Usa emoji? Si tenés 3 a 5 textos reales (posts, mails, la web), pegalos tal cual.", type: "text", required: true, infer: "web: textos; Instagram: captions" },
      { id: "never", ask: "¿Qué no diría ni haría nunca la marca? Palabras, temas, estilos visuales.", type: "text" },
      { id: "pillars", ask: "¿De qué 3 a 5 temas habla siempre?", type: "text", infer: "web: secciones y servicios" },
      { id: "references", ask: "¿Hay cuentas o piezas que te gusten o que no soportes? Decime qué de cada una.", type: "text", why: "Informan estructura y ritmo. Nunca se copian." },
      { id: "assets", ask: "¿Tenés logo en SVG, las tipografías (.woff2) y fotos propias? ¿Puedo usar fotos de banco?", type: "text", required: true },
      { id: "facts", ask: "¿Qué datos puedo afirmar? Precios, resultados, clientes, testimonios. Cada uno con su fuente; lo que no esté acá no lo escribo.", type: "text", why: "El control de calidad bloquea toda cifra sin fuente." },
      { id: "frequency", ask: "¿Cuántas piezas por semana y en qué redes?", type: "text", required: true },
      { id: "country", ask: "¿En qué país está la audiencia?", type: "text", infer: "web: idioma y dominio", why: "Para el calendario comercial." },
    ],
  },
  campaign: {
    title: "Brief de campaña",
    intro: "Una campaña es un mensaje sostenido en varias piezas. Antes de diseñar necesito saber qué tiene que quedar en la cabeza de quien la vea.",
    questions: [
      { id: "message", ask: "¿Qué querés transmitir? Si alguien se acuerda de una sola cosa de la campaña, ¿cuál tiene que ser?", type: "text", required: true, why: "Es la tesis: cada pieza la prueba desde un ángulo distinto." },
      { id: "objective", ask: "¿Qué tiene que pasar para que digas que funcionó?", type: "choice", options: ["Que más gente conozca la marca", "Consultas o leads", "Ventas de algo puntual", "Guardados y compartidos (enseñar)", "Asistentes a un evento", "Lanzar algo nuevo"], required: true },
      { id: "audience", ask: "¿A quién le hablamos esta vez? ¿Es la audiencia de siempre o un grupo puntual?", type: "text", required: true, infer: "brand-kit.md → audiencia" },
      { id: "offer", ask: "¿Hay una oferta, un producto o una fecha concreta? Precio, condiciones, hasta cuándo.", type: "text", why: "Solo se afirma lo que confirmes acá o figure en los datos verificados." },
      { id: "proof", ask: "¿Con qué lo probamos? Datos, casos, testimonios con permiso, demostración del producto.", type: "text", why: "Una campaña sin prueba se queda en adjetivos." },
      { id: "feeling", ask: "¿Qué tono tiene que tener? ¿Igual que siempre o esta vez cambia algo?", type: "multi", options: ["El de siempre", "Más urgente", "Más cálido", "Más técnico", "Más festivo", "Más sobrio"], infer: "brand-kit.md → voz" },
      { id: "channels", ask: "¿Dónde va a salir?", type: "multi", options: ["Instagram feed", "Instagram stories", "LinkedIn", "TikTok", "X", "YouTube", "Anuncios pagos"], required: true },
      { id: "pieces", ask: "¿Cuántas piezas y de qué tipo? Si no sabés, te propongo un plan.", type: "text", infer: "objetivo y duración → plan propuesto" },
      { id: "dates", ask: "¿Desde cuándo y hasta cuándo? ¿Hay una fecha que no se puede mover?", type: "text", required: true },
      { id: "cta", ask: "¿Qué querés que haga la persona después de verla? Una sola acción.", type: "text", required: true },
      { id: "visuals", ask: "¿Con qué imágenes contamos?", type: "choice", options: ["Fotos propias (te las paso)", "Fotos de banco", "Solo tipografía y color", "Mezcla: decidí vos"], required: true },
      { id: "mustInclude", ask: "¿Algo que tenga que aparecer sí o sí? Hashtag, legal, logo de un socio, una frase.", type: "text" },
      { id: "avoid", ask: "¿Algo que no quieras ver ni leer?", type: "text" },
      { id: "approver", ask: "¿Quién aprueba y cuándo necesitás ver la primera versión?", type: "text" },
    ],
  },
  piece: {
    title: "Brief de una pieza",
    intro: "Para una pieza suelta alcanza con poco. Si el pedido ya lo dice, no lo pregunto.",
    questions: [
      { id: "message", ask: "¿Qué querés transmitir con esta pieza? Una idea.", type: "text", required: true },
      { id: "intent", ask: "¿Qué tiene que lograr?", type: "choice", options: ["Opinar", "Enseñar", "Mostrar producto", "Caso / prueba", "Vender", "Novedad / evento", "Comunidad"], required: true, why: "Elige la receta: cantidad de slides, modo y estructura." },
      { id: "format", ask: "¿Qué formato?", type: "choice", options: ["Carrusel 4:5", "Post 4:5", "Post 1:1", "Story 9:16", "Horizontal 16:9"], infer: "red de destino" },
      { id: "facts", ask: "¿Qué datos concretos tiene que llevar? Cifras, precios, fechas, nombres.", type: "text", why: "No invento ninguno." },
      { id: "visuals", ask: "¿Hay una foto que deba usar o la resuelvo con tipografía o banco?", type: "text" },
      { id: "date", ask: "¿Para cuándo?", type: "text" },
    ],
  },
};

export const briefKinds = Object.keys(BRIEFS);

/** Qué falta para poder diseñar. */
export function missingAnswers(kind, answers = {}) {
  return BRIEFS[kind].questions.filter((q) => q.required && isEmpty(answers[q.id]));
}
const isEmpty = (v) => v === undefined || v === null || (typeof v === "string" && !v.trim()) || (Array.isArray(v) && !v.length);

/** Las preguntas que todavía no tienen respuesta, en orden: primero las obligatorias. */
export function nextQuestions(kind, answers = {}, limit = 4) {
  const open = BRIEFS[kind].questions.filter((q) => isEmpty(answers[q.id]));
  return [...open.filter((q) => q.required), ...open.filter((q) => !q.required)].slice(0, limit);
}

/** Esquema plano para MCP elicitation (solo primitivos: string, enum, boolean, number). */
export function elicitationSchema(questions) {
  const properties = {}, required = [];
  for (const q of questions) {
    const base = { title: q.ask.slice(0, 120), description: q.why ?? undefined };
    if (q.type === "choice") properties[q.id] = { ...base, type: "string", enum: q.options };
    else if (q.type === "multi") properties[q.id] = { ...base, type: "string", description: `${q.why ? q.why + " " : ""}Opciones (podés combinar o escribir otra): ${q.options.join(" · ")}` };
    else if (q.type === "boolean") properties[q.id] = { ...base, type: "boolean" };
    else if (q.type === "number") properties[q.id] = { ...base, type: "number" };
    else properties[q.id] = { ...base, type: "string" };
    if (q.required) required.push(q.id);
  }
  return { type: "object", properties, required };
}

export function renderMarkdown(kind, answers = {}) {
  const b = BRIEFS[kind];
  const lines = [`# ${b.title}`, ""];
  for (const q of b.questions) {
    const a = answers[q.id];
    lines.push(`**${q.ask}**`, isEmpty(a) ? (q.required ? "_Falta (obligatoria)._" : "_Sin respuesta._") : Array.isArray(a) ? a.join(", ") : String(a), "");
  }
  return lines.join("\n");
}
