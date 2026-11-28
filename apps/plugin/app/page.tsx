import { brand } from '@repo/brand';
import type { CSSProperties, ReactNode } from 'react';

/**
 * The plugin's documentation page: the "documentation URL" both the
 * ChatGPT and Claude directories ask for (docs/mcp/10-funnel.md). Plain
 * facts about what the tools do, what they never do, and what happens to
 * what people type. Kept out of search: the site is the public front door.
 */

export const metadata = {
  title: `${brand.name} for ChatGPT and Claude`,
  description:
    'Plain answers for selling a UK home that is hard to sell or on a deadline. Free, no sign-up.',
  robots: { index: false, follow: false },
};

const TRAILING_SLASH = /\/$/;

/** The address to paste into ChatGPT or Claude, when the deploy knows it. */
function connectAddress(): string | null {
  const publicUrl = process.env.PLUGIN_PUBLIC_URL?.trim();
  if (publicUrl) {
    return `${publicUrl.replace(TRAILING_SLASH, '')}/mcp`;
  }
  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return productionHost ? `https://${productionHost}/mcp` : null;
}
const connectUrl = connectAddress();

const page: CSSProperties = {
  maxWidth: 680,
  margin: '0 auto',
  padding: '48px 16px 64px',
  fontFamily: 'Arial, Helvetica, sans-serif',
  fontSize: 17,
  lineHeight: 1.6,
};
const heading: CSSProperties = {
  fontFamily: 'Georgia, serif',
  fontWeight: 600,
  margin: '32px 0 8px',
  fontSize: 22,
};
const link: CSSProperties = { color: '#2E7D5B', fontWeight: 700 };
const code: CSSProperties = {
  fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
  background: '#EDE7D8',
  padding: '2px 6px',
  borderRadius: 3,
  overflowWrap: 'anywhere',
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 style={heading}>{title}</h2>
      {children}
    </section>
  );
}

export default function Page() {
  return (
    <main style={page}>
      <p style={{ fontFamily: 'Georgia, serif', fontSize: 28, margin: 0 }}>
        {brand.mark}
      </p>
      <h1 style={{ ...heading, fontSize: 32, marginTop: 8 }}>
        {brand.name} for ChatGPT and Claude
      </h1>
      <p>
        Plain answers for selling a UK home that is hard to sell or on a
        deadline. Free, and no sign-up.
      </p>

      <Section title="Who it helps">
        <ul>
          <li>An inherited home, before or after probate</li>
          <li>A sale that fell through</li>
          <li>A separation</li>
          <li>Moving away</li>
          <li>A move into care, or a change in health</li>
          <li>
            A property with a problem: a short lease, structural movement,
            knotweed, or a lot of work
          </li>
        </ul>
      </Section>

      <Section title="What it does">
        <ul>
          <li>
            <strong>Plan a sale with a reason or a deadline.</strong> Which ways
            of selling can finish by your date, what you would be left with
            after fees and the mortgage, and a checklist for this week.
          </li>
          <li>
            <strong>Compare ways to sell.</strong> Estate agent, auction or cash
            buyer, on your own figures.
          </li>
          <li>
            <strong>Plan for an inherited home.</strong> The dates that matter,
            from the date of death and the grant of probate.
          </li>
          <li>
            <strong>Estimate renovation costs.</strong> Budget bands from the
            floor area.
          </li>
          <li>
            <strong>Look up public facts about a home.</strong> Its energy
            certificate and recorded sale prices nearby.
          </li>
          <li>
            <strong>Ask {brand.name} to get in touch.</strong> Only if you ask,
            and only with your agreement.
          </li>
        </ul>
      </Section>

      <Section title="Try asking">
        <ul>
          <li>
            “Our buyer pulled out and we complete on our new house in six weeks.
            What can we do?”
          </li>
          <li>
            “My mum died in June and left me her house. What do we need to do,
            and when?”
          </li>
          <li>
            “We’re separating. If we sell for £300,000 with £180,000 left on the
            mortgage, what is my share?”
          </li>
          <li>
            “Estate agent, auction or cash buyer? The agent says £250,000.”
          </li>
          <li>
            “How much would it cost to renovate an 85 square metre house with
            damp?”
          </li>
        </ul>
      </Section>

      <Section title="What it never does">
        <ul>
          <li>
            It never values your home or puts an offer on screen. Any price
            comes from you.
          </li>
          <li>
            It never picks a route for you. It says when an estate agent is
            likely to get you more.
          </li>
          <li>
            It gives general information, not legal, tax or financial advice.
          </li>
        </ul>
      </Section>

      <Section title="What happens to what you type">
        <ul>
          <li>
            The planning tools use what you type to work out the answer, and
            store none of it.
          </li>
          <li>
            If you ask {brand.name} to get in touch, {brand.name} receives the
            details you give: your name, email, phone if you add one, the home’s
            address and your situation. They are used only to contact you about
            that home.
          </li>
          <li>
            Our logs record which tool ran, which assistant it came from,
            whether it worked and how long it took. Never what you typed.
          </li>
          <li>
            Full privacy notice:{' '}
            <a href={`${brand.url}/legal/privacy`} style={link}>
              {brand.url.replace('https://', '')}/legal/privacy
            </a>
          </li>
        </ul>
      </Section>

      <Section title={`About ${brand.name}`}>
        <p>
          {brand.name} is a cash buyer. We view every home first and send a
          written offer within two working days of the viewing. If you can wait
          for the open market, an estate agent will usually get you more, and
          the tools say so.
        </p>
        <p>
          Questions or problems: <span style={code}>{brand.email}</span>
        </p>
      </Section>

      <Section title="Connect it">
        <p>
          Add it in ChatGPT or Claude as a custom connector, with no sign-in, at{' '}
          {connectUrl ? (
            <span style={code}>{connectUrl}</span>
          ) : (
            <>
              this page’s address followed by <span style={code}>/mcp</span>
            </>
          )}
          .
        </p>
      </Section>

      <p style={{ marginTop: 40, fontSize: 14, color: '#4C5A50' }}>
        {brand.name} is a trading name of Bellwoods Lane Ventures Ltd.
      </p>
    </main>
  );
}
