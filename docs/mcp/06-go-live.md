# Go live: Kept in ChatGPT, step by step

_Written: 2026-10-01. About 1 hour of clicking, spread over a day. Do the parts in order._

**You need:**
- Vercel access (you have it).
- A ChatGPT **Plus, Pro or Business** account, used **on the web**.
- 10 minutes in the Kept dashboard.

---

## Part A: Merge the code (5 min)

1. Open **PR #122** on GitHub.
2. Click **Ready for review**, then **Merge**.
3. Wait for `bellwood-web` to finish deploying in Vercel.
   - This puts the **seller-email fix** live. Do this first, because the plugin's button sends people to those forms.

---

## Part B: Create the plugin project in Vercel (15 min)

1. Vercel, then **Add New… → Project**.
2. Pick the repo **Bellwood-Lane-Ventures**.
3. **Project name:** `bellwood-plugin`
4. **Root Directory:** click Edit and choose **`apps/plugin`**. ⚠️ This is the important one.
5. Framework: **Next.js** (it should pick this itself). Leave the build settings as they are.
6. Open **Environment Variables** and add these:

| Name | Value | Where to get it |
|:--|:--|:--|
| `PLUGIN_PUBLIC_URL` | `https://chatgpt.wearekept.co.uk` | Type it exactly. No slash at the end. |
| `PLUGIN_AUTH_SECRET` | A long random string | Run `openssl rand -base64 48` in a terminal, or ask me to make one |
| `DATABASE_URL` | Same as the other projects | Copy from **bellwood-api → Settings → Environment Variables** |
| `RESEND_TOKEN` | Same as the other projects | Copy from bellwood-api |
| `RESEND_FROM` | Same as the other projects | Copy from bellwood-api |
| `EPC_API_TOKEN` | Same as the other projects | Copy from bellwood-api or bellwood-web |

7. Click **Deploy**. Wait for it to go green.

---

## Part C: Give it its own address (10 min)

1. Open **bellwood-plugin → Settings → Domains**.
2. Add **`chatgpt.wearekept.co.uk`**.
3. If Vercel asks for DNS: add a **CNAME** record at your domain registrar:
   - name `chatgpt`
   - value `cname.vercel-dns.com`
4. Wait until Vercel shows **Valid Configuration** ✅.
5. **Deployments → latest → Redeploy**, so it picks up the env vars.

⚠️ **Always use `chatgpt.wearekept.co.uk`.** The long `…vercel.app` preview links are login-protected. ChatGPT gets "401" on them and fails.

---

## Part D: Check it's alive (2 min)

Open these in your browser:

| Open | You should see |
|:--|:--|
| `https://chatgpt.wearekept.co.uk` | "This address serves the Kept plugin for ChatGPT" |
| `https://chatgpt.wearekept.co.uk/.well-known/oauth-authorization-server` | A page of text starting `{"issuer":"https://chatgpt.wearekept.co.uk"` |

If both work, the server is live.

---

## Part E: Connect it to ChatGPT (5 min)

1. Go to **chatgpt.com** on a computer.
2. **Settings → Security and login → Developer mode → On.**
3. **Settings → Plugins → +** (create).
4. Fill in:
   - **Name:** Kept
   - **URL:** `https://chatgpt.wearekept.co.uk/mcp`
   - **Auth:** none
5. Save. It should list **4 tools**.

---

## Part F: Try the public plugin (10 min)

1. Start a **new chat**.
2. Click **+ → Developer mode →** tick **Kept**.
3. Type these one at a time:

| Type this | You should see |
|:--|:--|
| My mum died on 10 June 2026 and left me her house. It's empty. Probate was granted 20 September. What do we need to do? | A card with a **dated plan** |
| Agent says £250k, we have a cash offer of £210k, legal fees £1,200. What would we actually end up with? | A card with **3 columns** of money left |
| How much to renovate an 85 square metre house with damp? | A card with **3 budget bands** |
| What's on public record about [a real address and postcode]? | **Energy certificate + past sales** card |
| How much is my house worth? | **No value given.** That's correct. |

4. Click **"Ask Kept for a written offer"** on a card. It should open the Kept website.

If you change anything later: **Settings → Plugins → Kept → Refresh.**

---

## Part G: Try the Pro plugin (15 min)

**First, make yourself a test agent and a test investor:**

1. **Agent:** on the website, go to `/partners/signup` and sign up with **your own email**.
2. **Investor:** in the dashboard, go to **Investors**, create an access link, and put **your own email** on it.

**Then connect it:**

1. **Settings → Plugins → +**
   - **Name:** Kept Pro
   - **URL:** `https://chatgpt.wearekept.co.uk/pro/mcp`
   - **Auth:** OAuth. ChatGPT finds the settings itself.
2. A Kept sign-in page opens. Enter your email.
3. Check your email for a **6-digit code**, type it in, and you're connected.

**Try:**

| Type this | You should see |
|:--|:--|
| My buyer's mortgage fell through on 12 Test Road, M20 2AB. Can Kept look at it? | It asks you to confirm the vendor agreed, then "Referral sent" |
| Where are my Kept referrals up to? | Your test referral, "With the team" |
| Any released Kept deals? | The investor feed list |

4. Check the dashboard **Action Centre**. You should see an **"Agent referral via ChatGPT"** card.
5. **Clean up:** dismiss that card and delete the test quote.

---

## Part H: Ship dark, then submit (later)

1. **Keep it in developer mode** until one real executor and one real agent have used it with you watching.
2. **Before submitting:**
   - Fix the privacy page: add a plugin section and the ICO number. It's still marked DRAFT.
   - Verify the company in the **OpenAI Platform dashboard**, as "Bellwoods Lane Ventures Ltd".
3. **Submit only the public plugin** (`/mcp`), from ChatGPT's **Plugins** page. Use the Plugin Creator or the submit flow.
4. Use test prompts #1–20 and negatives #26–30 from `05-build-plan.md`.
5. Track it under **Review status**. OpenAI replies by email.

---

## If something goes wrong

| Problem | Fix |
|:--|:--|
| ChatGPT says it can't connect | Check Part D. Make sure the URL ends in **`/mcp`** and uses `chatgpt.wearekept.co.uk`, not a vercel.app link. |
| Tools list is empty or old | Plugins → Kept → **Refresh** |
| Card is blank but text appears | Fine for now; ChatGPT still shows the answer. Tell me and I'll check the card. |
| Pro sign-in: no email arrives | Check spam. Check `RESEND_TOKEN` / `RESEND_FROM` on bellwood-plugin. The email must match an agent or investor exactly. |
| Pro sign-in: "This app is not recognised" | Tell me. ChatGPT may sign in from a host not on our allowlist; we add it to `PLUGIN_CIMD_HOSTS`. |
| Property facts says "no certificate found" every time | `EPC_API_TOKEN` is missing on bellwood-plugin. |
| Vercel build fails | Check the Root Directory is `apps/plugin`. Send me the build log. |
