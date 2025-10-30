// functions/api/faq.js
// Cloudflare Pages Function: POST /api/faq
// Deterministic FAQ matching (no fuzzy scores).

export const onRequestPost = async ({ request, env }) => {
  const form = await request.formData();
  const rawQ = (form.get("q") || "").toString().trim();
  const q = normalize(rawQ);

  const faqs = await loadFaqs(env, request);
  const hit = pickBest(q, faqs);

  const answer = hit?.a || "Great question — we’ll follow up with a tailored answer.";

  const html = `
    <div class="demo-msg user">
      <div class="avatar">🧑</div>
      <div class="bubble">${escapeHtml(rawQ || "…")}</div>
    </div>
    <div class="demo-msg ai">
      <div class="avatar">🤖</div>
      <div class="bubble">${escapeHtml(answer)}</div>
    </div>
  `;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
};

/* ----------------- Matching ----------------- */

// lightweight synonyms mapped to a canonical “key”
const SYNS = {
  hours: ["hour","hours","open","opening","availability","business hours","when","time"],
  pricing: ["price","prices","cost","fee","fees","charge","charges","how much"],
  support: ["support","help","maintenance","break","breaks","broken","fix","repair","issue","bug","warranty"],
  timeline: ["timeline","timeframe","turnaround","delivery","deadline","schedule","how long","soon"],
  consult: ["consultation","discovery","call","meeting","book"],
};

function normalize(s) {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
function words(s) { return normalize(s).split(" ").filter(Boolean); }
function singular(w) { return w.endsWith("s") ? w.slice(0,-1) : w; }
function set(arr){ return new Set(arr); }

function expandTokens(tokens){
  const expanded = new Set(tokens);
  const joined = tokens.join(" ");
  // phrase synonyms (e.g., "business hours", "how long")
  for (const [canon, arr] of Object.entries(SYNS)){
    if (arr.some(p => joined.includes(p))) expanded.add(canon);
  }
  // word-level synonyms
  for (const t of tokens){
    for (const [canon, arr] of Object.entries(SYNS)){
      if (arr.includes(t)) expanded.add(canon);
    }
  }
  return expanded;
}

function inText(haystack, needle){
  // whole-word contains
  const re = new RegExp(`(^|\\s)${escapeReg(needle)}(\\s|$)`);
  return re.test(haystack);
}
function escapeReg(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function pickBest(q, faqs){
  if (!q) return null;
  const qTokens = words(q).map(singular);
  const qExpanded = expandTokens(qTokens);
  const qText = ` ${q} `;

  // 1) Exact question match
  for (const f of faqs){
    const fq = normalize(f.q);
    if (q === fq) return f;
  }
  // 2) Contains (either direction)
  for (const f of faqs){
    const fq = normalize(f.q);
    if (q.includes(fq) || fq.includes(q)) return f;
  }
  // 3) Key hit (synonyms + explicit keys[] from JSON)
  for (const f of faqs){
    const keys = (f.keys || []).map(k => normalize(k));
    const keyHit =
      keys.some(k => qExpanded.has(k)) ||
      keys.some(k => inText(qText, k));
    if (keyHit) return f;
  }
  // 4) Heuristic: overlap count with FAQ question tokens (stable, no scores)
  let best = null, bestOverlap = 0;
  for (const f of faqs){
    const fqTokens = words(f.q).map(singular);
    const fqSet = set(fqTokens);
    let overlap = 0;
    for (const t of qTokens) if (fqSet.has(t)) overlap++;
    if (overlap > bestOverlap){ bestOverlap = overlap; best = f; }
  }
  return bestOverlap > 0 ? best : null;
}

/* ----------------- Load FAQs (cache-busted) ----------------- */
async function loadFaqs(env, request){
  // cache-bust to avoid reading an old /data/faqs.json after deploy
  const u = new URL("/data/faqs.json", request.url);
  u.searchParams.set("_", Date.now().toString());
  const res = await env.ASSETS.fetch(new Request(u.toString(), { method: "GET" }));
  if (!res.ok) return [];
  return await res.json();
}

/* ----------------- Utils ----------------- */
function escapeHtml(s){
  return s.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}
