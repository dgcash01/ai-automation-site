// functions/api/faq.js
// Cloudflare Pages Function: POST /api/faq
// Loads /data/faqs.json from the site assets and returns the best-matching answer.

export const onRequestPost = async ({ request, env }) => {
  const form = await request.formData();
  const q = (form.get("q") || "").toString().trim();
  const faqList = await loadFaqs(env, request);

  const best = pickBest(q, faqList);
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

// ---- Helpers ----

// Load /data/faqs.json from the Pages asset bundle (works in preview & prod)
async function loadFaqs(env, request) {
  const url = new URL("/data/faqs.json", request.url);
  const res = await env.ASSETS.fetch(new Request(url.toString(), { method: "GET" }));
  if (!res.ok) return [];
  return await res.json();
}

// ---- Smarter matching (hybrid fuzzy) ----
const STOP = new Set([
  "the","a","an","and","or","to","of","for","in","on","with",
  "do","does","is","are","be","if","it","my","your","our","we",
  "you","us","about","at","by","from","as","that","this"
]);

const SYN = new Map(Object.entries({
  hours: ["time","availability","open","when"],
  pricing: ["price","cost","fee","fees","charge","charges","how much"],
  support: ["help","maintenance","breaks","broken","fix","warranty","guarantee","issue","bug"],
  timeline: ["turnaround","how long","delivery","deadline","schedule"],
  consult: ["consultation","call","meeting","book"],
  starter: ["starter","basic","entry"],
  growth: ["growth","full","advanced","complete"]
}));

function normalize(s) {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenize(s) {
  const norm = normalize(s);
  const out = new Set();

  // First, check for multi-word phrases in synonyms
  let foundPhrase = false;
  for (const [k, arr] of SYN) {
    for (const phrase of arr) {
      if (phrase.includes(" ") && norm.includes(phrase)) {
        out.add(k);
        arr.forEach(v => out.add(v));
        foundPhrase = true;
      }
    }
  }

  // Then tokenize single words
  const t = norm.split(" ").filter(Boolean).filter(w => !STOP.has(w));
  t.forEach(w => out.add(w));

  // Expand single-word synonyms
  for (const w of t) {
    for (const [k, arr] of SYN) {
      if (w === k || arr.includes(w)) {
        out.add(k);
        arr.forEach(v => out.add(v));
      }
    }
  }

  return out;
}


function overlap(A, B) {
  let inter = 0;
  A.forEach(x => { if (B.has(x)) inter++; });
  return inter / Math.max(1, Math.max(A.size, B.size));
}

// pickBest using hybrid score: token overlap is primary
function pickBest(query, faqs) {
  if (!query) return null;
  const qNorm = normalize(query);
  const qTok = tokenize(query);

  const scored = faqs.map(({ q: fq, a }) => {
    const fNorm = normalize(fq);
    const fTok = tokenize(fq);

    // Token overlap is the strongest signal
    const sTok = overlap(qTok, fTok);

    // Exact substring match is a bonus
    const exact = (qNorm.includes(fNorm) || fNorm.includes(qNorm)) ? 0.5 : 0;

    const score = sTok + exact;

    return { score, q: fq, a };
  }).sort((a, b) => b.score - a.score);

  const top = scored[0];
  return top && top.score >= 0.1 ? { q: top.q, a: top.a } : null;
}

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
