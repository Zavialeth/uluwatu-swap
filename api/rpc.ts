// /api/rpc.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY;
const ALCHEMY_URL = ALCHEMY_KEY ? `https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}` : null;

// --- Config ---
const MAX_BODY_BYTES = 200_000;         // ~200KB
const TIMEOUT_MS = 12_000;              // 12s upstream timeout
const WINDOW_MS = 10_000;               // rate-limit window
const MAX_HITS = 60;                    // 60 reqs / 10s / IP
const ALLOW_METHODS = new Set<string>([
  'eth_chainId',
  'net_version',
  'eth_blockNumber',
  'eth_call',
  'eth_getBalance',
  'eth_getTransactionReceipt',
  'eth_getTransactionByHash',
  'eth_estimateGas',
  'eth_gasPrice',
  // 'eth_sendRawTransaction', // alleen aanzetten als je het écht nodig hebt
]);

// Best-effort per instance (voor serieuze prod: gebruik Upstash/Redis)
const hits = new Map<string, { count: number; ts: number }>();

function json(res: VercelResponse, status: number, data: unknown) {
  res.status(status);
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  return res.send(JSON.stringify(data));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Security & cache headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  // CORS: sta alleen same-origin toe (vercel/localhost). Pas aan naar jouw domain indien nodig.
  const origin = req.headers.origin || '';
  if (origin) {
    const allowed = origin.endsWith('.vercel.app') || origin.includes('localhost');
    if (allowed) res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET');
    res.setHeader('Access-Control-Allow-Headers', 'content-type');
    return res.status(204).end();
  }

  if (req.method === 'GET') {
    return json(res, 200, { ok: true, service: 'UluwatuSwap RPC proxy', chain: 'arbitrum-42161' });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, GET, OPTIONS');
    return json(res, 405, { error: 'Method Not Allowed' });
  }

  if (!ALCHEMY_URL) {
    return json(res, 500, { error: 'RPC not configured' });
  }

  // Body size guard (snelle check via content-length)
  const contentLength = Number(req.headers['content-length'] || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return json(res, 413, { error: 'Request entity too large' });
  }

  // Rate limiting
  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    (req.socket as any)?.remoteAddress ||
    'unknown';
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now - entry.ts > WINDOW_MS) {
    hits.set(ip, { count: 1, ts: now });
  } else {
    entry.count += 1;
    if (entry.count > MAX_HITS) return json(res, 429, { error: 'Too many requests' });
  }

  // Parse payload en JSON-RPC shape
  const payload = req.body;
  const isBatch = Array.isArray(payload);
  const items: any[] = isBatch ? payload : [payload];

  if (!items.length) return json(res, 400, { error: 'Invalid JSON-RPC payload' });

  for (const it of items) {
    if (!it || it.jsonrpc !== '2.0' || typeof it.method !== 'string') {
      return json(res, 400, { error: 'Invalid JSON-RPC' });
    }
    if (!ALLOW_METHODS.has(it.method)) {
      return json(res, 403, { error: `RPC method not allowed: ${it.method}` });
    }
  }

  // Upstream fetch met timeout
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);

  try {
    const upstream = await fetch(ALCHEMY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ac.signal,
    });

    // Forward status en body; geen secrets in errors
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('content-type', upstream.headers.get('content-type') || 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res.send(text);
  } catch (err: any) {
    const aborted = err?.name === 'AbortError';
    return json(res, aborted ? 504 : 502, { error: aborted ? 'Upstream timeout' : 'Upstream error' });
  } finally {
    clearTimeout(timer);
  }
}

// Beperk body size in Vercel runtimes:
export const config = {
  api: { bodyParser: { sizeLimit: '200kb' } },
};
