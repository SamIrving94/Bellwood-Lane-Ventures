# Bellwood WhatsApp Bridge

Forwards messages from allowed WhatsApp group chats into the Bellwood
`/agents/intake/whatsapp` endpoint so Claude can parse them into ScoutLeads.

## How it works

- Uses [`whatsapp-web.js`](https://github.com/pedroslopez/whatsapp-web.js),
  which drives WhatsApp Web under the hood via a headless browser.
- On first run, prints a QR code in the terminal. Scan it from your phone
  (WhatsApp > Settings > Linked Devices > Link a Device).
- After auth, session is cached in `./data/` so subsequent runs connect
  automatically.
- On every incoming group message:
  1. Skip if not in `ALLOWED_GROUPS`.
  2. Skip own messages (`fromMe`).
  3. POST a JSON payload to `${BELLWOOD_API_URL}/agents/intake/whatsapp`
     with `Authorization: Bearer ${PAPERCLIP_API_KEY}`.

## Quickstart

```bash
cd services/whatsapp-bridge
pnpm install
cp .env.example .env
# edit .env — set PAPERCLIP_API_KEY and ALLOWED_GROUPS
pnpm dev
```

Scan the QR code shown in the terminal with your WhatsApp mobile app.

## Configuring groups

`ALLOWED_GROUPS` is a comma-separated list of **exact** group names as they
appear in WhatsApp. Case-sensitive. Example:

```
ALLOWED_GROUPS=Property Deals UK,Investor Leads,North West Investors
```

If a group name changes in WhatsApp, update `.env` and restart the service.

## Session persistence

- Sessions are stored in `./data/` (gitignored). Back this up if you want
  to move the bridge to another machine without re-scanning the QR.
- If auth gets wedged, delete `./data/` and start over — you'll need to
  scan the QR again.

## Deployment

This is a **long-running process** that drives a headless browser. Options:

- **Local (dev):** `pnpm dev` in a terminal, or inside `screen`/`tmux`.
- **Raspberry Pi / NAS:** cheap, always-on, works fine.
- **Small VPS:** any $5/mo VPS with 1GB RAM works. Ubuntu 22.04 + pnpm.
- **Systemd:** write a simple unit that runs `pnpm start` after `pnpm build`.

Do NOT deploy to Vercel/serverless — it needs a persistent browser session.

## Build & run

```bash
pnpm build
pnpm start
```

## Policy warning

WhatsApp's terms forbid unofficial clients. `whatsapp-web.js` works by
scripting WhatsApp Web — technically the same as using the web app
yourself, but WhatsApp may ban the linked device at any time. For
production volume, migrate to the official WhatsApp Business Cloud API.

Use at your own risk. Do not use a personal number you can't afford to lose.
