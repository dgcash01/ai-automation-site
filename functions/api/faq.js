// functions/api/faq.js
export const onRequestPost = async ({ request }) => {
  const form = await request.formData();
  const q = (form.get("q") || "").toString().trim();
  if (!q) return html(reply("Please enter a question.")); 

  // --- Tiny "FAQ knowledge base" you can edit quickly ---
  const FAQ = [
    ["hours", "We’re available Monday–Friday, 9am–5pm (CT)."],
    ["pricing", "Starter is $997, Growth is $2,500, and support from $249/mo."],
    ["what do you do", "We design simple AI and automation systems for small businesses."],
    ["turnaround", "Most starter builds are delivered in 5–7 business days."],
    ["consultation", "Yes—book a free consult from the top-right button or email us anytime."],
    ["support", "We offer 30-day handover support and optional monthly maintenance."]
  ];

  // --- simple match: score by keyword overlap ---
  const score = (entry) => {
    const [key] = entry;
    const norm = s => s.toLowerCase();
    return norm(q).includes(norm(key)) ? 2 : // exact keyword hit
           norm(key).split(" ").some(w => norm(q).includes(w)) ? 1 : 0;
  };

  let best = FAQ.map(e => [score(e), e]).sort((a,b) => b[0]-a[0])[0];
  let answer = (best && best[0] > 0) ? best[1][1] 
    : "Great question—this one isn’t in our FAQ yet. We’ll follow up with a tailored answer.";

  return html(renderConversation(q, answer));
};

// --- Helpers: return snippet HTMX will swap into #demo-result ---
const html = (inner) => new Response(inner, {
  headers: { "Content-Type": "text/html; charset=utf-8" }
});

const reply = (text) => `
  <div class="demo-msg ai">
    <div class="avatar">🤖</div>
    <div class="bubble">${escapeHtml(text)}</div>
  </div>
`;

const renderConversation = (q, a) => `
  <div class="demo-msg user">
    <div class="avatar">🧑</div>
    <div class="bubble">${escapeHtml(q)}</div>
  </div>
  <div class="demo-msg ai">
    <div class="avatar">🤖</div>
    <div class="bubble">${escapeHtml(a)}</div>
  </div>
`;

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}
