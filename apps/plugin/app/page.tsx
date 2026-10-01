import { brand } from '@repo/brand';

export const metadata = {
  title: `${brand.name} for ChatGPT`,
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <main style={{ maxWidth: 560, margin: '0 auto', padding: '64px 16px' }}>
      <h1 style={{ fontWeight: 600 }}>{brand.mark}</h1>
      <p>
        This address serves the {brand.name} plugin for ChatGPT. There is
        nothing to see here in a browser.
      </p>
      <p>
        <a href={`${brand.url}/legal/privacy`} style={{ color: '#2E7D5B' }}>
          Privacy policy
        </a>
      </p>
    </main>
  );
}
