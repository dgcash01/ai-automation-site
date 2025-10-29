# Cloudflare Pages Deployment Guide

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Login to Cloudflare
npx wrangler login

# 3. Deploy
npm run deploy
```

## Detailed Steps

### 1. Prerequisites

- **Node.js** installed (v16 or later)
- **Cloudflare account** (free tier works fine)
- **Git** (optional, for Git-based deployments)

### 2. Install Wrangler CLI

```bash
npm install -g wrangler
# or use npx for one-time commands: npx wrangler ...
```

### 3. Authenticate with Cloudflare

```bash
wrangler login
```

This opens a browser window to authorize Wrangler with your Cloudflare account.

### 4. Deploy Your Site

#### Option A: Direct Upload (Fastest)

```bash
npm run deploy
```

This uploads all files directly to Cloudflare Pages.

#### Option B: Git Integration (Recommended for Production)

1. **Push your code to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/ai-automation-site.git
   git push -u origin main
   ```

2. **Connect via Cloudflare Dashboard**:
   - Go to https://dash.cloudflare.com/
   - Workers & Pages → Create application → Pages
   - Connect to Git → Select your repository
   - Build settings:
     - Framework preset: **None**
     - Build command: (leave empty)
     - Build output directory: **/** (root)
   - Click **Save and Deploy**

3. **Automatic Deployments**:
   - Every push to `main` triggers a new deployment
   - Preview deployments for pull requests

### 5. Custom Domain (Optional)

1. In Cloudflare Dashboard → Your Pages project → Custom domains
2. Click **Set up a custom domain**
3. Enter your domain (e.g., `cashionautomation.com`)
4. Follow the DNS setup instructions

### 6. Environment Variables (If Needed)

If you need API keys or secrets:

1. Go to your Pages project → Settings → Environment variables
2. Add variables for Production and/or Preview environments
3. Access them in `functions/api/faq.js` via `env.VARIABLE_NAME`

Example:
```javascript
export const onRequestPost = async ({ request, env }) => {
  const apiKey = env.OPENAI_API_KEY; // from dashboard
  // ... use apiKey
};
```

## Testing Production Deployment

After deployment, test the FAQ demo:

1. Visit your Cloudflare Pages URL (e.g., `ai-automation-site.pages.dev`)
2. Scroll to the demo section
3. Ask: "What are your hours?"
4. Verify the AI response appears

## Troubleshooting

### "Functions not working"

- Ensure `functions/api/faq.js` exists in your repo
- Check the Functions tab in Cloudflare Dashboard
- View function logs for errors

### "404 on /api/faq"

- Verify the file is at `functions/api/faq.js` (not `function/` or other path)
- Check deployment logs for errors
- Try a hard refresh (Ctrl+Shift+R)

### "CORS errors"

Cloudflare Pages Functions automatically handle same-origin requests. If you need CORS:

```javascript
export const onRequestPost = async ({ request }) => {
  // ... your code
  return new Response(html, {
    headers: {
      "Content-Type": "text/html",
      "Access-Control-Allow-Origin": "*" // adjust as needed
    }
  });
};
```

### "Changes not appearing"

- Wait 1-2 minutes for global CDN propagation
- Hard refresh your browser
- Check deployment status in dashboard

## Deployment Checklist

- [ ] `npm install` completed
- [ ] `wrangler login` successful
- [ ] `npm run deploy` successful
- [ ] Site loads at `*.pages.dev` URL
- [ ] FAQ demo works (submit test question)
- [ ] Mobile responsive design verified
- [ ] Custom domain configured (if applicable)
- [ ] Analytics enabled (optional)

## Rolling Back

If something breaks:

1. Go to Cloudflare Dashboard → Your project → Deployments
2. Find the last working deployment
3. Click "..." → "Rollback to this deployment"

## Production Best Practices

- ✅ Use Git integration for automatic deployments
- ✅ Test in preview deployments before merging to main
- ✅ Enable Cloudflare Analytics
- ✅ Set up a custom domain with HTTPS (automatic with Cloudflare)
- ✅ Monitor function logs for errors
- ✅ Keep dependencies updated (`npm update`)

## Support

- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [Cloudflare Functions Docs](https://developers.cloudflare.com/pages/platform/functions/)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)
