'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';

/**
 * Keyhole lookup form. Posts to /api/keyhole/report and navigates to the
 * durable report page. Kept deliberately friction-free: no login, three
 * fields, the email optional (it only sends the link).
 */

const INPUT =
  'w-full rounded-[2px] border border-[#D9D0BC] bg-cream px-4 py-3.5 text-[16px] text-forest outline-none transition focus:border-leaf focus:shadow-[0_0_0_3px_rgba(46,125,91,0.15)]';
const PILL =
  'mt-3 inline-flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-full bg-leaf px-7 py-3.5 font-semibold text-[15px] text-white transition hover:bg-leaf-dark disabled:cursor-not-allowed disabled:opacity-60';
const LABEL = 'mt-4 block font-semibold text-[13.5px] text-forest';

export function KeyholeLookupForm() {
  const router = useRouter();
  const [addressLine, setAddressLine] = useState('');
  const [postcode, setPostcode] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/keyhole/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addressLine,
          postcode,
          email: email || undefined,
          professionalRole: role || undefined,
        }),
      });
      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !data.id) {
        setError(
          data.error ??
            'Something went wrong generating the report. Please try again.'
        );
        setBusy(false);
        return;
      }
      router.push(`/keyhole/report/${data.id}`);
    } catch {
      setError('Something went wrong generating the report. Please try again.');
      setBusy(false);
    }
  }

  return (
    <form
      className="rounded-[2px] border border-hair bg-white px-6 pt-6 pb-6"
      onSubmit={submit}
    >
      <p className="mb-1 font-semibold font-serif text-[20px] text-forest">
        Run a report
      </p>
      <p className="text-[13.5px] text-body leading-[1.55]">
        One page, usually under a minute. Nothing is listed and nobody is
        contacted.
      </p>

      <label className={LABEL} htmlFor="kh-address">
        First line of the address
      </label>
      <input
        className={INPUT}
        id="kh-address"
        onChange={(e) => setAddressLine(e.target.value)}
        placeholder="12 Acacia Road"
        required
        value={addressLine}
      />

      <label className={LABEL} htmlFor="kh-postcode">
        Postcode
      </label>
      <input
        autoCapitalize="characters"
        className={INPUT}
        id="kh-postcode"
        onChange={(e) => setPostcode(e.target.value)}
        placeholder="SE22 8EW"
        required
        value={postcode}
      />

      <label className={LABEL} htmlFor="kh-email">
        Email the report link to you (optional)
      </label>
      <input
        className={INPUT}
        id="kh-email"
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@yourfirm.co.uk"
        type="email"
        value={email}
      />

      <label className={LABEL} htmlFor="kh-role">
        Your role (optional)
      </label>
      <select
        className={INPUT}
        id="kh-role"
        onChange={(e) => setRole(e.target.value)}
        value={role}
      >
        <option value="">Prefer not to say</option>
        <option value="solicitor">Solicitor</option>
        <option value="surveyor">Surveyor</option>
        <option value="wealth">Wealth manager or private banker</option>
        <option value="care">Later-life or care adviser</option>
        <option value="other">Other</option>
      </select>

      {error ? (
        <p className="mt-3 text-[#c33f35] text-[13.5px]" role="alert">
          {error}
        </p>
      ) : null}

      <button className={PILL} disabled={busy} type="submit">
        {busy ? 'Building the report…' : 'Generate the report'}
      </button>
      <p className="mt-3 text-[12px] text-stone-500 leading-[1.5]">
        Free for professional use. We store the report so your link keeps
        working; we contact you only if you ask us to.
      </p>
    </form>
  );
}
