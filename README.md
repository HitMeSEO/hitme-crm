# Hit Me SEO CRM

Client management system for Hit Me SEO.

## Tech Stack
- **Next.js 16** (App Router)
- **Supabase** (Auth + PostgreSQL)
- **Tailwind CSS v4**
- **Vercel** (deployment)

## Setup

```bash
npm install
cp .env.example .env.local
# Fill in your Supabase URL and anon key
npm run dev
```

## Deploy to Vercel

```bash
npm run build
vercel --prod
```

## Environment Variables

Set these in Vercel project settings:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
