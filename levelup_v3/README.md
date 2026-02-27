## LevelUp Pro (LevelUpPro.net) — Starter Package v0.5

# LevelUp Tech — Starter Package v0.4

Adds:
- Tech Interview button only appears **after HR is completed and passed**
- Tech Interview button is **gold with shimmer** to signal final step
- After passing Tech Interview, a **Congratulations module** pops up **10 minutes later**
- Congratulations module includes **Mock Offer** details + **Download Offer PDF** (client-side jsPDF)

## Run
```bash
npm install
docker compose up -d
cp .env.example .env
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

## Demo
1) Level up via Home → Start Leveling
2) Dashboard → Check Eligibility → sends HR invite
3) Start HR Interview → pass
4) Wait for TECH_INTERVIEW_READY notification to exist (scheduled 15–30 min by HR finish)
5) Dashboard shows the gold **Begin Tech Interview (Final Step)** button
6) Pass Tech → congratulations module appears 10 minutes later with offer + PDF download


### New in v0.5
- Brand rename to **LevelUp Pro**
- Added module selection: **Interviews / Certifications / Professional Development**
- Added Certifications module (A+, Security+, AZ-900 practice)
- Added Professional Development placeholder page


### v0.6 visual pass
- Dashboard redesigned closer to the mock (sidebar + topbar + highlighted notification + progress)


### v0.7
- New marketing Home (landing) with info + Start button
- Onboarding moved to /start (Enter App)


### v0.8
- Applied mock-style shell to Landing (/) and Start (/start)
- Removed global header so pages match the generated UI


### v1.5
- Forced starting-position modal on /start (post-login experience)
- Added Career Outlook modal (roles, salary ranges, certs)


### v1.6
- Replaced splash-only home with a full marketing landing page (How it works, Features, Pricing, Resources)
- Added scroll depth effects (parallax hero background + card)
- Pricing tiers: Free, $5.99/mo Pro, $19.99/mo Premium

### Resume parsing service
- Start: `docker compose up -d resume`
- Configure: set `RESUME_SERVICE_URL` (default `http://localhost:8000`)
- Endpoint: `POST /parse_resume` (multipart form field `file`)
