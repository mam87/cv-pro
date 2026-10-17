// POST /api/webhook  — Lemon Squeezy → us. THE ONLY place a card payment unlocks a CV.
// Checks: HMAC signature, event type, paid status, variant ↔ package match, CV ownership. Idempotent.
import { admin, readRaw, send, verifyLemonSignature } from './_lib/server.js';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  const raw = await readRaw(req);
  if (!verifyLemonSignature(raw, req.headers['x-signature'], process.env.LEMONSQUEEZY_WEBHOOK_SECRET)) {
    return send(res, 401, { error: 'bad_signature' });
  }
  let evt; try { evt = JSON.parse(raw.toString('utf8')); } catch { return send(res, 400, { error: 'bad_json' }); }

  const name = evt?.meta?.event_name;
  const custom = evt?.meta?.custom_data || {};
  const a = evt?.data?.attributes || {};
  const orderId = String(evt?.data?.id || '');
  const db = admin();

  if (name === 'order_refunded') {
    await db.from('orders').update({ status: 'refunded' }).eq('provider', 'lemonsqueezy').eq('provider_order_id', orderId);
    return send(res, 200, { ok: true });
  }
  if (name !== 'order_created') return send(res, 200, { ignored: name });
  if (a.status !== 'paid') return send(res, 200, { ignored: 'status_' + a.status });
  if (a.test_mode && process.env.ALLOW_TEST_PAYMENTS !== '1') return send(res, 200, { ignored: 'test_mode' });

  const variantId = String(a.first_order_item?.variant_id || '');
  const { data: pkg } = await db.from('packages').select('*').eq('ls_variant_id', variantId).single();
  if (!pkg || pkg.code !== custom.package) { console.error('variant/package mismatch', variantId, custom.package); return send(res, 200, { ignored: 'package_mismatch' }); }

  const { data: cv } = await db.from('cvs').select('id,user_id').eq('id', custom.cv_id).single();
  if (!cv || cv.user_id !== custom.user_id) return send(res, 200, { ignored: 'cv_owner_mismatch' });

  const { error } = await db.from('orders').upsert({
    user_id: cv.user_id,
    cv_id: cv.id,
    package_code: pkg.code,
    provider: 'lemonsqueezy',
    provider_order_id: orderId,
    status: 'paid',
    amount_cents: a.total,
    currency: a.currency,
    paid_at: a.created_at || new Date().toISOString(),
    unlock_until: new Date(Date.now() + pkg.edit_days * 86400_000).toISOString(),
    raw: { identifier: a.identifier, user_email: a.user_email, test_mode: !!a.test_mode },
  }, { onConflict: 'provider,provider_order_id', ignoreDuplicates: true });

  if (error) { console.error('order insert', error); return send(res, 500, { error: 'db' }); } // 500 → Lemon Squeezy retries
  return send(res, 200, { ok: true });
}
