# Cashion Automation Co. Website

A premium dark-themed website for AI automation services, featuring an interactive demo powered by Cloudflare Pages Functions.

## Features

- 🎨 Premium dark theme with golden accents
- 🔷 Animated hexagonal background with interactive spotlight
- 🤖 Live AI FAQ demo (powered by Cloudflare Pages Functions)
- 📱 Fully responsive design
- ⚡ Fast loading with optimized assets

## Local Development

### Option 1: Using Live Server (with Service Worker mock)

1. Install the "Live Server" extension in VS Code
2. Right-click `index.html` and select "Open with Live Server"
3. The service worker (`sw.js`) will mock the `/api/faq` endpoint locally

### Option 2: Using Wrangler (with real Cloudflare Functions)

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open http://localhost:8788

## Deployment to Cloudflare Pages

### First-time Setup

1. **Install Wrangler** (if not already installed):
   ```bash
   npm install -g wrangler
   ```

2. **Login to Cloudflare**:
   ```bash
   wrangler login
   ```

3. **Create a Pages project** (via Cloudflare Dashboard):
   - Go to https://dash.cloudflare.com/
   - Navigate to Workers & Pages → Create application → Pages
   - Choose "Direct Upload"
   - Name your project (e.g., `ai-automation-site`)

### Deploy

Run the deployment command:

```bash
npm run deploy
```

Or with wrangler directly:

```bash
npx wrangler pages deploy . --project-name=ai-automation-site
```

### Update with Git Integration (Recommended)

1. Connect your GitHub repository in the Cloudflare Dashboard
2. Push changes to your main branch
3. Cloudflare will automatically deploy on each push

## Project Structure

```
ai-automation-site/
├── index.html              # Main page
├── assets/
│   ├── css/
│   │   └── styles.css      # All styles
│   └── js/
│       └── app.js          # Client-side JavaScript
├── functions/
│   └── api/
│       └── faq.js          # Cloudflare Pages Function (FAQ endpoint)
├── sw.js                   # Service Worker (local dev mock)
├── wrangler.toml           # Cloudflare configuration
└── package.json            # Project dependencies

```

## Demo FAQ Endpoint

The `/api/faq` endpoint handles demo questions and returns HTML snippets that HTMX swaps into the page.

**Local**: Handled by `sw.js` (Service Worker)
**Production**: Handled by `functions/api/faq.js` (Cloudflare Pages Function)

### Supported Questions

- Hours/availability
- Pricing
- Services ("what do you do")
- Turnaround time
- Consultation info
- Support options

## Technologies Used

- HTML5, CSS3 (with modern features like CSS Grid, Flexbox, backdrop-filter)
- Vanilla JavaScript (no framework dependencies)
- [HTMX](https://htmx.org/) for dynamic form handling
- Cloudflare Pages Functions for serverless API
- Service Worker for local development

## Browser Support

Modern browsers with support for:
- CSS Grid & Flexbox
- CSS Custom Properties (variables)
- backdrop-filter
- SVG masks and patterns
- ES6+ JavaScript

## License

© 2024 Cashion Automation Co. All rights reserved.
# ai-automation-site
