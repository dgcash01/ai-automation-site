// functions/api/faq.js
// POST /api/faq  -> returns HTML bubbles with the best-matching FAQ answer.
// Strategy: (1) deterministic keyword overlap via per-FAQ "keys", then
//           (2) TF-IDF cosine similarity over the FAQ titles (q) + keys.

export const onRequestPost = async ({ request, env }) => {
  const form = await request.formData();
  const query = (form.get("q") || "").toString().trim();

  const faqs = await loadFaqs(env, request);       // [{ q, a, keys? }]
  const best = matchFAQ(query, faqs);

  const answer = best
    ? best.a
    : "Great question — this one isn’t in our FAQ yet. We’ll follow up with a tailored answer.";

  const html = `
    <div class="demo-msg user">
      <div class="avatar">🧑</div>
      <div class="bubble">${escapeHtml(query || "…")}</div>
    </div>
    <div class="demo-msg ai">
      <div class="avatar">🤖</div>
      <div class="bubble">${escapeHtml(answer)}</div>
    </div>
  `;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
};

/* ---------- Load assets ---------- */
async function loadFaqs(env, request) {
  const url = new URL("/data/faqs.json", request.url);
  const res = await env.ASSETS.fetch(new Request(url.toString(), { method: "GET" }));
  if (!res.ok) return [];
  const list = await res.json();
  // normalize
  return list
    .filter(x => x && x.q && x.a)
    .map(x => ({ q: String(x.q), a: String(x.a), keys: Array.isArray(x.keys) ? x.keys : [] }));
}

/* ---------- Matcher ---------- */
function matchFAQ(query, faqs) {
  if (!query || !faqs.length) return null;

  // 1) Deterministic keyword overlap (uses per-FAQ "keys")
  const qTok = tokens(query);
  let hard = faqs
    .map(item => {
      const keySet = tokens((item.keys || []).join(" "));
      const hits = intersectCount(qTok, keySet);
      return { item, hits };
    })
    .filter(x => x.hits > 0)
    .sort((a, b) => b.hits - a.hits);
  if (hard.length) return hard[0].item;

  // 2) TF-IDF cosine similarity on (question text + keys)
  const docs = faqs.map(f => (f.q + " " + (f.keys || []).join(" ")));
  const { idf, vocab } = buildIDF(docs);
  const docVecs = docs.map(d => tfidfVector(d, idf, vocab));

  const qVec = tfidfVector(query, idf, vocab);
  const scored = docVecs.map((vec, i) => ({ i, score: cosine(vec, qVec) }))
                        .sort((a, b) => b.score - a.score);

  const top = scored[0];
  // modest floor; adjust if too strict/loose
  if (top && top.score >= 0.08) return faqs[top.i];

  return null;
}

/* ---------- TF-IDF helpers ---------- */
function buildIDF(docs) {
  const vocab = new Map(); // term -> df
  docs.forEach(d => {
    const seen = new Set(tokens(d));
    seen.forEach(t => vocab.set(t, (vocab.get(t) || 0) + 1));
  });
  const N = docs.length;
  const idf = new Map(); // term -> idf
  vocab.forEach((df, term) => idf.set(term, Math.log((N + 1) / (df + 1)) + 1)); // smoothed
  return { idf, vocab: Array.from(vocab.keys()) };
}

function tfidfVector(text, idf, vocabList) {
  const tok = Array.from(tokens(text));
  if (!tok.length) return new Float32Array(vocabList.length);
  const tf = new Map();
  tok.forEach(t => tf.set(t, (tf.get(t) || 0) + 1));
  // l2-normalized tf-idf
  const vec = new Float32Array(vocabList.length);
  let sumSq = 0;
  vocabList.forEach((term, i) => {
    const w = (tf.get(term) || 0) * (idf.get(term) || 0);
    vec[i] = w;
    sumSq += w * w;
  });
  const norm = Math.sqrt(sumSq) || 1;
  for (let i = 0; i < vec.length; i++) vec[i] /= norm;
  return vec;
}

function cosine(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot; // vectors are normalized
}

/* ---------- Text utils ---------- */
function normalize(s) {
  return String(s)
    .toLowerCase()
    .replace(/[“”"’']/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
const STOP = new Set(["the","a","an","and","or","to","of","for","in","on","with","do","does","is","are","be","if","it","my","your","our","we","you","us","about","at","by","from","as","that","this","can","how"]);
function stem(w){ return w.replace(/(ing|ers|er|ed|ly|s)$/g,""); }
function tokens(s){
  return new Set(
    normalize(s).split(" ").filter(Boolean).map(stem).filter(t => t && !STOP.has(t))
  );
}
function intersectCount(A, B) {
  let n = 0; A.forEach(x => { if (B.has(x)) n++; }); return n;
}

function escapeHtml(s){
  return s.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}
