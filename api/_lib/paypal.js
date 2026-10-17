// PayPal Orders v2 helpers. All money checks happen on the server.
const BASE = () => (process.env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com');

export async function paypalToken() {
  const id = process.env.PAYPAL_CLIENT_ID, secret = process.env.PAYPAL_SECRET;
  if (!id || !secret) throw new Error('paypal_not_configured');
  const r = await fetch(`${BASE()}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const j = await r.json();
  if (!r.ok) throw new Error('paypal_auth_failed');
  return j.access_token;
}

export async function paypal(path, { method = 'GET', body, requestId } = {}) {
  const token = await paypalToken();
  const r = await fetch(`${BASE()}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(requestId ? { 'PayPal-Request-Id': requestId } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data: j };
}

export const usd = (cents) => (cents / 100).toFixed(2);
export const customId = (userId, cvId, pkg) => `${userId}|${cvId}|${pkg}`;

/**
 * Decide whether a captured PayPal order really pays for this package, user and CV.
 * Pure function → unit-tested.
 */
export function verifyCapture(order, { pkg, userId }) {
  if (!order || order.status !== 'COMPLETED') return { ok: false, code: 'not_completed' };
  const pu = order.purchase_units?.[0];
  const cap = pu?.payments?.captures?.[0];
  if (!cap || cap.status !== 'COMPLETED') return { ok: false, code: 'capture_not_completed' };
  const custom = cap.custom_id || pu.custom_id || '';
  const [uid, cvId, code] = custom.split('|');
  if (uid !== userId) return { ok: false, code: 'wrong_user' };
  if (!pkg || code !== pkg.code) return { ok: false, code: 'wrong_package' };
  if (cap.amount?.currency_code !== 'USD' || cap.amount?.value !== usd(pkg.price_usd_cents)) return { ok: false, code: 'wrong_amount' };
  return { ok: true, cvId, captureId: cap.id, amountCents: Math.round(Number(cap.amount.value) * 100) };
}
