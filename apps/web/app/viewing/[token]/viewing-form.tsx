'use client';

import {
  CONDITION_AREAS,
  VENDOR_MOTIVATION_OPTIONS,
} from '@repo/database/viewing-report';
import { useRef, useState } from 'react';

// Big touch targets throughout — this is filled one-handed in a doorway.

const SCORE_LABELS = ['', 'Bad', 'Poor', 'OK', 'Good', 'Great'];

export function ViewingForm({ token }: { token: string }) {
  const [scores, setScores] = useState<Record<string, number>>({});
  const [summary, setSummary] = useState('');
  const [redFlags, setRedFlags] = useState('');
  const [refurbPounds, setRefurbPounds] = useState('');
  const [motivation, setMotivation] = useState('unknown');
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files).slice(0, 10)) {
        const body = new FormData();
        body.append('file', file);
        const res = await fetch(`/api/viewing/${token}/photo`, {
          method: 'POST',
          body,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Upload failed');
        setPhotos((p) => [...p, json.url]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Photo upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const refurb = refurbPounds.trim() === '' ? null : Number(refurbPounds);
      const res = await fetch(`/api/viewing/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conditionScores: scores,
          summary: summary.trim(),
          redFlags: redFlags.trim() || null,
          refurbEstimatePence:
            refurb !== null && !Number.isNaN(refurb) && refurb >= 0
              ? Math.round(refurb * 100)
              : null,
          vendorMotivation: motivation,
          photos,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not submit');
      setDoneMessage('Report sent — thank you. You can close this page.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit');
    } finally {
      setSubmitting(false);
    }
  };

  if (doneMessage) {
    return (
      <div className="rounded-xl border bg-neutral-50 p-8 text-center">
        <p className="text-2xl">✅</p>
        <p className="mt-2 font-medium">{doneMessage}</p>
      </div>
    );
  }

  const scoredCount = Object.keys(scores).length;
  const canSubmit =
    scoredCount === CONDITION_AREAS.length &&
    summary.trim().length > 0 &&
    !submitting &&
    !uploading;

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h2 className="font-semibold">
          Condition{' '}
          <span className="font-normal text-neutral-500 text-sm">
            ({scoredCount}/{CONDITION_AREAS.length} scored)
          </span>
        </h2>
        {CONDITION_AREAS.map((area) => (
          <div key={area.key} className="rounded-xl border bg-white p-4">
            <p className="font-medium text-sm">{area.label}</p>
            <p className="mt-0.5 text-neutral-500 text-xs">{area.hint}</p>
            <div className="mt-3 grid grid-cols-5 gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setScores((s) => ({ ...s, [area.key]: n }))}
                  className={`rounded-lg border py-2.5 text-center font-medium text-sm transition-colors ${
                    scores[area.key] === n
                      ? 'border-neutral-900 bg-neutral-900 text-white'
                      : 'bg-white text-neutral-600 hover:bg-neutral-50'
                  }`}
                >
                  {n}
                  <span className="block font-normal text-[9px] opacity-70">
                    {SCORE_LABELS[n]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-white p-4">
        <label className="block">
          <span className="font-medium text-sm">Photos</span>
          <span className="block text-neutral-500 text-xs">
            Front, each room, anything broken. Up to 10.
          </span>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            onChange={(e) => uploadPhotos(e.target.files)}
            className="mt-2 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-900 file:px-4 file:py-2.5 file:font-medium file:text-sm file:text-white"
          />
        </label>
        {uploading && (
          <p className="mt-2 text-neutral-500 text-xs">Uploading…</p>
        )}
        {photos.length > 0 && (
          <div className="mt-3 grid grid-cols-4 gap-2">
            {photos.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={url}
                src={url}
                alt="Viewing"
                className="aspect-square w-full rounded-lg border object-cover"
              />
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-white p-4">
        <label className="block">
          <span className="font-medium text-sm">
            Rough refurb cost (optional)
          </span>
          <span className="block text-neutral-500 text-xs">
            Your gut feel to make it lettable/sellable, in pounds.
          </span>
          <div className="mt-2 flex items-center rounded-lg border focus-within:ring-2 focus-within:ring-neutral-900">
            <span className="pl-3 text-neutral-500 text-sm">£</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={refurbPounds}
              onChange={(e) => setRefurbPounds(e.target.value)}
              placeholder="15,000"
              className="w-full bg-transparent px-2 py-2.5 text-sm outline-none"
            />
          </div>
        </label>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <span className="font-medium text-sm">How keen is the seller?</span>
        <div className="mt-2 space-y-1.5">
          {VENDOR_MOTIVATION_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setMotivation(o.value)}
              className={`block w-full rounded-lg border px-3 py-2.5 text-left text-sm ${
                motivation === o.value
                  ? 'border-neutral-900 bg-neutral-900 text-white'
                  : 'bg-white hover:bg-neutral-50'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <label className="block">
          <span className="font-medium text-sm">Summary</span>
          <span className="block text-neutral-500 text-xs">
            What would you tell us over the phone? A few sentences is plenty.
          </span>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={4}
            placeholder="Solid house, tired inside. Roof fine from the street…"
            className="mt-2 w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-neutral-900"
          />
        </label>
        <label className="mt-3 block">
          <span className="font-medium text-sm">Red flags (optional)</span>
          <span className="block text-neutral-500 text-xs">
            Anything that should change our offer or kill the deal.
          </span>
          <textarea
            value={redFlags}
            onChange={(e) => setRedFlags(e.target.value)}
            rows={2}
            placeholder="Crack above bay window, next door is boarded up…"
            className="mt-2 w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-neutral-900"
          />
        </label>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700 text-sm">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit}
        className="w-full rounded-xl bg-neutral-900 py-3.5 font-medium text-white disabled:opacity-40"
      >
        {submitting ? 'Sending…' : 'Send report'}
      </button>
      {!canSubmit && !submitting && (
        <p className="text-center text-neutral-500 text-xs">
          Score all {CONDITION_AREAS.length} areas and write a summary to send.
        </p>
      )}
    </div>
  );
}
