async function tryEndpoint(postcode: string) {
  const key = process.env.PROPERTYDATA_API_KEY;
  if (!key) { console.error('No PROPERTYDATA_API_KEY'); return; }
  const url = `https://api.propertydata.co.uk/sourced-properties?key=${key}&postcode=${postcode.replace(/\s/g,'')}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  console.log(`${postcode}: HTTP ${res.status}`);
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    console.log('  body:', t.slice(0, 300));
    return;
  }
  const j = await res.json() as any;
  console.log('  shape:', JSON.stringify(Object.keys(j)));
  console.log('  status:', j.status);
  const props = j.result?.properties ?? j.properties ?? j.data ?? [];
  console.log('  properties returned:', Array.isArray(props) ? props.length : 'not-array');
  if (Array.isArray(props) && props[0]) {
    console.log('  first property keys:', JSON.stringify(Object.keys(props[0])));
    console.log('  first property:', JSON.stringify(props[0]).slice(0, 600));
  }
}

async function main() {
  for (const pc of ['M14', 'SK4', 'LS1', 'W14 9JH']) {
    await tryEndpoint(pc);
    console.log();
    await new Promise(r => setTimeout(r, 500));
  }
}
main().catch(e => console.error(e));
