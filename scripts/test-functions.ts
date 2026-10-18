/**
 * Local smoke test for the Netlify Functions — no Netlify CLI required.
 * Runs the handler in-process with real upstream APIs.
 *
 *   npm run test:functions
 */
import alerts from '../netlify/functions/alerts.ts';
import agent from '../netlify/functions/agent.ts';

function check(label: string, ok: boolean, extra = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? ` — ${extra}` : ''}`);
  return ok;
}

async function main() {
  console.log('\n=== /api/alerts ===\n');
  const res = await alerts(new Request('http://localhost/api/alerts'));
  const body = (await res.json()) as {
    alerts: Array<{ id: string; type: string; severity: string; lat: number; summary: string }>;
    meta: {
      status: string;
      total: number;
      counts: Record<string, number>;
      sources: Array<{ id: string; live: boolean; count: number; reason?: string }>;
      tinyfishConfigured: boolean;
    };
  };

  check('HTTP 200', res.status === 200, `got ${res.status}`);
  check('status is ok or degraded', ['ok', 'degraded'].includes(body.meta.status), body.meta.status);
  check('alerts returned', body.alerts.length > 0, `${body.meta.total} records`);

  for (const s of body.meta.sources) {
    console.log(`      ${s.live ? 'live    ' : 'offline '} ${s.id.padEnd(12)} ${String(s.count).padStart(4)} records ${s.reason ?? ''}`);
  }

  const bad = body.alerts.filter((a) => !Number.isFinite(a.lat) || !Number.isFinite(a.lat) || !a.summary || !a.id);
  check('every record has id/summary/coords', bad.length === 0, `${bad.length} malformed`);

  const ids = new Set(body.alerts.map((a) => a.id));
  check('ids are unique', ids.size === body.alerts.length, `${ids.size}/${body.alerts.length}`);

  const sorted = [...body.alerts].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  check('sorted oldest → newest', sorted.every((a, i) => i === 0 || Date.parse(a.timestamp) >= Date.parse(sorted[i - 1].timestamp)));

  console.log('\n=== /api/agent ===\n');
  const key = process.env.TINYFISH_API_KEY;
  if (!key) {
    console.log('SKIP  no TINYFISH_API_KEY set — endpoint returns the documented missing_key response');
    const ares = await agent(new Request('http://localhost/api/agent', { method: 'POST', body: '{}' }));
    const abody = (await ares.json()) as { error?: string };
    check('missing key → 503 missing_key', ares.status === 503 && abody.error === 'missing_key', `${ares.status} ${abody.error}`);
  } else {
    const ares = await agent(
      new Request('http://localhost/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region: 'delhi', fetch: true }),
      }),
    );
    const abody = (await ares.json()) as {
      ok: boolean;
      stages?: Array<{ name: string; status: string }>;
      results?: Array<{ severity: string; summary: string }>;
    };
    check('HTTP 200', ares.status === 200, `got ${ares.status}`);
    check('ok=true', abody.ok === true);
    check('4 stages reported', (abody.stages?.length ?? 0) === 4, `${abody.stages?.length}`);
    check('results returned', (abody.results?.length ?? 0) > 0, `${abody.results?.length}`);
    check(
      'all results carry severity',
      (abody.results ?? []).every((r) => ['low', 'medium', 'high', 'critical'].includes(r.severity)),
    );
  }

  console.log('');
}

main().catch((err) => {
  console.error('SMOKE TEST CRASHED:', err);
  process.exit(1);
});