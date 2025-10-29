// Register service worker for /api/faq mock
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then(reg => console.log('✓ Service Worker registered:', reg.scope))
    .catch(err => console.error('✗ SW registration failed:', err));
}

// Minor mobile polish: scroll 1px to trigger browser UI collapse
window.addEventListener('load', () => { setTimeout(() => window.scrollTo(0, 1), 200); });

// Subtle mouse-follow: nudges the spotlight toward the cursor
(function(){
  const svg = document.querySelector('.bgfx__svg');
  const spot = document.querySelector('.spot');
  if(!svg || !spot) return;

  let targetX = 0, targetY = 0, curX = 960, curY = 540;  // Start at center
  const lerp = (a,b,t)=>a+(b-a)*t;

  window.addEventListener('mousemove', e => {
    const rect = svg.getBoundingClientRect();
    // Convert mouse position to SVG coordinate space (1920x1080)
    targetX = (e.clientX - rect.left) / rect.width  * 1920;
    targetY = (e.clientY - rect.top)  / rect.height * 1080;
  });

  function tick(){
    curX = lerp(curX, targetX, 0.06);
    curY = lerp(curY, targetY, 0.06);
    spot.style.transform = `translate(${curX}px, ${curY}px)`;
    requestAnimationFrame(tick);
  }
  tick();
})();

// Show a lightweight loading state on the demo result box
document.addEventListener('htmx:beforeRequest', (e) => {
  const form = e.detail.elt;
  if (form && form.id === 'demo-form') {
    const mount = document.getElementById('demo-result');
    if (mount) mount.innerHTML = '<div class="demo-hint">Thinking…</div>';
  }
});
