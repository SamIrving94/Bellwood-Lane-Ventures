/**
 * The two small sign-in pages a Pro user sees while connecting ChatGPT.
 * Server-rendered HTML strings: no client JS, every value escaped, never
 * framed (clickjacking). Copy follows docs/brand/KEPT.md: short, calm, no
 * em dashes.
 */

import { brand } from '@repo/brand';

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const STYLE = `
  :root { --ground:#F7F3EA; --card:#FFFFFF; --ink:#1F332B; --body:#4C5A50; --leaf:#2E7D5B; --leaf-dark:#256A4C; --hair:#E2DCCB; }
  @media (prefers-color-scheme: dark) { :root { --ground:#15201B; --card:#1C2A24; --ink:#EDE7D8; --body:#B9C2BB; --leaf:#5FB98D; --leaf-dark:#4FA77C; --hair:#2E3D36; } }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--ground); color:var(--ink); font:16px/1.5 -apple-system,"Segoe UI",Roboto,Arial,sans-serif; }
  main { max-width:420px; margin:0 auto; padding:48px 16px; }
  .mark { font:700 24px Georgia,serif; letter-spacing:-.03em; margin:0 0 24px; }
  h1 { font:600 24px/1.2 Georgia,serif; margin:0 0 8px; }
  p { color:var(--body); }
  .card { background:var(--card); border:1px solid var(--hair); border-radius:4px; padding:20px; }
  label { display:block; font-weight:600; margin:0 0 6px; }
  input { width:100%; font:inherit; padding:10px; border:1px solid var(--hair); border-radius:3px; background:var(--ground); color:var(--ink); }
  input:focus { outline:2px solid var(--leaf); outline-offset:1px; }
  button { margin-top:14px; width:100%; background:var(--leaf); color:#fff; border:0; border-radius:3px; padding:11px; font:600 16px Arial,sans-serif; cursor:pointer; }
  button:hover { background:var(--leaf-dark); }
  .err { color:#B3261E; font-weight:600; }
  .small { font-size:13px; }
`;

function page(title: string, body: string): string {
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><meta name="robots" content="noindex" /><title>${esc(title)}</title><style>${STYLE}</style></head><body><main><p class="mark">${esc(brand.mark)}</p>${body}</main></body></html>`;
}

export function htmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-frame-options': 'DENY',
      'content-security-policy':
        "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
      'referrer-policy': 'no-referrer',
    },
  });
}

export function emailPage(opts: {
  authReq: string;
  clientName: string;
  error?: string;
}): string {
  return page(
    `Connect ${brand.name}`,
    `<h1>Connect ${esc(brand.name)} to ${esc(opts.clientName)}</h1>
    <p>For ${esc(brand.name)} partner agents and investors. Use the email ${esc(brand.name)} already has for you. We will email you a 6-digit code.</p>
    ${opts.error ? `<p class="err">${esc(opts.error)}</p>` : ''}
    <form class="card" method="post" action="/oauth/authorize">
      <input type="hidden" name="step" value="email" />
      <input type="hidden" name="req" value="${esc(opts.authReq)}" />
      <label for="email">Email</label>
      <input id="email" name="email" type="email" autocomplete="email" required maxlength="254" />
      <button type="submit">Email me a code</button>
    </form>
    <p class="small">Not a partner yet? Agents can join at ${esc(brand.url)}/partners/signup.</p>`
  );
}

export function codePage(opts: { pending: string; error?: string }): string {
  return page(
    'Enter your code',
    `<h1>Check your email</h1>
    <p>If that email is registered with ${esc(brand.name)}, we have sent a 6-digit code. It works for 10 minutes.</p>
    ${opts.error ? `<p class="err">${esc(opts.error)}</p>` : ''}
    <form class="card" method="post" action="/oauth/authorize">
      <input type="hidden" name="step" value="code" />
      <input type="hidden" name="pending" value="${esc(opts.pending)}" />
      <label for="code">6-digit code</label>
      <input id="code" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9 ]{6,7}" maxlength="7" required />
      <button type="submit">Connect</button>
    </form>`
  );
}

export function errorPage(message: string): string {
  return page(
    'Cannot connect',
    `<h1>We could not connect</h1><p class="err">${esc(message)}</p><p>Close this tab and try again from ChatGPT.</p>`
  );
}
