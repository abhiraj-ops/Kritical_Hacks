/**
 * Zero-dependency local API server for development.
 *
 * `netlify dev` is the normal path, but it needs the Netlify CLI. This script
 * serves the same two handlers on http://127.0.0.1:8888 so `npm run dev`
 * (which proxies /api there) works with nothing but Node.
 *
 *   npm run dev:api
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import alerts from '../netlify/functions/alerts.ts';
import agent from '../netlify/functions/agent.ts';

/** Load .env / .env.local into process.env without adding a dependency. */
function loadEnvFiles() {
  for (const file of ['.env', '.env.local']) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const value = m[2].replace(/^["']|["']$/g, '');
      if (!process.env[m[1]]) process.env[m[1]] = value;
    }
  }
}
loadEnvFiles();

const PORT = Number(process.env.API_PORT ?? 8888);

const routes: Record<string, (req: Request) => Promise<Response>> = {
  '/api/alerts': alerts,
  '/api/agent': agent,
};

createServer(async (nodeReq, nodeRes) => {
  const url = new URL(nodeReq.url ?? '/', `http://${nodeReq.headers.host}`);

  if (nodeReq.method === 'OPTIONS') {
    nodeRes.writeHead(204, { 'Access-Control-Allow-Origin': '*' }).end();
    return;
  }

  const handler = routes[url.pathname];
  if (!handler) {
    nodeRes.writeHead(404, { 'Content-Type': 'application/json' });
    nodeRes.end(JSON.stringify({ error: 'not_found', path: url.pathname }));
    console.log(`404 ${url.pathname}`);
    return;
  }

  let body = '';
  if (nodeReq.method === 'POST') {
    for await (const chunk of nodeReq) body += chunk;
  }

  try {
    const res = await handler(
      new Request(`http://localhost${url.pathname}`, {
        method: nodeReq.method,
        headers: Object.entries(nodeReq.headers).reduce<Record<string, string>>((acc, [k, v]) => {
          if (typeof v === 'string') acc[k] = v;
          return acc;
        }, {}),
        body: nodeReq.method === 'POST' ? body : undefined,
      }),
    );

    nodeRes.writeHead(res.status, Object.fromEntries(res.headers.entries()));
    nodeRes.end(Buffer.from(await res.arrayBuffer()));
    console.log(`${res.status} ${nodeReq.method} ${url.pathname}`);
  } catch (err) {
    nodeRes.writeHead(500, { 'Content-Type': 'application/json' });
    nodeRes.end(JSON.stringify({ error: 'function_crashed', message: (err as Error).message }));
    console.error(`500 ${url.pathname}`, err);
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`EcoPulse API listening on http://127.0.0.1:${PORT}`);
  console.log('  GET  /api/alerts');
  console.log('  POST /api/agent');
});