# Daniel Avila - Portfolio Website

A modern, responsive portfolio website for Daniel Avila, Desktop Support Technician and IT Professional based in New Jersey.

**Developed by Camino Code**
Applied AI Systems, Data Science and Product Engineering organization based in New Jersey.
*Build Systems That Think With You.*

- **Founder & CEO / Chief of Product :** Favio Jasso
- **Software Engineer:** John Rey Calesa

---

## 🌟 Features

- **Fully Responsive Design** - Optimized for mobile, tablet, and desktop devices
- **Modern Animations** - Smooth, professional animations using Tailwind CSS
- **SEO Optimized** - Complete with metadata, Open Graph tags, and structured data
- **Mobile-First Navigation** - Hamburger menu for mobile devices
- **Accessibility** - Semantic HTML and ARIA labels
- **Performance Optimized** - Fast loading with Next.js 15 and Turbopack

## 🛠️ Tech Stack

- **Framework**: Next.js 15.5.4
- **Styling**: Tailwind CSS 4
- **Language**: TypeScript
- **Fonts**: Monda & Quicksand (via Bunny Fonts)

## 📦 Installation & Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 🎨 Sections

1. **Home/Header** - Hero section with profile image and role
2. **About Me** - Professional introduction and background
3. **Skills** - Core competencies with animated cards
4. **Experience** - Work history and certifications
5. **Projects** - Showcase of professional projects
6. **Contact** - Contact form and social media links

## 🔍 SEO Features

- ✅ Complete metadata (title, description, keywords)
- ✅ Open Graph tags for social media sharing
- ✅ Twitter Card support
- ✅ JSON-LD structured data (Schema.org Person)
- ✅ Sitemap.xml
- ✅ Robots.txt
- ✅ PWA manifest.json
- ✅ Canonical URLs
- ✅ Proper semantic HTML structure

## 📱 Responsive Breakpoints

- **Mobile**: < 768px
- **Tablet**: 768px - 1024px
- **Desktop**: > 1024px

## 🎭 Animations

Custom keyframe animations implemented:
- `fadeInUp` - Elements fade in while moving up
- `fadeInDown` - Elements fade in while moving down
- `fadeIn` - Simple fade in effect
- `slideInLeft` - Slide in from the left
- `slideInRight` - Slide in from the right
- `scaleIn` - Scale up while fading in
- `float` - Continuous floating animation

## 🚀 Deployment

The site is ready for deployment on platforms like:
- **Vercel** (recommended for Next.js)
- Netlify
- AWS Amplify
- GitHub Pages (with static export)

### Vercel Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

Or connect your GitHub repository to Vercel for automatic deployments.

## 📝 Customization

### Update Personal Information

1. **Contact Links**: Update social media URLs in `src/app/page.tsx`
2. **Structured Data**: Update JSON-LD in `src/app/page.tsx`
3. **Metadata**: Update SEO info in `src/app/layout.tsx`
4. **Domain**: Replace `https://www.danielavila.tech/` with your domain

### Update Colors

- Primary color (blue): `#3970EB`
- Dark color: `#212020`
- Light color: `#F6F6F6`

Update in `src/app/globals.css` and throughout components.

## 📄 Project Structure

```
DanielAvila/
├── src/
│   └── app/
│       ├── globals.css          # Global styles & animations
│       ├── layout.tsx            # Root layout with SEO metadata
│       └── page.tsx              # Main page component
├── public/
│   ├── robots.txt               # Search engine instructions
│   ├── sitemap.xml              # Site structure for SEO
│   ├── manifest.json            # PWA configuration
│   └── [images]                 # Static assets
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

## 🔧 Scripts

- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build for production with Turbopack
- `npm start` - Start production server

## 📚 Learn More

To learn more about the technologies used:

- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)

## 📄 License

© 2025 Daniel Avila. All rights reserved.

---

Made with ❤️ by **Camino Code** 🌸
