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

export const briefKinds = Object.keys(BRIEFS);

/** What is still missing before design can start. */
export function missingAnswers(kind, answers = {}) {
  return BRIEFS[kind].questions.filter((q) => q.required && isEmpty(answers[q.id]));
}
const isEmpty = (v) => v === undefined || v === null || (typeof v === "string" && !v.trim()) || (Array.isArray(v) && !v.length);

/** Questions without an answer yet, in order: required ones first. */
export function nextQuestions(kind, answers = {}, limit = 4) {
  const open = BRIEFS[kind].questions.filter((q) => isEmpty(answers[q.id]));
  return [...open.filter((q) => q.required), ...open.filter((q) => !q.required)].slice(0, limit);
}

/** Flat schema for MCP elicitation (primitives only: string, enum, boolean, number). */
export function elicitationSchema(questions) {
  const properties = {}, required = [];
  for (const q of questions) {
    const base = { title: q.ask.slice(0, 120), description: q.why ?? undefined };
    if (q.type === "choice") properties[q.id] = { ...base, type: "string", enum: q.options };
    else if (q.type === "multi") properties[q.id] = { ...base, type: "string", description: `${q.why ? q.why + " " : ""}Options (combine them or write your own): ${q.options.join(" · ")}` };
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
    lines.push(`**${q.ask}**`, isEmpty(a) ? (q.required ? "_Missing (required)._" : "_No answer._") : Array.isArray(a) ? a.join(", ") : String(a), "");
  }
  return lines.join("\n");
}
