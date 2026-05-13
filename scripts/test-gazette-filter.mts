async function tryFilter(filter: string) {
  const url = `https://www.thegazette.co.uk/all-notices/notice/data.json?${filter}&results-page-size=3`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0 (compatible; BellwoodsScout/1.0; +https://bellwood-web.vercel.app)',
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return { filter, status: res.status, body: body.slice(0, 100) };
  }
  const j = await res.json() as any;
  const codes = (j.entry ?? []).slice(0, 3).map((e: any) => e['f:notice-code']);
  const types = (j.entry ?? []).slice(0, 1).map((e: any) => e['title']);
  return { filter, status: res.status, total: j['f:total'], entries: (j.entry ?? []).length, codes, sampleTitle: types[0] };
}

async function main() {
  const filters = [
    'noticetype=deceased-estates',
    'noticetype=2901',
    'category=11',
    'notice-code=2901',
    'q=trustee',
    '',
  ];
  for (const f of filters) {
    const r = await tryFilter(f);
    console.log(JSON.stringify(r));
    // Brief delay to be polite
    await new Promise(r => setTimeout(r, 800));
  }
}
main().catch(e => console.error(e));
