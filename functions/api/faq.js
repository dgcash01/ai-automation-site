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
  const t = normalize(s).split(" ").filter(Boolean).filter(w => !STOP.has(w));
  const out = new Set(t);
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

function bigrams(s) {
  const t = normalize(s);
  const bg = new Set();
  for (let i = 0; i < t.length - 1; i++) bg.add(t.slice(i, i + 2));
  return bg;
}

function dice(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  a.forEach(x => { if (b.has(x)) inter++; });
  return (2 * inter) / (a.size + b.size);
}

function overlap(A, B) {
  let inter = 0;
  A.forEach(x => { if (B.has(x)) inter++; });
  return inter / Math.max(1, Math.max(A.size, B.size));
}

// pickBest using hybrid score: exact > dice > token overlap
function pickBest(query, faqs) {
  if (!query) return null;
  const qNorm = normalize(query);
  const qTok = tokenize(query);
  const qBi = bigrams(query);

  const scored = faqs.map(({ q: fq, a }) => {
    const fNorm = normalize(fq);
    const fTok = tokenize(fq);
    const fBi = bigrams(fq);

    const exact = (qNorm.includes(fNorm) || fNorm.includes(qNorm)) ? 1 : 0;
    const sDice = dice(qBi, fBi);
    const sTok = overlap(qTok, fTok);

    const score = exact * 1.0 + sDice * 0.9 + sTok * 0.7;
    return { score, q: fq, a };
  }).sort((a, b) => b.score - a.score);

  const top = scored[0];
  return top && top.score >= 0.20 ? { q: top.q, a: top.a } : null;
}

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
