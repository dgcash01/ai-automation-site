import express from "express";
import bodyParser from "body-parser";

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(".")); // serves index.html etc.

// --- Fake FAQ endpoint for local testing ---
app.post("/api/faq", (req, res) => {
  const q = (req.body.q || "").toLowerCase();
  let answer = "Good question — we'll follow up with a personalized answer.";

  if (q.includes("hours")) answer = "We’re open Monday–Friday, 9–5 (CT).";
  if (q.includes("pricing")) answer = "Starter $997, Growth $2,500, Support $249/mo.";
  if (q.includes("what")) answer = "We design automation and AI systems for small businesses.";

  const html = `
    <div class="demo-msg user">
      <div class="avatar">🧑</div>
      <div class="bubble">${q}</div>
    </div>
    <div class="demo-msg ai">
      <div class="avatar">🤖</div>
      <div class="bubble">${answer}</div>
    </div>
  `;

  res.setHeader("Content-Type", "text/html");
  res.send(html);
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Demo running on http://localhost:${PORT}`));
