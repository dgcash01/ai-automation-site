// functions/api/faq.js
// Deterministic FAQ matching + debug mode

export const onRequestGet = async ({ request, env }) => {
  const url = new URL(request.url);
  const qRaw = (url.searchParams.get("q") || "").toString();
  const faqs = await loadFaqs(env, request);
  const { hit, rule, notes } = match(qRaw, faqs);
  return json({ ok: true, q: qRaw, rule, notes, hit, faqCount: faqs.length });
};

export const onRequestPost = async ({ request, env }) => {
  const form = await request.formData();
  const qRaw = (form.get("q") || "").toString().trim();
  const faqs = await loadFaqs(env, request);
  const { hit } = match(qRaw, faqs);

  const answer = hit?.a || "Great question — we’ll follow up with a tailored answer.";
  const html = `
    <div class="demo-msg user"><div class="avatar">🧑</div><div class="bubble">${escapeHtml(qRaw || "…")}</div></div>
    <div class="demo-msg ai"><div class="avatar">🤖</div><div class="bubble">${escapeHtml(answer)}</div></div>
  `;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
};

/* ---------------- core matching ---------------- */

const SYNS = {
  hours: ["hour","hours","open","opening","availability","business hours","when","time","schedule"],
  pricing: ["price","prices","cost","fee","fees","charge","charges","how much"],
  support: ["support","help","maintenance","break","breaks","broken","fix","repair","issue","bug","warranty","troubleshoot","downtime"],
  timeline: ["timeline","timeframe","turnaround","delivery","deadline","schedule","how long","soon"],
  consult: ["consultation","discovery","call","meeting","book"],
};

function match(qRaw, faqs){
  const notes = [];
  const q = norm(qRaw);
  const qTokens = tokens(q);
  const qJoined = ` ${q} `;

  // Precompute indices
  const exactMap = new Map(); // normalized question -> faq
  const keyMap = [];          // array of {keys:Set, faq}
  for (const f of faqs){
    const fq = norm(f.q);
    exactMap.set(fq, f);
    keyMap.push({
      keys: new Set((f.keys || []).map(norm)),
      faq: f
    });
  }

  // Rule 1: exact question
  if (exactMap.has(q)) {
    return { hit: exactMap.get(q), rule: "exact", notes };
  }

  // Rule 2: contains either way (whole-text)
  for (const f of faqs){
    const fq = norm(f.q);
    if (q.includes(fq) || fq.includes(q)) {
      return { hit: f, rule: "contains", notes: [`fq="${fq}"`] };
    }
  }

  // Expand synonyms seen in the query
  const qCanon = new Set(qTokens);
  for (const [canon, arr] of Object.entries(SYNS)){
    if (arr.some(p => qJoined.includes(` ${p} `))) qCanon.add(canon);
  }

  // Rule 3: keys/synonyms hit
  for (const { keys, faq } of keyMap){
    const hitKey = [...keys].some(k => qCanon.has(k) || inText(qJoined, k));
    if (hitKey) return { hit: faq, rule: "keys", notes: [`matched keys: ${[...keys].filter(k=>qCanon.has(k)).join(", ")}`] };
  }

  // Rule 4: token overlap (simple, stable)
  let best = null, bestOverlap = 0;
  for (const f of faqs){
    const fqTokens = tokens(norm(f.q));
    let overlap = 0;
    for (const t of qTokens) if (fqTokens.has(t)) overlap++;
    if (overlap > bestOverlap){ bestOverlap = overlap; best = f; }
  }
  if (best && bestOverlap > 0) {
    return { hit: best, rule: "overlap", notes: [`overlap=${bestOverlap}`] };
  }

  return { hit: null, rule: "none", notes };
}

/* ---------------- utils ---------------- */

async function loadFaqs(env, request){
  const u = new URL("/data/faqs.json", request.url);
  u.searchParams.set("_", Date.now().toString()); // cache-bust
  const res = await env.ASSETS.fetch(new Request(u.toString(), { method: "GET" }));
  if (!res.ok) return [];
  return await res.json();
}

function norm(s){ return s.toLowerCase().replace(/[^a-z0-9\s]/g," ").replace(/\s+/g," ").trim(); }
function tokens(s){ return new Set(s.split(" ").filter(Boolean).map(singular)); }
function singular(w){ return w.endsWith("s") ? w.slice(0,-1) : w; }
function inText(haystack, needle){
  const re = new RegExp(`(^|\\s)${escapeReg(needle)}(\\s|$)`);
  return re.test(haystack);
}
function escapeReg(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function escapeHtml(s){ return s.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function json(obj){
  return new Response(JSON.stringify(obj, null, 2), { headers: { "Content-Type": "application/json" } });
}
