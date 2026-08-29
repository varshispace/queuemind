# QueueMind AI

AI-assisted clinic request-routing platform, built for a hackathon.

QueueMind AI is **not** a diagnosis chatbot. It helps clinic staff process free-text
patient requests faster and more consistently by separating three responsibilities:

- **AI (Gemini) = UNDERSTAND** — extracts structured information from free text
- **Rule Engine = APPLY POLICY** — deterministic code applies the clinic's routing rules
- **Human = DECIDE** — staff approve or override the recommendation; that decision is final

The AI never makes the final routing decision. It cannot even reach the rule engine directly —
its output must pass strict Pydantic validation first, and the rule engine's function signature
only accepts that validated data structure.

## Architecture

```
Patient (free text)
      │
      ▼
FastAPI  /api/intake
      │
      ▼
Gemini API (server-side only) ─── structured JSON extraction
      │
      ▼
Pydantic validation ─── invalid/failed output → manual_review, never guessed
      │
      ▼
Deterministic rule engine (no LLM) ─── applies routing_policy.json
      │
      ▼
Recommendation stored in PostgreSQL
      │
      ▼
Staff Dashboard → Review Page → Approve / Override
      │
      ▼
Final Decision (PostgreSQL) ──► Analytics (computed live from real data)
```

**Hard boundaries enforced in code, not just documentation:**
- `services/gemini_service.py` is the only file that calls Gemini. The frontend never does.
- `services/rule_engine.py` never imports `gemini_service` and its entry point only accepts a
  validated `GeminiExtraction` Pydantic model — it cannot physically see raw LLM text.
- Patient text is passed to Gemini as data inside `<patient_text>` tags with an explicit
  system instruction not to obey embedded commands; a second, independent regex-based check
  in code flags likely prompt-injection attempts regardless of what Gemini reports.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + Tailwind CSS + Recharts |
| Backend | Python + FastAPI + Pydantic |
| AI | Google Gemini API (`google-genai` SDK), server-side only |
| Database | PostgreSQL (Neon), SQLAlchemy ORM |
| Deployment | Frontend → Vercel; Backend → Railway/Render; DB → Neon |

## Project structure

```
backend/
  app/
    main.py                 FastAPI app, CORS, error handlers
    config.py                Env-var driven settings
    database.py               SQLAlchemy engine/session
    models/models.py          PatientRequest, Extraction, Recommendation, Decision
    schemas/extraction.py     Strict Pydantic schema for Gemini output
    schemas/api.py            Request/response schemas for the API
    services/gemini_service.py     Real Gemini API integration
    services/validation_service.py Validation gate + retry + fail-safe
    services/rule_engine.py        Deterministic routing logic
    services/analytics_service.py  Real metrics from the database
    routes/                   intake, review, queue, analytics, policy
    policy/routing_policy.json      Editable clinic routing policy
    seed_demo_data.py         Synthetic demo data through the real pipeline
  tests/                     Rule engine, validation, policy unit tests
frontend/
  src/
    pages/                   Landing, PatientRequest, StaffDashboard, ReviewPage, Analytics, PolicyAdmin
    api/client.js             Only place the frontend calls the backend
    components/NavBar.jsx
```

## Local setup

### Backend

```bash
cd backend
python3 -m venv venv && source venv/bin/activate     # optional but recommended
pip install -r requirements.txt
cp .env.example .env      # then fill in GEMINI_API_KEY and DATABASE_URL
uvicorn app.main:app --reload --port 8000
```

Visit `http://localhost:8000/docs` for interactive API docs.

Optional: seed synthetic demo data (makes real Gemini calls, so it uses your API quota):

```bash
python -m app.seed_demo_data
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env      # VITE_API_URL=http://localhost:8000
npm run dev
```

Visit `http://localhost:5173`.

## Environment variables

Backend (`backend/.env`):
```
GEMINI_API_KEY=            # required — never committed, never sent to frontend
GEMINI_MODEL=gemini-2.0-flash
DATABASE_URL=               # required — Neon Postgres connection string
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
ENV=development
```

Frontend (`frontend/.env`):
```
VITE_API_URL=http://localhost:8000
```

`.env` files are git-ignored in both projects. `.env.example` files show the required shape
with no real values.

## Testing

```bash
cd backend
python3 -m pytest tests/ -v
```

17 tests cover: rule engine routing logic (routine/priority/urgent/administrative/manual-review
paths, indicator conflicts), Pydantic schema validation (closed vocabularies, confidence bounds,
empty-intents rejection, unknown-field rejection), cross-field consistency correction, prompt-
injection heuristics, and policy file integrity. The rule engine tests construct
`GeminiExtraction` objects directly — no network or LLM call is required, proving the rule
engine is genuinely independent of the AI.

## Deployment

**Backend → Railway or Render**
- Point at `backend/`, build command `pip install -r requirements.txt`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT` (see `Procfile` / `render.yaml`)
- Set `GEMINI_API_KEY`, `DATABASE_URL`, `ALLOWED_ORIGINS` (your Vercel URL) as environment variables

**Frontend → Vercel**
- Point at `frontend/`, framework preset "Vite"
- Set `VITE_API_URL` to your deployed backend URL
- `vercel.json` handles SPA routing rewrites

**Database → Neon**
- Already provisioned; `DATABASE_URL` points at it. Tables are created automatically on backend
  startup (`init_db()` in `main.py`). For a production app you'd migrate to Alembic; this
  create-all-if-missing approach is a reasonable hackathon-scale shortcut.

Once deployed, a judge opens your Vercel URL — no local machine needs to stay running.

## Known sandbox limitation (development environment only)

This project was built in a sandboxed dev environment whose outbound network access is
restricted to package registries (PyPI, npm, GitHub) — it cannot reach `neon.tech` or
`generativelanguage.googleapis.com`. This means:
- The rule engine, Pydantic validation, and policy logic were tested for real (17/17 tests
  passing, no mocks).
- The FastAPI app was started for real and its endpoints (`/`, `/api/health`, `/api/policy`,
  `/api/intake`) were exercised for real — `/api/intake` correctly returns a clean `503` when
  the database is unreachable, rather than crashing or faking success.
- The actual Gemini call and actual Postgres read/write could not be exercised end-to-end from
  this sandbox, purely due to the sandbox's network allowlist. Both integrations are written
  against the real SDKs/connection strings and will work as soon as the backend runs somewhere
  with normal internet access (Railway, Render, your own machine).

## Security notes

- `GEMINI_API_KEY` and `DATABASE_URL` are read only from environment variables, never
  hardcoded, and `.env` is git-ignored in both `backend/` and `frontend/`.
- The frontend never calls Gemini or Postgres directly — only the backend API.
- CORS is restricted to `ALLOWED_ORIGINS`.
- Because real secrets were shared in this chat during development, **rotate the Gemini API key
  and Neon database password before/after the hackathon** if this conversation or its logs could
  be seen by anyone else — pasted credentials should be treated as potentially exposed.

## Product workflow (for judges)

1. Open the site → **Submit a Request** with a free-text description.
2. Watch the real processing states (AI understanding → policy routing → ready for review).
3. Open **Staff Dashboard** → see the request with its AI-suggested queue/priority.
4. Click into it → **Review Page** shows the original text, AI extraction, rule-engine
   reasoning, and lets you **Approve** or **Override** (with a reason).
5. Open **Analytics** → see real, live-computed metrics (routing accuracy, override rate,
   urgency recall, urgent false negatives, latency) — or an honest empty state if there's no
   data yet.
6. Open **Policy** → edit the clinic's operational routing indicators without touching any AI
   model or code.
