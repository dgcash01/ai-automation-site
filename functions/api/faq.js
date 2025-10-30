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

// Simple “smart” match: combines exact hit, token overlap, and Jaccard similarity.
function pickBest(query, faqs) {
  if (!query) return null;
  const q = norm(query);
  const qTokens = tokens(q);

  let scored = faqs.map(({ q: fq, a }) => {
    const f = norm(fq);
    const fTokens = tokens(f);

    // scores (0..1)
    const exact = q.includes(f) || f.includes(q) ? 1 : 0;
    const overlap = intersectSize(qTokens, fTokens) / Math.max(fTokens.size, 1);
    const jaccard = intersectSize(qTokens, fTokens) / Math.max(unionSize(qTokens, fTokens), 1);

    // weight exact > jaccard > overlap
    const score = exact * 1.0 + jaccard * 0.7 + overlap * 0.4;
    return { score, q: fq, a };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored[0];

  // require a modest threshold so we don't return nonsense
  return top && top.score >= 0.15 ? { q: top.q, a: top.a } : null;

}

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
const tokens = (s) => new Set(s.split(" ").filter(Boolean));
const intersectSize = (A, B) => { let n = 0; A.forEach(t => B.has(t) && n++); return n; };
const unionSize = (A, B) => { const U = new Set(A); B.forEach(t => U.add(t)); return U.size; };

function escapeHtml(s){
  return s.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}
