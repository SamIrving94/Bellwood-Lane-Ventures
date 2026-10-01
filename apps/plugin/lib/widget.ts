/**
 * The one inline card every public tool renders into (MCP Apps, mime
 * `text/html;profile=mcp-app`). Plain HTML + a small script, no framework
 * and no external requests: the CSP grants nothing, so the card cannot leak
 * what a user typed.
 *
 * Data arrives two ways, and the card accepts either:
 *  - the MCP Apps bridge: `ui/initialize` handshake, then a
 *    `ui/notifications/tool-result` notification carrying the CallToolResult;
 *  - ChatGPT's `window.openai.toolOutput` (structuredContent), for hosts that
 *    still populate it.
 *
 * Every string is written with textContent, never innerHTML, so a value that
 * came from a user (an address) cannot inject markup.
 *
 * Brand: cream ground, forest ink, leaf for action only, no wax red (that is
 * reserved for the promise mark). docs/brand/KEPT.md.
 */

export const WIDGET_URI = 'ui://kept/card-v1.html';
export const WIDGET_MIME = 'text/html;profile=mcp-app';

export const WIDGET_HTML = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  :root {
    --ground: #F7F3EA; --card: #FFFFFF; --ink: #1F332B; --body: #4C5A50;
    --leaf: #2E7D5B; --leaf-dark: #256A4C; --hair: #E2DCCB; --soft: #EDE7D8;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --ground: #15201B; --card: #1C2A24; --ink: #EDE7D8; --body: #B9C2BB;
      --leaf: #5FB98D; --leaf-dark: #4FA77C; --hair: #2E3D36; --soft: #22322B;
    }
  }
  :root[data-theme="dark"] {
    --ground: #15201B; --card: #1C2A24; --ink: #EDE7D8; --body: #B9C2BB;
    --leaf: #5FB98D; --leaf-dark: #4FA77C; --hair: #2E3D36; --soft: #22322B;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--ground); color: var(--ink);
    font: 15px/1.5 -apple-system, "Segoe UI", Roboto, Arial, sans-serif; }
  .wrap { padding: 16px; }
  .eyebrow { font: 11px/1.4 "Courier New", monospace; letter-spacing: .2em;
    text-transform: uppercase; color: var(--leaf); margin: 0 0 4px; }
  h1 { font: 600 20px/1.2 Georgia, serif; margin: 0 0 12px; }
  h2 { font: 600 16px/1.3 Georgia, serif; margin: 0 0 6px; }
  .grid { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); }
  .card { background: var(--card); border: 1px solid var(--hair); border-radius: 4px; padding: 12px; }
  .big { font: 600 22px/1.1 Georgia, serif; margin: 4px 0 8px; }
  .muted { color: var(--body); font-size: 13px; }
  .line { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; color: var(--body); }
  .line span:last-child { white-space: nowrap; }
  ul { margin: 6px 0 0; padding-left: 18px; }
  li { margin: 4px 0; }
  .chip { display: inline-block; font: 11px "Courier New", monospace; padding: 1px 6px;
    border: 1px solid var(--hair); border-radius: 2px; margin-right: 6px; color: var(--body); }
  .chip.soon { border-color: var(--leaf); color: var(--leaf); }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  td, th { text-align: left; padding: 4px 6px; border-bottom: 1px solid var(--hair); }
  tr.self td { font-weight: 600; }
  .next { margin-top: 14px; background: var(--soft); border: 1px solid var(--hair); border-radius: 4px; padding: 12px; }
  button { background: var(--leaf); color: #fff; border: 0; border-radius: 3px; padding: 9px 14px;
    font: 600 14px Arial, sans-serif; cursor: pointer; margin-top: 8px; }
  button:hover { background: var(--leaf-dark); }
  button:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
  .foot { margin-top: 12px; font-size: 11px; color: var(--body); }
  .foot a { color: var(--leaf); }
</style>
</head>
<body>
<div class="wrap" id="root"><p class="muted">Loading…</p></div>
<script>
(function () {
  var root = document.getElementById('root');
  var rendered = false;
  var nextId = 1;
  var pending = {};

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = String(text);
    return n;
  }
  function gbp(pence) {
    if (pence === null || pence === undefined) return '—';
    var pounds = Math.round(pence / 100);
    var s = Math.abs(pounds).toLocaleString('en-GB');
    return (pounds < 0 ? '-£' : '£') + s;
  }
  function send(msg) { window.parent.postMessage(msg, '*'); }
  function request(method, params) {
    var id = nextId++;
    send({ jsonrpc: '2.0', id: id, method: method, params: params || {} });
    return new Promise(function (resolve) { pending[id] = resolve; });
  }
  function openLink(url) {
    if (window.openai && typeof window.openai.openExternal === 'function') {
      window.openai.openExternal({ href: url });
    } else {
      request('ui/open-link', { url: url });
    }
  }
  function reportSize() {
    send({ jsonrpc: '2.0', method: 'ui/notifications/size-changed',
      params: { width: document.body.scrollWidth, height: document.body.scrollHeight } });
  }

  function nextStep(data) {
    if (!data.nextStep) return null;
    var box = el('div', 'next');
    box.appendChild(el('p', 'muted', data.nextStep.context));
    var b = el('button', null, data.nextStep.label);
    b.type = 'button';
    b.addEventListener('click', function () { openLink(data.nextStep.url); });
    box.appendChild(b);
    return box;
  }
  function footer(data) {
    var f = el('div', 'foot');
    (data.notes || []).forEach(function (n) { f.appendChild(el('p', null, n)); });
    if (data.sources && data.sources.length) {
      var p = el('p', null, 'Sources: ');
      data.sources.forEach(function (s, i) {
        var a = el('a', null, s.label);
        a.href = s.url;
        a.addEventListener('click', function (e) { e.preventDefault(); openLink(s.url); });
        p.appendChild(a);
        if (i < data.sources.length - 1) p.appendChild(document.createTextNode(' · '));
      });
      f.appendChild(p);
    }
    return f;
  }

  function renderSaleRoutes(d) {
    root.appendChild(el('p', 'eyebrow', 'Ways to sell · your figures'));
    root.appendChild(el('h1', null, 'What each route leaves you with'));
    var grid = el('div', 'grid');
    d.routes.forEach(function (r) {
      var c = el('div', 'card');
      c.appendChild(el('h2', null, r.label));
      c.appendChild(el('p', 'big', r.netPence === null ? 'Enter an offer' : gbp(r.netPence)));
      c.appendChild(el('p', 'muted', r.netPence === null ? 'No figure until you have one' : 'left after the costs below'));
      if (r.pricePence !== null) c.appendChild(lineEl('Price (your figure)', gbp(r.pricePence)));
      r.costs.forEach(function (x) { c.appendChild(lineEl(x.label, '−' + gbp(x.pence))); });
      c.appendChild(el('p', 'muted', r.timing));
      c.appendChild(el('p', 'muted', r.certainty));
      c.appendChild(el('p', 'muted', 'Suits: ' + r.suitsWhen));
      c.appendChild(el('p', 'muted', 'Wrong for: ' + r.wrongFor));
      if (r.assumptions.length) {
        var ul = el('ul', 'muted');
        r.assumptions.forEach(function (a) { ul.appendChild(el('li', null, a)); });
        c.appendChild(ul);
      }
      grid.appendChild(c);
    });
    root.appendChild(grid);
    if (d.missing && d.missing.length) {
      var m = el('p', 'muted', 'To complete the picture: ' + d.missing.join(' '));
      root.appendChild(m);
    }
  }
  function lineEl(label, value) {
    var l = el('div', 'line');
    l.appendChild(el('span', null, label));
    l.appendChild(el('span', null, value));
    return l;
  }

  var STATUS = { done_or_past: 'Past', due_soon: 'Due soon', upcoming: 'Upcoming', when_you_sell: 'When you sell' };
  function renderPlan(d) {
    root.appendChild(el('p', 'eyebrow', 'Inherited home · your dates'));
    root.appendChild(el('h1', null, 'A plan for the house'));
    var list = el('div', 'card');
    d.milestones.forEach(function (m) {
      var row = el('div');
      row.style.padding = '8px 0';
      row.style.borderBottom = '1px solid var(--hair)';
      var head = el('div');
      head.appendChild(el('span', 'chip' + (m.status === 'due_soon' ? ' soon' : ''), STATUS[m.status] || m.status));
      head.appendChild(el('strong', null, (m.date ? m.date + ' · ' : '') + m.title));
      row.appendChild(head);
      row.appendChild(el('div', 'muted', m.detail));
      list.appendChild(row);
    });
    root.appendChild(list);
    if (d.checklist && d.checklist.length) {
      var c = el('div', 'card');
      c.style.marginTop = '10px';
      c.appendChild(el('h2', null, 'While the house is empty'));
      var ul = el('ul');
      d.checklist.forEach(function (t) { ul.appendChild(el('li', null, t)); });
      c.appendChild(ul);
      root.appendChild(c);
    }
  }

  function renderRenovation(d) {
    root.appendChild(el('p', 'eyebrow', 'Renovation · budget bands'));
    root.appendChild(el('h1', null, 'What the work might cost'));
    if (d.epc) {
      root.appendChild(el('p', 'muted', 'EPC: ' + (d.epc.rating || 'not stated') +
        (d.epc.constructionAgeBand ? ' · built ' + d.epc.constructionAgeBand : '')));
    }
    var grid = el('div', 'grid');
    d.bands.forEach(function (b) {
      var c = el('div', 'card');
      c.appendChild(el('h2', null, b.label));
      c.appendChild(el('p', 'big', gbp(b.totalPence)));
      c.appendChild(el('p', 'muted', b.covers));
      grid.appendChild(c);
    });
    root.appendChild(grid);
  }

  function renderFacts(d) {
    var r = d.report;
    root.appendChild(el('p', 'eyebrow', 'Public record · not a valuation'));
    root.appendChild(el('h1', null, r.addressLine + ', ' + r.postcode));
    var epc = el('div', 'card');
    epc.appendChild(el('h2', null, 'Energy certificate'));
    if (r.epc.available) {
      epc.appendChild(lineEl('Rating', r.epc.rating || 'Not stated'));
      epc.appendChild(lineEl('Floor area', r.epc.floorAreaSqm ? Math.round(r.epc.floorAreaSqm) + ' m²' : 'Not stated'));
      epc.appendChild(lineEl('Built', r.epc.constructionAgeBand || 'Not stated'));
      epc.appendChild(lineEl('Heating', r.epc.heatingType || 'Not stated'));
      epc.appendChild(lineEl('Inspected', r.epc.inspectionDate || 'Not stated'));
    } else {
      epc.appendChild(el('p', 'muted', 'No certificate found. That is the honest answer, not an error.'));
    }
    root.appendChild(epc);
    var sales = el('div', 'card');
    sales.style.marginTop = '10px';
    sales.appendChild(el('h2', null, 'Recorded sales in this postcode'));
    if (r.streetSales.length) {
      var t = el('table');
      var hr = el('tr');
      ['Date', 'Address', 'Price'].forEach(function (h) { hr.appendChild(el('th', null, h)); });
      t.appendChild(hr);
      r.streetSales.forEach(function (s) {
        var tr = el('tr', s.sameAddress ? 'self' : null);
        tr.appendChild(el('td', null, s.date));
        tr.appendChild(el('td', null, s.address + (s.sameAddress ? ' (this home)' : '')));
        tr.appendChild(el('td', null, '£' + Number(s.pricePounds).toLocaleString('en-GB')));
        t.appendChild(tr);
      });
      sales.appendChild(t);
      if (r.streetContext) {
        sales.appendChild(el('p', 'muted', r.streetContext.saleCount + ' sales, median £' +
          Number(r.streetContext.medianPricePounds).toLocaleString('en-GB') +
          '. Context for a conversation, not a valuation of this home.'));
      }
    } else {
      sales.appendChild(el('p', 'muted', 'No recorded sales found. That is the honest answer, not an error.'));
    }
    root.appendChild(sales);
  }

  function render(data) {
    if (!data || !data.kind) return;
    rendered = true;
    root.textContent = '';
    if (data.kind === 'sale_routes') renderSaleRoutes(data);
    else if (data.kind === 'inherited_home_plan') renderPlan(data);
    else if (data.kind === 'renovation') renderRenovation(data);
    else if (data.kind === 'property_facts') renderFacts(data);
    else { root.appendChild(el('p', 'muted', 'Nothing to show.')); }
    var n = nextStep(data);
    if (n) root.appendChild(n);
    root.appendChild(footer(data));
    reportSize();
  }

  window.addEventListener('message', function (e) {
    var msg = e.data;
    if (!msg || msg.jsonrpc !== '2.0') return;
    if (msg.id !== undefined && pending[msg.id]) {
      pending[msg.id](msg.result);
      delete pending[msg.id];
      return;
    }
    if (msg.method === 'ui/notifications/tool-result' && msg.params) {
      render(msg.params.structuredContent);
    }
    if (msg.method === 'ui/notifications/host-context-changed' && msg.params && msg.params.theme) {
      document.documentElement.setAttribute('data-theme', msg.params.theme);
    }
  });

  request('ui/initialize', {
    appInfo: { name: 'kept-card', version: '1.0.0' },
    appCapabilities: {},
    protocolVersion: '2026-01-26'
  }).then(function (result) {
    var theme = result && result.hostContext && result.hostContext.theme;
    if (theme) document.documentElement.setAttribute('data-theme', theme);
    send({ jsonrpc: '2.0', method: 'ui/notifications/initialized', params: {} });
  });

  function fromOpenAi() {
    if (rendered || !window.openai) return;
    if (window.openai.theme) document.documentElement.setAttribute('data-theme', window.openai.theme);
    if (window.openai.toolOutput) render(window.openai.toolOutput);
  }
  window.addEventListener('openai:set_globals', fromOpenAi);
  fromOpenAi();
})();
</script>
</body>
</html>`;
