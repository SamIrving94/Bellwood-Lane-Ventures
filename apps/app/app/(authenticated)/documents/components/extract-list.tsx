import Link from 'next/link';

type Item = {
  id: string;
  createdAt: Date;
  filename: string;
  docType: string;
  confidence: number;
  dealId: string | null;
  deceasedName: string | null;
  primaryAddress: string | null;
  errorReason: string | null;
};

export function ExtractList({ items }: { items: Item[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
        No documents extracted yet. Upload one above to see it land here.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left">
          <tr>
            <th className="px-3 py-2">When</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Document</th>
            <th className="px-3 py-2">Top fact</th>
            <th className="px-3 py-2 text-right">Confidence</th>
            <th className="px-3 py-2">Deal</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const confPct = Math.round(item.confidence * 100);
            const confColor =
              confPct >= 80
                ? 'text-emerald-700'
                : confPct >= 50
                  ? 'text-amber-700'
                  : 'text-rose-700';
            return (
              <tr key={item.id} className="border-t border-slate-100">
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
                  {item.createdAt.toISOString().slice(0, 16).replace('T', ' ')}
                </td>
                <td className="px-3 py-2">
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">
                    {item.docType}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <Link
                    href={`/documents/${item.id}`}
                    className="font-medium text-slate-900 underline-offset-2 hover:underline"
                  >
                    {item.filename}
                  </Link>
                  {item.errorReason && (
                    <div className="text-xs text-rose-600">
                      {item.errorReason}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2">
                  {item.deceasedName ? (
                    <div className="text-slate-900">{item.deceasedName}</div>
                  ) : null}
                  {item.primaryAddress && (
                    <div className="text-xs text-slate-500">
                      {item.primaryAddress}
                    </div>
                  )}
                  {!item.deceasedName && !item.primaryAddress && (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
                <td
                  className={`whitespace-nowrap px-3 py-2 text-right ${confColor}`}
                >
                  {confPct}%
                </td>
                <td className="px-3 py-2">
                  {item.dealId ? (
                    <Link
                      href={`/deals/${item.dealId}`}
                      className="text-xs text-slate-600 underline-offset-2 hover:underline"
                    >
                      View deal
                    </Link>
                  ) : (
                    <span className="text-xs text-slate-400">(unlinked)</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
