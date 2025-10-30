// functions/api/faq.js
// Cloudflare Pages Function: POST /api/faq
// Reads /data/faqs.json and returns the best-matching answer.

export const onRequestPost = async ({ request, env }) => {
  const form = await request.formData();
  const q = (form.get("q") || "").toString().trim();
  const faqList = await loadFaqs(env, request);

  const best = pickBest(q, faqList) || fallbackByIntent(q, faqList);
  const answer = best
    ? best.a
    : "Great question — this one isn’t in our FAQ yet. We’ll follow up with a tailored answer.";

  const html = `
    <div class="demo-msg user">
      <div class="avatar">🧑</div>
      <div class="bubble">${escapeHtml(q || "…")}</div>
    </div>
    <div class="demo-msg ai">
      <div class="avatar">🤖</div>
      <div class="bubble">${escapeHtml(answer)}</div>
    </div>
  `;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
};

// ---- Load FAQs from asset bundle ----
async function loadFaqs(env, request) {
  const url = new URL("/data/faqs.json", request.url);
  const res = await env.ASSETS.fetch(new Request(url.toString(), { method: "GET" }));
  if (!res.ok) return [];
  return await res.json();
}

// ---- Intent + fuzzy helpers ----

// tiny stemmer to align “setup/setups/setting up”, “break/breaks/broken”, etc.
function stem(w) {
  return w
    .replace(/(ing|ers|er|ed|ly|s)$/g, "")   // crude but effective for short nouns/verbs
    .replace(/[^a-z0-9]/g, "");
}

const STOP = new Set([
  "the","a","an","and","or","to","of","for","in","on","with",
  "do","does","is","are","be","if","it","my","your","our","we",
  "you","us","about","at","by","from","as","that","this","can","how"
]);

// canonical intents with wide synonyms
const INTENTS = {
  hours:   ["hour","hours","open","when","availability","available","time","schedule"],
  pricing: ["price","pricing","cost","fee","fees","charge","charges","much"],
  support: ["support","help","mainten","maintain","break","breaks","broken","fix","fixed","repair","issue","problem","warranty","guarantee","error","bug"],
  timeline:["timeline","turnaround","deliver","delivery","soon","quick","fast","deadline","schedule","setup","set up","take","completion","timeframe"],
  consult: ["consult","consultation","call","meeting","book","demo","appointment"]
};

function normalize(s) {
  return s.toLowerCase().replace(/[“”"’']/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
function tokens(s) {
  const arr = normalize(s).split(" ").filter(Boolean).map(stem).filter(w => w && !STOP.has(w));
  return new Set(arr);
}
function bigrams(s) {
  const t = normalize(s);
  const bg = new Set();
  for (let i = 0; i < t.length - 1; i++) bg.add(t.slice(i, i + 2));
  return bg;
}
function dice(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0; a.forEach(x => { if (b.has(x)) inter++; });
  return (2 * inter) / (a.size + b.size);
}
function overlap(A, B) {
  let inter = 0; A.forEach(x => { if (B.has(x)) inter++; });
  return inter / Math.max(1, Math.max(A.size, B.size));
}
function guessIntent(qTokens) {
  // returns the best-matching intent key, or null
  let best = null, bestHits = 0;
  for (const [intent, words] of Object.entries(INTENTS)) {
    let hits = 0;
    for (const w of words) if (qTokens.has(stem(w))) hits++;
    if (hits > bestHits) { bestHits = hits; best = intent; }
  }
  return bestHits ? best : null;
}

// ---- Main matcher ----
function pickBest(query, faqs) {
  if (!query) return null;

  const qNorm = normalize(query);
  const qTok  = tokens(query);
  const qBi   = bigrams(query);
  const intent = guessIntent(qTok);

  const scored = faqs.map(({ q: fq, a }) => {
    const fNorm = normalize(fq);
    const fTok  = tokens(fq);
    const fBi   = bigrams(fq);

    const exact = (qNorm.includes(fNorm) || fNorm.includes(qNorm)) ? 1 : 0;
    const sDice = dice(qBi, fBi);      // phrase similarity
    const sTok  = overlap(qTok, fTok); // token overlap

    // intent bonus if FAQ text contains any word from the detected intent list
    let intentBoost = 0;
    if (intent) {
      const intentWords = INTENTS[intent].map(stem);
      for (const w of intentWords) if (fNorm.includes(w)) { intentBoost = 0.25; break; }
    }

    const score = exact*1.0 + sDice*0.9 + sTok*0.7 + intentBoost;
    return { score, q: fq, a };
  }).sort((a, b) => b.score - a.score);

  const top = scored[0];
  // more forgiving threshold after intent bonus + stemming
  return top && top.score >= 0.15 ? { q: top.q, a: top.a } : null;
}

// Fallback: if we still miss, pick a FAQ whose text contains a word from the intent.
function fallbackByIntent(query, faqs) {
  const qTok = tokens(query);
  const intent = guessIntent(qTok);
  if (!intent) return null;

  // Stronger fallback: if any keyword from the intent list appears in the FAQ question, return that
  const words = INTENTS[intent].map(stem);
  const ranked = [];

  for (const { q, a } of faqs) {
    const f = normalize(q);
    let hits = 0;
    for (const w of words) if (f.includes(w)) hits++;
    if (hits) ranked.push({ q, a, hits });
  }

  // If we got any hits, return the FAQ with the most intent matches
  if (ranked.length) {
    ranked.sort((a, b) => b.hits - a.hits);
    return { q: ranked[0].q, a: ranked[0].a };
  }

  // If nothing matches, fallback to any FAQ containing a stem from the query
  for (const { q, a } of faqs) {
    const f = normalize(q);
    for (const w of qTok) if (f.includes(w)) return { q, a };
  }

  return null;
}


function escapeHtml(s) {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
