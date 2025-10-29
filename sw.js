// sw.js — mock /api/faq without any backend
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname === '/api/faq' && event.request.method === 'POST') {
    event.respondWith(handleFaq(event.request));
  }
});

async function handleFaq(req) {
  const form = await req.formData();
  const q = (form.get('q') || '').toString().trim().toLowerCase();

  let answer = "Great question — we'll follow up with a tailored answer.";
  if (q.includes('hours'))   answer = "We’re available Monday–Friday, 9am–5pm (CT).";
  if (q.includes('pricing')) answer = "Starter $997, Growth $2,500, Support from $249/mo.";
  if (q.includes('what'))    answer = "We design simple AI + automation systems for small businesses.";
  if (q.includes('support')) answer = "30-day handover support + optional monthly maintenance.";

  const html = `
    <div class="demo-msg user">
      <div class="avatar">🧑</div>
      <div class="bubble">${escapeHtml(q)}</div>
    </div>
    <div class="demo-msg ai">
      <div class="avatar">🤖</div>
      <div class="bubble">${escapeHtml(answer)}</div>
    </div>
  `;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

function escapeHtml(s){ return s.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
