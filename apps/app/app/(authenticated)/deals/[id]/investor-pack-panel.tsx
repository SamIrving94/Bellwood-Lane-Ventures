'use client';

import { Button } from '@repo/design-system/components/ui/button';
import { useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  type PackInput,
  draftInvestorPackCopy,
  getPackPreviewUrl,
  saveInvestorPack,
  sendInvestorPack,
  setInvestorPackStatus,
  uploadPackImage,
} from '@/app/actions/investors/packs';

type PackStatus = 'draft' | 'live' | 'closed' | 'withdrawn';

export type PackPanelData = {
  status: PackStatus;
  headline: string;
  snippet: string;
  summary: string;
  highlights: string[];
  photos: string[];
  renders: string[];
  floorPlanUrl: string | null;
  sellerPricePence: number;
  feePence: number;
  pricePence: number;
  marketValuePence: number | null;
  refurbEstimatePence: number | null;
  gdvPence: number | null;
  monthlyRentPence: number | null;
  tenure: string | null;
  epcRating: string | null;
  floorAreaSqft: number | null;
  closesAt: Date | null;
  sentCount: number;
  viewCount: number;
};

const inputCls =
  'w-full rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring';

const toPounds = (p: number | null | undefined) =>
  p === null || p === undefined ? '' : String(Math.round(p / 100));

const gbp = (pounds: number) =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(pounds);

const STATUS_LABEL: Record<PackStatus, { text: string; cls: string }> = {
  draft: { text: 'Draft', cls: 'bg-muted text-muted-foreground' },
  live: {
    text: 'Live',
    cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  },
  closed: {
    text: 'Closed',
    cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  },
  withdrawn: {
    text: 'Withdrawn',
    cls: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  },
};

/**
 * Back-to-back investor pack (Phase 1: fixed price, register interest).
 * Folded by default so the deal page stays calm; the header line says the
 * state at a glance.
 */
export function InvestorPackPanel({
  dealId,
  pack,
  defaults,
  viewingPhotos,
  recipientCount,
}: {
  dealId: string;
  pack: PackPanelData | null;
  defaults: {
    sellerPricePence: number | null;
    marketValuePence: number | null;
    refurbEstimatePence: number | null;
  };
  viewingPhotos: string[];
  recipientCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Price
  const [sellerPrice, setSellerPrice] = useState(
    toPounds(pack?.sellerPricePence ?? defaults.sellerPricePence)
  );
  const [fee, setFee] = useState(toPounds(pack?.feePence));

  // Words
  const [headline, setHeadline] = useState(pack?.headline ?? '');
  const [snippet, setSnippet] = useState(pack?.snippet ?? '');
  const [summary, setSummary] = useState(pack?.summary ?? '');
  const [highlights, setHighlights] = useState(
    (pack?.highlights ?? []).join('\n')
  );

  // Media
  const [photos, setPhotos] = useState<string[]>(pack?.photos ?? []);
  const [renders, setRenders] = useState<string[]>(pack?.renders ?? []);
  const [floorPlanUrl, setFloorPlanUrl] = useState<string | null>(
    pack?.floorPlanUrl ?? null
  );
  const [uploading, setUploading] = useState<string | null>(null);

  // Figures
  const [marketValue, setMarketValue] = useState(
    toPounds(pack?.marketValuePence ?? defaults.marketValuePence)
  );
  const [refurb, setRefurb] = useState(
    toPounds(pack?.refurbEstimatePence ?? defaults.refurbEstimatePence)
  );
  const [gdv, setGdv] = useState(toPounds(pack?.gdvPence));
  const [rent, setRent] = useState(toPounds(pack?.monthlyRentPence));
  const [tenure, setTenure] = useState(pack?.tenure ?? '');
  const [epc, setEpc] = useState(pack?.epcRating ?? '');
  const [sqft, setSqft] = useState(
    pack?.floorAreaSqft ? String(pack.floorAreaSqft) : ''
  );

  const [confirmSend, setConfirmSend] = useState(false);

  const num = (s: string) => (s.trim() === '' ? null : Number(s));
  const investorPrice = (num(sellerPrice) ?? 0) + (num(fee) ?? 0);
  const mv = num(marketValue);
  const discount =
    mv && mv > 0 && investorPrice > 0
      ? ((mv - investorPrice) / mv) * 100
      : null;

  const buildInput = (): PackInput => ({
    headline,
    snippet,
    summary,
    highlights: highlights
      .split('\n')
      .map((h) => h.trim())
      .filter(Boolean),
    photos,
    renders,
    floorPlanUrl,
    sellerPrice: num(sellerPrice) ?? 0,
    fee: num(fee) ?? 0,
    marketValue: num(marketValue),
    refurbEstimate: num(refurb),
    gdv: num(gdv),
    monthlyRent: num(rent),
    tenure: tenure || null,
    epcRating: epc || null,
    floorAreaSqft: num(sqft),
  });

  const run = (fn: () => Promise<void>) =>
    startTransition(async () => {
      try {
        await fn();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Something failed.');
      }
    });

  const handleSave = () =>
    run(async () => {
      await saveInvestorPack(dealId, buildInput());
      toast.success('Pack saved.');
    });

  const handleDraft = () =>
    run(async () => {
      // Pass the figures as typed, saved or not, so the draft uses them.
      const i = buildInput();
      const d = await draftInvestorPackCopy(dealId, {
        price: investorPrice || null,
        marketValue: i.marketValue ?? null,
        refurbEstimate: i.refurbEstimate ?? null,
        gdv: i.gdv ?? null,
        monthlyRent: i.monthlyRent ?? null,
        tenure: i.tenure ?? null,
        epcRating: i.epcRating ?? null,
        floorAreaSqft: i.floorAreaSqft ?? null,
      });
      setHeadline(d.headline);
      setSnippet(d.snippet);
      setSummary(d.summary);
      setHighlights(d.highlights.join('\n'));
      toast.success('Draft ready. Read it, edit it, then save.');
    });

  const handlePreview = () =>
    run(async () => {
      await saveInvestorPack(dealId, buildInput());
      const { url } = await getPackPreviewUrl(dealId);
      window.open(url, '_blank', 'noopener');
    });

  const handleSend = () =>
    run(async () => {
      await saveInvestorPack(dealId, buildInput());
      const r = await sendInvestorPack(dealId);
      setConfirmSend(false);
      if (r.failed.length > 0) {
        toast.warning(
          `Sent to ${r.sent} of ${r.total}. Not delivered: ${r.failed.join(', ')}`
        );
      } else {
        toast.success(`Sent to ${r.sent} investor(s).`);
      }
    });

  const handleStatus = (s: 'draft' | 'closed' | 'withdrawn') =>
    run(async () => {
      await setInvestorPackStatus(dealId, s);
      toast.success(s === 'draft' ? 'Reopened as a draft.' : `Pack ${s}.`);
    });

  const fileInputs = {
    photos: useRef<HTMLInputElement>(null),
    renders: useRef<HTMLInputElement>(null),
    floorPlan: useRef<HTMLInputElement>(null),
  };

  const handleUpload = async (
    kind: 'photos' | 'renders' | 'floorPlan',
    files: FileList | null
  ) => {
    if (!files?.length) return;
    setUploading(kind);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', file);
        const { url } = await uploadPackImage(dealId, fd);
        if (kind === 'photos') setPhotos((p) => [...p, url]);
        else if (kind === 'renders') setRenders((p) => [...p, url]);
        else setFloorPlanUrl(url);
      }
      toast.success('Uploaded. Save to keep it.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(null);
    }
  };

  const status = pack?.status ?? null;
  const unusedViewingPhotos = viewingPhotos.filter((u) => !photos.includes(u));

  return (
    <div className="rounded-lg border bg-card p-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div>
          <h2 className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
            Investment pack
          </h2>
          <p className="mt-0.5 text-muted-foreground text-xs">
            {!pack &&
              'Back-to-back: offer this deal to your investors at a fixed price.'}
            {pack &&
              `${gbp(pack.pricePence / 100)} to investors · ${pack.sentCount} sent · ${pack.viewCount} views${
                pack.closesAt
                  ? ` · closes ${new Date(pack.closesAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
                  : ''
              }`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {status && (
            <span
              className={`rounded-full px-2 py-0.5 font-medium text-[11px] ${STATUS_LABEL[status].cls}`}
            >
              {STATUS_LABEL[status].text}
            </span>
          )}
          <span className="text-muted-foreground text-xs">
            {open ? 'Hide' : pack ? 'Open' : 'Build pack'}
          </span>
        </div>
      </button>

      {open && (
        <div className="mt-4 space-y-5">
          {/* 1. Price */}
          <section className="space-y-2">
            <h3 className="font-medium text-sm">1. Price</h3>
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="space-y-1 text-xs">
                <span className="text-muted-foreground">
                  Agreed with seller (£)
                </span>
                <input
                  className={inputCls}
                  inputMode="numeric"
                  value={sellerPrice}
                  onChange={(e) => setSellerPrice(e.target.value)}
                />
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-muted-foreground">Our fee (£)</span>
                <input
                  className={inputCls}
                  inputMode="numeric"
                  value={fee}
                  onChange={(e) => setFee(e.target.value)}
                />
              </label>
              <div className="space-y-1 text-xs">
                <span className="text-muted-foreground">
                  Price to investors
                </span>
                <p className="py-1 font-bold text-lg">
                  {investorPrice > 0 ? gbp(investorPrice) : '—'}
                </p>
              </div>
            </div>
            <p className="text-muted-foreground text-xs">
              Investors only ever see the price to investors. The seller price
              and fee stay private.
              {discount !== null &&
                ` That is ${discount.toFixed(0)}% ${discount >= 0 ? 'below' : 'above'} the market value below.`}
            </p>
          </section>

          {/* 2. Figures */}
          <section className="space-y-2">
            <h3 className="font-medium text-sm">2. Figures for the pack</h3>
            <div className="grid gap-2 sm:grid-cols-4">
              {[
                ['Market value (£)', marketValue, setMarketValue],
                ['Refurb estimate (£)', refurb, setRefurb],
                ['Value after works (£)', gdv, setGdv],
                ['Rent per month (£)', rent, setRent],
              ].map(([label, value, set]) => (
                <label key={label as string} className="space-y-1 text-xs">
                  <span className="text-muted-foreground">
                    {label as string}
                  </span>
                  <input
                    className={inputCls}
                    inputMode="numeric"
                    value={value as string}
                    onChange={(e) =>
                      (set as (v: string) => void)(e.target.value)
                    }
                  />
                </label>
              ))}
              <label className="space-y-1 text-xs">
                <span className="text-muted-foreground">Tenure</span>
                <select
                  className={inputCls}
                  value={tenure}
                  onChange={(e) => setTenure(e.target.value)}
                >
                  <option value="">Not set</option>
                  <option value="Freehold">Freehold</option>
                  <option value="Leasehold">Leasehold</option>
                  <option value="Share of freehold">Share of freehold</option>
                </select>
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-muted-foreground">EPC rating</span>
                <input
                  className={inputCls}
                  maxLength={1}
                  value={epc}
                  onChange={(e) => setEpc(e.target.value.toUpperCase())}
                />
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-muted-foreground">
                  Floor area (sq ft)
                </span>
                <input
                  className={inputCls}
                  inputMode="numeric"
                  value={sqft}
                  onChange={(e) => setSqft(e.target.value)}
                />
              </label>
            </div>
          </section>

          {/* 3. Words */}
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-medium text-sm">3. Words</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDraft}
                disabled={isPending}
              >
                Draft with AI
              </Button>
            </div>
            <input
              className={inputCls}
              placeholder="Headline, e.g. Three-bed terrace in NG7, below market value"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
            />
            <textarea
              className={inputCls}
              rows={2}
              placeholder="Email snippet: one or two sentences"
              value={snippet}
              onChange={(e) => setSnippet(e.target.value)}
            />
            <textarea
              className={inputCls}
              rows={6}
              placeholder="The investment case: the property, the numbers, the risks"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
            <textarea
              className={inputCls}
              rows={4}
              placeholder="Highlights, one per line"
              value={highlights}
              onChange={(e) => setHighlights(e.target.value)}
            />
          </section>

          {/* 4. Pictures */}
          <section className="space-y-3">
            <h3 className="font-medium text-sm">4. Pictures</h3>
            <ImageGroup
              title="Photos"
              hint="The first photo is the cover and goes in the email."
              urls={photos}
              onRemove={(u) => setPhotos((p) => p.filter((x) => x !== u))}
              onMakeFirst={(u) =>
                setPhotos((p) => [u, ...p.filter((x) => x !== u)])
              }
              onAdd={() => fileInputs.photos.current?.click()}
              uploading={uploading === 'photos'}
            />
            {unusedViewingPhotos.length > 0 && (
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs">
                  From the viewing report (click to add):
                </p>
                <div className="flex flex-wrap gap-2">
                  {unusedViewingPhotos.map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setPhotos((p) => [...p, u])}
                      className="overflow-hidden rounded border opacity-70 hover:opacity-100"
                    >
                      <img src={u} alt="" className="h-14 w-20 object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
            <ImageGroup
              title="Renders (shown labelled as illustrative)"
              urls={renders}
              onRemove={(u) => setRenders((p) => p.filter((x) => x !== u))}
              onAdd={() => fileInputs.renders.current?.click()}
              uploading={uploading === 'renders'}
            />
            <ImageGroup
              title="Floor plan"
              urls={floorPlanUrl ? [floorPlanUrl] : []}
              onRemove={() => setFloorPlanUrl(null)}
              onAdd={() => fileInputs.floorPlan.current?.click()}
              uploading={uploading === 'floorPlan'}
            />
            {(['photos', 'renders', 'floorPlan'] as const).map((k) => (
              <input
                key={k}
                ref={fileInputs[k]}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple={k !== 'floorPlan'}
                className="hidden"
                onChange={(e) => {
                  handleUpload(k, e.target.files);
                  e.target.value = '';
                }}
              />
            ))}
          </section>

          {/* 5. Actions */}
          <section className="space-y-2 border-t pt-4">
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSave} disabled={isPending}>
                Save
              </Button>
              <Button
                variant="outline"
                onClick={handlePreview}
                disabled={isPending}
              >
                Preview as investor
              </Button>
              {status !== 'withdrawn' && status !== 'closed' && (
                <Button
                  variant="outline"
                  onClick={() => setConfirmSend(true)}
                  disabled={isPending || confirmSend}
                >
                  {status === 'live' ? 'Send again' : 'Send to investors'}
                </Button>
              )}
              {status === 'live' && (
                <Button
                  variant="ghost"
                  onClick={() => handleStatus('closed')}
                  disabled={isPending}
                >
                  Close interest
                </Button>
              )}
              {(status === 'draft' || status === 'live') && (
                <Button
                  variant="ghost"
                  onClick={() => handleStatus('withdrawn')}
                  disabled={isPending}
                >
                  Withdraw
                </Button>
              )}
              {(status === 'closed' || status === 'withdrawn') && (
                <Button
                  variant="ghost"
                  onClick={() => handleStatus('draft')}
                  disabled={isPending}
                >
                  Reopen as draft
                </Button>
              )}
            </div>

            {confirmSend && (
              <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950">
                <p>
                  <strong>Send to {recipientCount} investor(s)?</strong>{' '}
                  {status === 'live'
                    ? 'The close date stays the same.'
                    : 'Interest closes in two weeks.'}{' '}
                  Investors see{' '}
                  {investorPrice > 0 ? gbp(investorPrice) : 'the price'}.
                </p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSend} disabled={isPending}>
                    Yes, send
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmSend(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
            <p className="text-muted-foreground text-xs">
              Goes to every active investor link with an email ({recipientCount}{' '}
              now). Add investors on the{' '}
              <a href="/investors" className="underline">
                Investors page
              </a>
              .
            </p>
          </section>
        </div>
      )}
    </div>
  );
}

function ImageGroup({
  title,
  hint,
  urls,
  onRemove,
  onMakeFirst,
  onAdd,
  uploading,
}: {
  title: string;
  hint?: string;
  urls: string[];
  onRemove: (u: string) => void;
  onMakeFirst?: (u: string) => void;
  onAdd: () => void;
  uploading: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs">
        <span className="font-medium">{title}</span>
        {hint && <span className="text-muted-foreground"> · {hint}</span>}
      </p>
      <div className="flex flex-wrap gap-2">
        {urls.map((u, i) => (
          <div
            key={u}
            className="group relative overflow-hidden rounded border"
          >
            <img src={u} alt="" className="h-20 w-28 object-cover" />
            {i === 0 && onMakeFirst && (
              <span className="absolute top-1 left-1 rounded bg-black/70 px-1 text-[10px] text-white">
                Cover
              </span>
            )}
            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/60 px-1 py-0.5 text-[10px] text-white opacity-0 group-hover:opacity-100">
              {onMakeFirst && i > 0 ? (
                <button type="button" onClick={() => onMakeFirst(u)}>
                  Make cover
                </button>
              ) : (
                <span />
              )}
              <button type="button" onClick={() => onRemove(u)}>
                Remove
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={onAdd}
          disabled={uploading}
          className="flex h-20 w-28 items-center justify-center rounded border border-dashed text-muted-foreground text-xs hover:bg-muted"
        >
          {uploading ? 'Uploading…' : '+ Add'}
        </button>
      </div>
    </div>
  );
}
