// api/rpc.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY; // server-side (GEEN VITE_)
const ALCHEMY_URL = ALCHEMY_API_KEY
  ? `https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
  : null;

function json(res: VercelResponse, status: number, data: unknown) {
  res.status(status);
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.send(JSON.stringify(data));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    return json(res, 200, { ok: true, service: 'UluwatuSwap RPC proxy', chain: 'arbitrum-42161' });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, GET');
    return json(res, 405, { error: 'Method Not Allowed' });
  }

  if (!ALCHEMY_URL) {
    return json(res, 500, { error: 'Missing ALCHEMY_API_KEY on server' });
  }

  const payload = req.body;
  const isBatch = Array.isArray(payload);
  const isSingle = typeof payload === 'object' && payload !== null;

  if (!isBatch && !isSingle) {
    return json(res, 400, { error: 'Invalid JSON-RPC payload' });
  }

  try {
    const upstream = await fetch(ALCHEMY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.send(text);
  } catch (err: any) {
    return json(res, 502, { error: 'Upstream error', details: String(err?.message || err) });
  }
}
