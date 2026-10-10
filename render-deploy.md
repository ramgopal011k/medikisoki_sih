# Deploy Backend to Render

## One-time setup (2 min)
1. Sign up at https://render.com (free, no card)
2. Dashboard → New + → Blueprint
3. Connect GitHub repo: ramgopal011k/medikisoki_sih
4. Render detects render.yaml → click Apply
5. Add env vars when prompted (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY, SARVAM_API_KEY, JWT_SECRET)
6. Wait 5 min for first deploy

## Sleep prevention (free tier)
- Free tier sleeps after 15 min idle
- Keep warm: cron-job.org every 5 min → ping /api/hospitals
- OR: open the URL 10 min before demo

## URL
- After deploy: https://medikisoki-backend.onrender.com
- Update frontend/.env VITE_API_URL to this URL
- Update backend/.env CORS_EXTRA_ORIGINS to include Vercel URL

## Redeploy
- Push to main → Render auto-deploys
