# Microjournal — Project Reference

---

## What Is This?

A **WhatsApp-first journaling app.**

The idea is simple:
- You get a **daily prompt** via WhatsApp
- You **reply** in text or voice
- Your entry is **saved automatically**
- You can **read back** your entries in the web app

No friction. No opening an app. Just reply and it's done.

---

## Why We Built It This Way

### Why next-forge?
The v1 prototype (archived in `Archived work/`) worked but was fragile.
Next-forge gives us a **production-ready foundation** for free:
- Auth (Clerk) ✓
- Database (Prisma + PostgreSQL) ✓
- Billing (Stripe) ✓
- Observability (Sentry) ✓
- Email (Resend) ✓
- Feature flags ✓

We don't have to build or maintain any of that.

### Why Meta WhatsApp API (not Twilio)?
- **No per-message fee** from a middleman
- Direct connection to Meta's infrastructure
- The same API that *receives* messages also *sends* them
- More control, better reliability at scale

### Why Prisma + PostgreSQL (not Supabase)?
- Supabase is great for quick prototypes
- Prisma gives us **type-safe queries** across the whole monorepo
- PostgreSQL via Neon is serverless-friendly

### Why voice transcription (Whisper)?
- Typing a journal entry takes effort
- Speaking is faster and more natural
- Voice notes sent via WhatsApp get **auto-transcribed** and saved
- This is a key differentiator

---

## What We Built

### Packages
| Package | What it does |
|---------|-------------|
| `@repo/whatsapp` | Sends messages via Meta API. Sends prompts + welcome messages. |
| `@repo/whatsapp/transcribe` | Downloads WhatsApp voice notes + transcribes via Whisper |
| `@repo/whatsapp/commands` | Logic for `/summary`, `/streak`, `/export` commands |
| `@repo/database` | Prisma schema — `JournalEntry`, `PhoneMapping`, `UserPreference` |

### Apps — `apps/api` (port 3002)
| Route | What it does |
|-------|-------------|
| `POST /webhooks/whatsapp` | Receives WhatsApp messages, saves entries, handles commands |
| `GET /webhooks/whatsapp` | Handles Meta webhook verification |
| `GET /cron/daily-prompts` | Runs every hour — sends prompts to users at their chosen time |
| `GET /cron/weekly-digest` | Runs Sunday 9 AM UTC — sends AI summary of the week |
| `GET /cron/keep-alive` | Keeps the DB connection warm |

### Apps — `apps/app` (port 3000)
| Route | What it does |
|-------|-------------|
| `/` | Today's entry composer (with mood picker) + recent entries |
| `/entries` | Full history list with search |
| `/entries/[id]` | Single entry detail |
| `/calendar` | Browse entries by date (calendar view) |
| `/settings` | Link phone, set prompt time + timezone |

### Server Actions
| Action | What it does |
|--------|-------------|
| `createEntry(content, mood?)` | Save a new journal entry with optional mood |
| `listEntries(limit, offset)` | Fetch entries for current user |
| `searchEntries(query)` | Full-text search on entry content |
| `deleteEntry(id)` | Delete an entry (owner-checked) |
| `linkPhone(phoneNumber)` | Link a WhatsApp number to your account |
| `getLinkedPhone()` | Get your currently linked number |
| `getPreferences()` | Get prompt time + timezone settings |
| `updatePreferences({promptHour, timezone})` | Save prompt time + timezone |

### WhatsApp Commands (reply in chat)
| Command | What it does |
|---------|-------------|
| `/help` | Shows onboarding instructions |
| `/summary` | AI-generated recap of the last 7 days |
| `/streak` | How many consecutive days you've journaled |
| `/export` | Last 30 entries sent as text |

---

## Database Schema

```
JournalEntry
  id          String   (cuid)
  userId      String   (Clerk user ID)
  content     String
  mood        String?  (optional emoji e.g. "😊")
  source      String   "web" or "whatsapp"
  createdAt   DateTime
  updatedAt   DateTime

PhoneMapping
  id          String   (cuid)
  phoneNumber String   (unique)
  userId      String   (unique — one phone per user)
  createdAt   DateTime
  updatedAt   DateTime

UserPreference
  id          String   (cuid)
  userId      String   (unique)
  promptHour  Int      (0-23, in user's local timezone, default 18)
  timezone    String   (IANA timezone, default "UTC")
  createdAt   DateTime
  updatedAt   DateTime
```

---

## Environment Variables You Need

### Both `apps/app` and `apps/api`
```
WHATSAPP_ACCESS_TOKEN      # From Meta developer portal
WHATSAPP_PHONE_NUMBER_ID   # Your WhatsApp Business phone number ID
WHATSAPP_VERIFY_TOKEN      # A secret string you choose (used for webhook setup)
WHATSAPP_API_VERSION       # Default: v19.0
OPENAI_API_KEY             # For Whisper voice transcription
```

### `apps/api` only
```
CRON_SECRET    # A secret to protect the cron endpoints
```

---

## How to Run

```bash
# Install
pnpm install

# Push database schema
pnpm migrate

# Run everything
pnpm dev

# Or individual apps
pnpm --filter app dev    # Dashboard on port 3000
pnpm --filter web dev    # Landing page on port 3001
pnpm --filter api dev    # API on port 3002
```

---

## Rules — What We Must NOT Do

These protect the quality and maintainability of the project.

### Architecture
- ❌ Do NOT put business logic in UI components — use server actions
- ❌ Do NOT query the database directly from client components
- ❌ Do NOT bypass Clerk auth — always verify `userId` before DB operations
- ❌ Do NOT hardcode API keys or tokens anywhere in code
- ❌ Do NOT add a new package dependency without checking if one already exists in the monorepo

### Database
- ❌ Do NOT use raw SQL — always use the Prisma client (`database.*`)
- ❌ Do NOT delete entries without checking they belong to the current user
- ❌ Do NOT store phone numbers without normalising them first (strip spaces, keep + prefix)

### WhatsApp Webhook
- ❌ Do NOT return a non-200 response to Meta — it will retry and create duplicate entries
- ❌ Do NOT process the same message twice — Meta can send duplicates
- ❌ Do NOT expose the WHATSAPP_ACCESS_TOKEN in client-side code

### UI
- ❌ Do NOT add features beyond what was asked — keep it focused
- ❌ Do NOT create new abstractions for one-off things
- ❌ Do NOT skip loading/error states on client forms

### General
- ❌ Do NOT commit `.env` files — use `.env.example` for documentation
- ❌ Do NOT amend published commits — always create new ones
- ❌ Do NOT skip type-checking — run `pnpm typecheck` before shipping

---

## What's Next (Roadmap Ideas)

See the main conversation for the full discussion.

### Quick wins
- [ ] Search entries (full-text)
- [ ] Custom prompt time (per user timezone)
- [ ] WhatsApp commands: `/summary`, `/streak`, `/export`

### Medium effort
- [ ] Weekly AI digest — summary of the week's entries sent via WhatsApp
- [ ] Mood tracking — add a mood tag to each entry
- [ ] Calendar view — browse entries by date

### Bigger features
- [ ] SMS support (text-only, no voice — simpler onboarding for some users)
- [ ] Web-based voice recorder (record directly in the app)
- [ ] Export to PDF or Markdown
- [ ] Streaks + gentle nudges if you miss a day
