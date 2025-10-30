// functions/api/faq.js
// Cloudflare Pages Function: POST /api/faq
// Deterministic FAQ matching using explicit "keys" phrases + simple token scoring.

export const onRequestPost = async ({ request, env }) => {
  const form = await request.formData();
  const qRaw = (form.get("q") || "").toString();
  const q = norm(qRaw);

  const faqs = await loadFaqs(env, request);
  const best = pickBest(q, faqs);

  const answer = best
    ? best.a
    : "Great question — we’ll follow up with a tailored answer.";

  // Optional debug: append ?debug=1 to the page URL to see scoring
  const debug = new URL(request.url).searchParams.get("debug") === "1";
  const debugBlock = debug && best?._debug
    ? `<pre class="demo-hint" style="white-space:pre-wrap">${escapeHtml(JSON.stringify(best._debug, null, 2))}</pre>`
    : "";

  const html = `
    <div class="demo-msg user">
      <div class="avatar">🧑</div>
      <div class="bubble">${escapeHtml(qRaw || "…")}</div>
    </div>
    <div class="demo-msg ai">
      <div class="avatar">🤖</div>
      <div class="bubble">${escapeHtml(answer)}</div>
    </div>
    ${debugBlock}
  `;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
};

/* ------------------------------ Matching ------------------------------ */

// Minimal normalization
function norm(s) {
  return s.toLowerCase().replace(/["'`]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

// Tiny stemmer (just enough for common variants)
function stem(w) {
  if (w.length <= 3) return w;
  return w
    .replace(/(ing|ed|es|s)$/g, (m) => (m === "s" && w.endsWith("ss") ? "ss" : ""))
    .replace(/[^a-z0-9]/g, "");
}

function tokenSet(s) {
  return new Set(norm(s).split(" ").filter(Boolean).map(stem));
}

// “Keys” can be a string or array. We treat each as a phrase and as tokens.
function featuresFromFaq(fq) {
  const keys = Array.isArray(fq.keys) ? fq.keys : fq.keys ? [fq.keys] : [];
  const keyPhrases = keys.map(norm);
  const keyTokens = new Set(keys.flatMap(k => norm(k).split(" ").map(stem)).filter(Boolean));
  const qTokens = tokenSet(fq.q || "");
  const allTokens = new Set([...keyTokens, ...qTokens]);
  return { keyPhrases, keyTokens, qTokens, allTokens };
}

// Hard synonyms (help the most common demos)
const SYN = new Map(Object.entries({
  support: ["help", "maintenance", "mainten", "break", "breaks", "broken", "fix", "repair", "issue", "bug", "warranty", "troubleshoot"],
  timeline: ["how long", "turnaround", "timeline", "timeframe", "duration", "setup", "set up"],
  deliver: ["deliver", "delivery", "deadline", "soon", "ship", "when"],
}));

function expandTokens(ts) {
  const out = new Set(ts);
  for (const t of ts) {
    for (const [head, list] of SYN) {
      if (t === head || list.includes(t)) {
        out.add(head);
        list.forEach(x => out.add(x));
      }
    }
  }
  return out;
}

function pickBest(q, faqs) {
  if (!q) return null;

  const qTokens = expandTokens(tokenSet(q));

  let scored = faqs.map((fq) => {
    const f = featuresFromFaq(fq);

    // 1) Phrase hit on any key phrase (strongest)
    const phraseHits = f.keyPhrases.filter(p => p && q.includes(p));
    const phraseScore = phraseHits.length > 0 ? 3.0 : 0;

    // 2) Token overlap (keys + question tokens)
    const overlap = intersectSize(qTokens, f.allTokens);
    const tokenScore = overlap * 0.8;

    // 3) Special quick routes
    let rulesBonus = 0;
    if (/\bhow long\b/.test(q)) rulesBonus += 1.0;
    if (/\bhow soon\b|\bdeliver(y)?\b/.test(q)) rulesBonus += 1.0;
    if (/\bbreak|broken|fails?|issue|support|maintenance|warranty\b/.test(q)) rulesBonus += 1.0;

    const score = phraseScore + tokenScore + rulesBonus;

    return {
      score,
      a: fq.a,
      _debug: {
        q,
        faq_q: fq.q,
        phraseHits,
        overlap,
        tokenScore,
        rulesBonus,
        score
      }
    };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored[0];

  // Require a confident score. Phrase hit always counts as confident.
  if (!top) return null;
  if (top._debug.phraseHits.length > 0) return top;
  return top.score >= 2.0 ? top : null;
}

function intersectSize(A, B) {
  let n = 0;
  for (const x of A) if (B.has(x)) n++;
  return n;
}

/* ------------------------------ Data load ------------------------------ */

async function loadFaqs(env, request) {
  try {
    const url = new URL("/data/faqs.json", request.url);
    const res = await env.ASSETS.fetch(new Request(url.href, { method: "GET" }));
    if (!res.ok) return [];
    const data = await res.json();
    // Ensure array of {q,a,keys?}
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/* ------------------------------ Utils ------------------------------ */

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
