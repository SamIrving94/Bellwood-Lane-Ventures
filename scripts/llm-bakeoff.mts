/**
 * LLM bake-off — run our real prompt shapes across candidate models on
 * OpenRouter and write a side-by-side report.
 *
 *   pnpm tsx scripts/llm-bakeoff.mts
 *   pnpm tsx scripts/llm-bakeoff.mts --models qwen/qwen3-235b-a22b-2507,z-ai/glm-5.2 --repeat 3
 *   pnpm tsx scripts/llm-bakeoff.mts --list qwen/,deepseek/,z-ai/   # print live ids + prices only
 *
 * Needs OPENROUTER_API_KEY in the environment or in apps/api/.env.local.
 *
 * What it measures, per model × task:
 *   - did the model follow the output contract (valid JSON with the keys we
 *     read, or prose within the word budget)?
 *   - wall-clock latency
 *   - cost, from OpenRouter's LIVE price list (never a hardcoded table)
 * plus the raw outputs side by side so a human can judge the writing.
 *
 * Every candidate id is checked against OpenRouter's /models list before a
 * single call is made — an unknown id fails loudly with near-matches, so a
 * typo can never be "tested" as a model. This is the offline half of the
 * shadow-eval system: use it to shortlist, then set the winner as the
 * shadow model in Settings → AI models to compare on live traffic.
 *
 * Cost of a default run: 7 models × 4 tasks × 1 repeat ≈ 28 short calls,
 * well under $0.20.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OPENROUTER = 'https://openrouter.ai/api/v1';

/** Open-weight challengers + the two Claude tiers as baselines. */
const DEFAULT_MODELS = [
  'anthropic/claude-haiku-4.5',
  'anthropic/claude-sonnet-4.5',
  'qwen/qwen3-235b-a22b-2507',
  'deepseek/deepseek-v4-flash',
  'z-ai/glm-5.2',
  'moonshotai/kimi-k2.6',
  'meta-llama/llama-4-maverick',
  // Sep 2026 tactic candidates (docs/LLM-ROUTING.md § Tactic).
  'minimax/minimax-m3',
  'qwen/qwen3.8-27b',
];

// ── env ─────────────────────────────────────────────────────────────────────

function loadDotEnvLocal(name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  for (const file of [
    '.env.local',
    'apps/api/.env.local',
    'apps/app/.env.local',
  ]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
      if (m && m[1] === name && m[2]) return m[2];
    }
  }
  return undefined;
}

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : process.argv[i + 1];
}

// ── tasks: the shapes our features actually ask for ─────────────────────────

type Task = {
  id: string;
  /** Which code tier normally runs it — so you compare like with like. */
  tier: 'haiku' | 'sonnet';
  system: string;
  user: string;
  maxTokens: number;
  /** JSON contract: these keys must be present at the top level. */
  jsonKeys?: string[];
  /** Prose contract: at most this many words. */
  maxWords?: number;
};

const TASKS: Task[] = [
  {
    id: 'vendor_reply_triage',
    tier: 'haiku',
    system:
      'You triage replies from property vendors to a UK cash buyer. Return ONLY a JSON object: {"intent": "interested"|"not_now"|"declined"|"question"|"unclear", "sentiment": "positive"|"neutral"|"negative", "next_action": string (one short sentence), "reply_needed": boolean}. No prose, no code fences.',
    user: 'Vendor reply:\n"Thanks for getting in touch. Mum\'s house is going through probate at the moment so we can\'t do anything until the grant comes through, probably October. Happy to talk then if your offer still stands."',
    maxTokens: 200,
    jsonKeys: ['intent', 'sentiment', 'next_action', 'reply_needed'],
  },
  {
    id: 'whatsapp_parse',
    tier: 'sonnet',
    system:
      'You are a structured-data extractor for UK property investment leads shared in WhatsApp groups. Return ONLY a JSON object with keys: propertyAddress, postcode, askingPricePence (integer pence), propertyType, sellerSituation (probate|chain_break|repossession|relocation|short_lease|distressed|unknown), bedrooms, urgency (high|medium|low), confidence (0-1). Omit keys you cannot fill. No prose, no code fences.',
    user: 'Extract the property lead from this WhatsApp message. Return JSON only.\n\n---\nGot a 3 bed terrace on Alder Road in Darlington DL1 2QR, owner relocating to Spain end of month, wants 118k quick sale, needs new kitchen. Call Dave if interested\n---',
    maxTokens: 300,
    jsonKeys: [
      'propertyAddress',
      'postcode',
      'askingPricePence',
      'sellerSituation',
      'confidence',
    ],
  },
  {
    id: 'comp_rationale',
    tier: 'sonnet',
    system:
      'You write the comparable-evidence note that sits under an automated valuation for a UK property buyer. Neutral, precise, no drama. Cite the comps by address. Plain prose, one paragraph, at most 120 words.',
    user: 'Subject: 34 North Green, Staindrop, DL2 3JP — 3-bed mid-terrace, EPC D, unmodernised.\nAVM point estimate £176,000 (range £162k–£191k).\nComps (sold, last 18 months):\n- 12 North Green, DL2 3JP — 3-bed terrace, £181,000, Mar 2026, refurbished\n- 5 Front Street, DL2 3NH — 3-bed terrace, £169,500, Nov 2025\n- 41 North Green, DL2 3JP — 2-bed terrace, £151,000, Jan 2026\n- 8 Winston Road, DL2 3PH — 3-bed semi, £205,000, Jun 2026, extended\n- 19 Front Street, DL2 3NH — 3-bed terrace, £172,000, Aug 2025, dated\nWrite the rationale.',
    maxTokens: 260,
    maxWords: 130,
  },
  {
    id: 'morning_briefing',
    tier: 'haiku',
    system:
      "You write the founder's morning briefing for a UK property-sourcing business. The founder is dyslexic: short lines, bold keywords, one idea per bullet, no filler. Exactly 5 bullets, at most 90 words total, plain markdown.",
    user: 'Overnight: 14 new leads (9 probate, 3 chain-break, 2 relocation). 3 appraisals waiting sign-off (£142k, £98k, £210k offers). 2 vendor replies unread. SLA: 1 offer is 26h old, limit is 48h. Auction scan found 1 lot under 70% of AVM (Lot 44, Middlesbrough, guide £61k, AVM £94k). PropertyData credits: 412 left.',
    maxTokens: 220,
    maxWords: 110,
  },
];

// ── OpenRouter ───────────────────────────────────────────────────────────────

type LiveModel = {
  id: string;
  name: string;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string };
  architecture?: { input_modalities?: string[] };
  supported_parameters?: string[];
};

async function fetchLiveModels(): Promise<Map<string, LiveModel>> {
  const res = await fetch(`${OPENROUTER}/models`);
  if (!res.ok) throw new Error(`OpenRouter /models ${res.status}`);
  const body = (await res.json()) as { data: LiveModel[] };
  return new Map(body.data.map((m) => [m.id, m]));
}

function perMillion(perToken?: string): number | null {
  const n = Number(perToken);
  return Number.isFinite(n) ? n * 1_000_000 : null;
}

type CallResult = {
  ok: boolean;
  text: string;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number | null;
  error?: string;
};

async function callModel(
  apiKey: string,
  model: LiveModel,
  task: Task
): Promise<CallResult> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);
  try {
    const res = await fetch(`${OPENROUTER}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Title': 'Bellwood LLM bake-off',
      },
      body: JSON.stringify({
        model: model.id,
        temperature: 0.2,
        max_tokens: task.maxTokens,
        messages: [
          { role: 'system', content: task.system },
          { role: 'user', content: task.user },
        ],
      }),
    });
    const latencyMs = Date.now() - startedAt;
    const body = (await res.json()) as {
      error?: { message?: string };
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    if (!res.ok || body.error) {
      return {
        ok: false,
        text: '',
        latencyMs,
        promptTokens: 0,
        completionTokens: 0,
        costUsd: null,
        error: body.error?.message ?? `HTTP ${res.status}`,
      };
    }
    const promptTokens = body.usage?.prompt_tokens ?? 0;
    const completionTokens = body.usage?.completion_tokens ?? 0;
    const pIn = Number(model.pricing?.prompt);
    const pOut = Number(model.pricing?.completion);
    const costUsd =
      Number.isFinite(pIn) && Number.isFinite(pOut)
        ? promptTokens * pIn + completionTokens * pOut
        : null;
    return {
      ok: true,
      text: body.choices?.[0]?.message?.content?.trim() ?? '',
      latencyMs,
      promptTokens,
      completionTokens,
      costUsd,
    };
  } catch (err) {
    return {
      ok: false,
      text: '',
      latencyMs: Date.now() - startedAt,
      promptTokens: 0,
      completionTokens: 0,
      costUsd: null,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

// ── contract checks (mirror @repo/ai extractJson tolerance) ──────────────────

function extractJson(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const candidate = fenced ? (fenced[1] ?? '') : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as Record<
      string,
      unknown
    >;
  } catch {
    return null;
  }
}

function checkContract(
  task: Task,
  text: string
): { pass: boolean; note: string } {
  if (task.jsonKeys) {
    const obj = extractJson(text);
    if (!obj) return { pass: false, note: 'no parseable JSON' };
    const missing = task.jsonKeys.filter((k) => !(k in obj));
    const fenced = text.includes('```');
    if (missing.length)
      return { pass: false, note: `missing ${missing.join(', ')}` };
    return { pass: true, note: fenced ? 'ok (used code fences)' : 'ok' };
  }
  const words = text.split(/\s+/).filter(Boolean).length;
  if (words === 0) return { pass: false, note: 'empty' };
  if (task.maxWords && words > task.maxWords) {
    return { pass: false, note: `${words} words > ${task.maxWords}` };
  }
  return { pass: true, note: `${words} words` };
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const live = await fetchLiveModels();

  const list = arg('--list');
  if (list) {
    const prefixes = list.split(',').map((p) => p.trim());
    const rows = [...live.values()]
      .filter(
        (m) =>
          prefixes.some((p) => m.id.startsWith(p)) && !m.id.endsWith(':free')
      )
      .sort((a, b) => a.id.localeCompare(b.id));
    for (const m of rows) {
      const vision = m.architecture?.input_modalities?.includes('image')
        ? ' vision'
        : '';
      console.log(
        `${m.id.padEnd(48)} $${perMillion(m.pricing?.prompt)?.toFixed(3)}/M in  $${perMillion(m.pricing?.completion)?.toFixed(3)}/M out  ctx ${m.context_length}${vision}`
      );
    }
    return;
  }

  const apiKey = loadDotEnvLocal('OPENROUTER_API_KEY');
  if (!apiKey) {
    console.error('OPENROUTER_API_KEY not set (env or apps/api/.env.local)');
    process.exit(1);
  }

  const modelIds = (arg('--models') ?? DEFAULT_MODELS.join(','))
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
  const repeat = Math.max(1, Number(arg('--repeat') ?? 1) || 1);
  const taskFilter = arg('--tasks')
    ?.split(',')
    .map((t) => t.trim());
  const tasks = taskFilter
    ? TASKS.filter((t) => taskFilter.includes(t.id))
    : TASKS;

  // Fail loudly on any id OpenRouter does not know — never "test" a typo.
  const unknown = modelIds.filter((id) => !live.has(id));
  if (unknown.length) {
    for (const id of unknown) {
      const tail = id.split('/').pop() ?? id;
      const near = [...live.keys()]
        .filter((k) => k.includes(tail.slice(0, 6)))
        .slice(0, 6);
      console.error(
        `Unknown OpenRouter model "${id}". Near matches: ${near.join(', ') || 'none'}`
      );
    }
    process.exit(1);
  }

  const results: {
    model: string;
    task: string;
    run: number;
    call: CallResult;
    contract: { pass: boolean; note: string };
  }[] = [];

  for (const id of modelIds) {
    const model = live.get(id);
    if (!model) {
      continue;
    }
    for (const task of tasks) {
      for (let run = 1; run <= repeat; run++) {
        process.stdout.write(`${id} × ${task.id} #${run} … `);
        const call = await callModel(apiKey, model, task);
        const contract = call.ok
          ? checkContract(task, call.text)
          : { pass: false, note: call.error ?? 'failed' };
        results.push({ model: id, task: task.id, run, call, contract });
        console.log(
          `${contract.pass ? 'PASS' : 'FAIL'} ${call.latencyMs}ms ${call.costUsd != null ? `$${call.costUsd.toFixed(5)}` : ''} ${contract.note}`
        );
      }
    }
  }

  // ── report ────────────────────────────────────────────────────────────────
  const date = new Date().toISOString().slice(0, 10);
  const lines: string[] = [];
  lines.push(`# LLM bake-off — ${date}`);
  lines.push('');
  lines.push(
    `Models: ${modelIds.join(', ')}. Tasks: ${tasks.map((t) => t.id).join(', ')}. Repeats: ${repeat}.`
  );
  lines.push('');
  lines.push(
    'Prices are OpenRouter\'s live list at run time (USD per 1M tokens). "Contract" = followed the output shape our code reads (JSON keys / word budget). Judge the writing yourself in the sections below — a pass here is necessary, not sufficient.'
  );
  lines.push('');
  lines.push(
    '| Model | $/M in | $/M out | Contract pass | Avg latency | Avg cost/call | Est. cost / 1k calls |'
  );
  lines.push('|:--|--:|--:|--:|--:|--:|--:|');
  const summary = modelIds.map((id) => {
    const rs = results.filter((r) => r.model === id);
    const passes = rs.filter((r) => r.contract.pass).length;
    const okCalls = rs.filter((r) => r.call.ok);
    const avgLatency = okCalls.length
      ? okCalls.reduce((a, r) => a + r.call.latencyMs, 0) / okCalls.length
      : null;
    const costs = okCalls
      .map((r) => r.call.costUsd)
      .filter((c): c is number => c != null);
    const avgCost = costs.length
      ? costs.reduce((a, c) => a + c, 0) / costs.length
      : null;
    const m = live.get(id);
    return { id, passes, total: rs.length, avgLatency, avgCost, m };
  });
  summary.sort(
    (a, b) =>
      b.passes / b.total - a.passes / a.total ||
      (a.avgCost ?? 9) - (b.avgCost ?? 9)
  );
  for (const s of summary) {
    lines.push(
      `| \`${s.id}\` | ${perMillion(s.m?.pricing?.prompt)?.toFixed(3) ?? '?'} | ${perMillion(s.m?.pricing?.completion)?.toFixed(3) ?? '?'} | ${s.passes}/${s.total} | ${s.avgLatency != null ? `${Math.round(s.avgLatency)} ms` : '—'} | ${s.avgCost != null ? `$${s.avgCost.toFixed(5)}` : '—'} | ${s.avgCost != null ? `$${(s.avgCost * 1000).toFixed(2)}` : '—'} |`
    );
  }
  for (const task of tasks) {
    lines.push('');
    lines.push(`## ${task.id} (${task.tier} tier in code)`);
    lines.push('');
    lines.push('<details><summary>Prompt</summary>');
    lines.push('');
    lines.push('```');
    lines.push(`SYSTEM: ${task.system}`);
    lines.push('');
    lines.push(`USER: ${task.user}`);
    lines.push('```');
    lines.push('');
    lines.push('</details>');
    for (const id of modelIds) {
      for (const r of results.filter(
        (r) => r.model === id && r.task === task.id
      )) {
        lines.push('');
        lines.push(
          `### ${id} — run ${r.run} — ${r.contract.pass ? 'PASS' : 'FAIL'} (${r.contract.note}) — ${r.call.latencyMs} ms${r.call.costUsd != null ? ` — $${r.call.costUsd.toFixed(5)}` : ''}`
        );
        lines.push('');
        lines.push('```');
        lines.push(r.call.ok ? r.call.text : `ERROR: ${r.call.error}`);
        lines.push('```');
      }
    }
  }
  const outDir = arg('--out') ?? 'docs/llm-bakeoff';
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, `${date}.md`);
  writeFileSync(outFile, `${lines.join('\n')}\n`);
  console.log(`\nReport written to ${outFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
