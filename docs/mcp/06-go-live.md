# Go live: Kept in ChatGPT

_Updated: 2026-10-01. ✅ = done by Claude. 👤 = needs you._

**Founder decision (1 Oct):** high risk tolerance. Go live without OpenAI's directory review, then test and learn.

## What "live without review" means

- **It is live on the internet.** Anyone with the link can connect it to ChatGPT in **developer mode** (Plus, Pro or Business, on the web).
- **It is not in the Plugin Directory,** and ChatGPT won't suggest it to strangers. That only happens after OpenAI's review.
- **You choose who gets it:** you, friendly agents, a few executors. That suits test and learn.

---

## Status

| Step | Who | Status |
|:--|:--|:--|
| Merge PR #122 (seller-email fix + plugin code) | ✅ Claude | See PR |
| Public plugin builds with **no secrets** | ✅ Claude | Done |
| Usage logging (privacy-safe) | ✅ Claude | Done |
| **Create the Vercel project** | 👤 You | **2 minutes, below** |
| Connect it in ChatGPT | 👤 You | 2 minutes |
| Turn on Pro (agents and investors) | 👤 You | 5 minutes |
| Your own web address | 👤 You | Optional, later |

**Why you have to do the Vercel part:**
- Claude's Vercel connection isn't allowed to **create projects** (Vercel said "403 Forbidden").
- Claude was also stopped from **copying secrets** between projects. That's a safety rule, and the right one.

---

## 1. Create the Vercel project (2 min) 👤

1. Go to **vercel.com → Add New… → Project**.
2. **Import** `SamIrving94/Bellwood-Lane-Ventures`.
3. **Project Name:** `bellwood-plugin`
4. **Root Directory:** click **Edit** and pick **`apps/plugin`**. ⚠️ This is the only setting that matters.
5. Leave everything else as it is. **No environment variables needed yet.**
6. Click **Deploy**. It takes about 3–5 minutes.

**Then check one setting:**

7. **bellwood-plugin → Settings → Deployment Protection → Vercel Authentication.**
   - It must say **"Standard Protection"** (previews only).
   - If it says "All Except Custom Domains", ChatGPT gets blocked. Change it to Standard and save.

8. Open **bellwood-plugin → Overview** and copy the domain, e.g. `bellwood-plugin.vercel.app`.
9. **Tell Claude it's done.** Claude will check it's working.

---

## 2. Connect it in ChatGPT (2 min) 👤

1. **chatgpt.com** on a computer.
2. **Settings → Security and login → Developer mode → On.**
3. **Settings → Plugins → +** (create).
   - **Name:** Kept
   - **URL:** `https://<your domain from step 8>/mcp`
   - **Auth:** none
4. Save. You should see **4 tools**.

## 3. Try it (5 min) 👤

New chat → **+ → Developer mode →** tick **Kept**. Then type:

| Type this | You should see |
|:--|:--|
| My mum died on 10 June 2026 and left me her house. It's empty. Probate was granted on 20 September. What do we need to do? | A dated plan |
| Agent says £250k, we have a cash offer of £210k, legal fees £1,200. What would we actually end up with? | 3 columns of money left |
| How much to renovate an 85 square metre house with damp? | 3 budget bands |
| How much is my house worth? | **No value.** That's correct. |

---

## 4. Turn on Pro: agents and investors (5 min) 👤

**a) Add 5 environment variables:** bellwood-plugin → **Settings → Environment Variables**.

| Name | Value |
|:--|:--|
| `DATABASE_URL` | Copy from **bellwood-api** |
| `RESEND_TOKEN` | Copy from **bellwood-api** |
| `RESEND_FROM` | Copy from **bellwood-api** |
| `EPC_API_TOKEN` | Copy from **bellwood-api** (also makes public property facts work fully) |
| `PLUGIN_AUTH_SECRET` | New random text, 48+ characters. In a terminal: `openssl rand -base64 48` |

**b) Redeploy:** Deployments → latest → **⋯ → Redeploy**.

**c) Make yourself a test agent:** on the website, go to **`/partners/signup`** and sign up with your own email.

**d) Connect Pro in ChatGPT:**
- **Settings → Plugins → +**
  - **Name:** Kept Pro
  - **URL:** `https://<your domain>/pro/mcp`
  - **Auth:** OAuth
- Sign in with your email and the 6-digit code you're sent.

**e) Try it:**
- "My buyer's mortgage fell through on 12 Test Road, M20 2AB. Can Kept look at it?"
- Check the **Action Centre** for an **"Agent referral via ChatGPT"** card.
- Then **dismiss it**.

**Give it to an agent:** send them the `/pro/mcp` link plus steps 2 and 4d. They sign in with the email on their partner account.

---

## 5. Your own address (optional, later) 👤

Your domain's DNS is at **GoDaddy**, so Claude can't add records.

1. At **GoDaddy → wearekept.co.uk → DNS**, add a record:
   - **Type:** CNAME
   - **Name:** `chatgpt`
   - **Value:** `cname.vercel-dns.com`
2. **bellwood-plugin → Settings → Domains →** add `chatgpt.wearekept.co.uk`. Wait for ✅.
3. Add the env var `PLUGIN_PUBLIC_URL` = `https://chatgpt.wearekept.co.uk`, then **Redeploy**.
4. In ChatGPT, update both plugin URLs to the new address. Pro users sign in again once.

---

## Test and learn: what to watch

| What | Where |
|:--|:--|
| Which tools get used, and errors | Vercel → bellwood-plugin → **Logs**, search `kept_plugin_tool`. Each line has tool, outcome and time. **No user inputs are ever logged.** |
| Leads from the plugin | Website analytics: visits with `utm_source=chatgpt`. Then the form submissions that follow. |
| Agent referrals and investor interest | **Action Centre**: cards titled "via ChatGPT" |
| Something wrong? | Ask Claude to read the logs. |

**Kill switch:** bellwood-plugin → **Settings → General → Pause**. ChatGPT gets an error; nothing else is affected.

---

## Risks you are accepting (high risk tolerance)

- **Not reviewed by OpenAI.** Fine for developer mode. A directory listing needs a review later.
- **Privacy page is still marked DRAFT** and has no ICO number. Fix before any wider sharing.
- **No compliance opinion yet.** The tools make no legal claims and give general information only.
- **The public endpoint is open to anyone with the URL.** It reads free public registers only and stores nothing.
- **Pro's sign-in server is custom-built.** It's tested end to end, but there's been no outside security review.
