# Deployment Guide - Daniel Avila Portfolio

## 🚀 Quick Deploy to Vercel (Recommended)

Vercel is the recommended platform for deploying Next.js applications.

### Method 1: GitHub Integration (Easiest)

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Connect to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New Project"
   - Import your GitHub repository
   - Vercel will auto-detect Next.js settings
   - Click "Deploy"

3. **Configure Domain** (After first deployment)
   - Go to Project Settings → Domains
   - Add your custom domain (e.g., [danielavila.tech](https://www.danielavila.tech/))
   - Update DNS records as instructed
   - Vercel provides automatic HTTPS

### Method 2: Vercel CLI

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Login**
   ```bash
   vercel login
   ```

3. **Deploy**
   ```bash
   vercel
   ```

4. **Deploy to Production**
   ```bash
   vercel --prod
   ```

## 🔧 Pre-Deployment Checklist

### Update Configuration Files

1. **Update Domain in `src/app/layout.tsx`**
   ```typescript
   metadataBase: new URL("https://www.danielavila.tech/"),
   ```

2. **Update Domain in `public/sitemap.xml`**
   Replace all instances of `https://www.danielavila.tech/` with your domain

3. **Update Domain in `src/app/page.tsx`**
   Update the `url` field in structured data:
   ```typescript
   url: "https://www.danielavila.tech/",
   ```

4. **Update Social Media Links**
   In `src/app/page.tsx`, update:
   - LinkedIn URL
   - GitHub URL
   - Resume URL

### Add Required Images

Place these images in the `/public` folder:

- `profile-image.png` - Your profile photo
- `og-image.png` - Social media preview (1200x630px)
- `favicon.ico` - Browser tab icon
- `icon-192.png` - PWA icon (192x192px)
- `icon-512.png` - PWA icon (512x512px)
- `apple-touch-icon.png` - iOS icon
- `storis-logo.png` - STORIS company logo
- `ccm-logo.png` - County College of Morris logo
- `microsoft-logo.png` - Microsoft logo
- `adda-logo.png` - ADDA logo
- `white-to-blue.png` - Background gradient image
- `blue-to-white.png` - Background gradient image
- `solid-blue-to-white.png` - Background gradient image

### Environment Variables (Optional)

If using analytics or contact forms, create `.env.local`:

```bash
# Copy example file
cp .env.example .env.local

# Edit with your values
NEXT_PUBLIC_SITE_URL=https://www.danielavila.tech/
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
```

Add these in Vercel:
- Go to Project Settings → Environment Variables
- Add each variable

## 🌐 Deploy to Other Platforms

### Netlify

1. **Install Netlify CLI**
   ```bash
   npm install -g netlify-cli
   ```

2. **Build**
   ```bash
   npm run build
   ```

3. **Deploy**
   ```bash
   netlify deploy --prod
   ```

### AWS Amplify

1. Connect your GitHub repository
2. Configure build settings:
   ```yaml
   version: 1
   frontend:
     phases:
       preBuild:
         commands:
           - npm install
       build:
         commands:
           - npm run build
     artifacts:
       baseDirectory: .next
       files:
         - '**/*'
     cache:
       paths:
         - node_modules/**/*
   ```

### Static Export (GitHub Pages, etc.)

If you want a fully static site:

1. **Update `next.config.js`**
   ```javascript
   /** @type {import('next').NextConfig} */
   const nextConfig = {
     output: 'export',
   }

   module.exports = nextConfig
   ```

2. **Build**
   ```bash
   npm run build
   ```

3. **Deploy the `out` folder**

## 📊 Post-Deployment Setup

### 1. Google Search Console

1. Go to [search.google.com/search-console](https://search.google.com/search-console)
2. Add your property
3. Verify ownership (DNS or HTML file)
4. Submit sitemap: `https://www.danielavila.tech/sitemap.xml`

### 2. Google Analytics (Optional)

1. Create GA4 property at [analytics.google.com](https://analytics.google.com)
2. Get your Measurement ID (G-XXXXXXXXXX)
3. Add to `.env.local` or Vercel environment variables

### 3. Social Media Preview Testing

- **Facebook**: [developers.facebook.com/tools/debug](https://developers.facebook.com/tools/debug)
- **Twitter**: [cards-dev.twitter.com/validator](https://cards-dev.twitter.com/validator)
- **LinkedIn**: Share the URL and check preview

### 4. Performance Testing

- **Google PageSpeed**: [pagespeed.web.dev](https://pagespeed.web.dev)
- **GTmetrix**: [gtmetrix.com](https://gtmetrix.com)
- **WebPageTest**: [webpagetest.org](https://webpagetest.org)

### 5. SEO Validation

- **Schema Markup**: [validator.schema.org](https://validator.schema.org)
- **Structured Data**: [search.google.com/test/rich-results](https://search.google.com/test/rich-results)
- **HTML Validator**: [validator.w3.org](https://validator.w3.org)

## 🔄 Continuous Deployment

With Vercel + GitHub:
- Every push to `main` branch auto-deploys to production
- Pull requests create preview deployments
- Automatic HTTPS certificates
- Global CDN distribution
- Automatic image optimization

## 🐛 Troubleshooting

### Build Fails

```bash
# Clear cache and rebuild
rm -rf .next node_modules
npm install
npm run build
```

### Images Not Loading

- Check file names match exactly (case-sensitive)
- Ensure images are in `/public` folder
- Verify image paths start with `/`

### Sitemap Not Found

- Verify `sitemap.xml` is in `/public` folder
- Check file is valid XML
- Ensure it's accessible at `/sitemap.xml`

### SEO Tags Not Showing

- Clear browser cache
- Use incognito/private mode
- Check with social media debuggers
- Verify metadata in `layout.tsx`

## 📈 Monitoring

After deployment, monitor:
- **Uptime**: Vercel dashboard shows deployment status
- **Analytics**: Google Analytics for traffic
- **Search**: Google Search Console for SEO performance
- **Errors**: Vercel logs for runtime errors

## 🔒 Security

- ✅ HTTPS enabled automatically (Vercel)
- ✅ Security headers configured
- ✅ No sensitive data in code
- ✅ Environment variables for secrets
- ✅ CSP headers (Content Security Policy)

## 📱 Domain Setup

### Custom Domain on Vercel

1. Go to Project Settings → Domains
2. Add your domain
3. Update DNS:
   ```
   Type: A
   Name: @
   Value: 76.76.21.21

   Type: CNAME
   Name: www
   Value: cname.vercel-dns.com
   ```
4. Wait for DNS propagation (up to 48 hours)

### SSL Certificate

- Vercel provides free SSL automatically
- Certificate renews automatically
- Forced HTTPS enabled by default

---

## ✅ Deployment Complete!

Your site is now live and optimized for:
- 🚀 Fast loading
- 📱 Mobile devices
- 🔍 Search engines
- 🌐 Social media
- ♿ Accessibility
- 🔒 Security

**Need help?** Contact Camino Code or refer to [Next.js Deployment Docs](https://nextjs.org/docs/deployment)
