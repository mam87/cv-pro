// POST /api/paypal-capture  { order_id }  → { ok: true }
// Called when PayPal sends the buyer back. The SERVER captures the money with PayPal
// and only unlocks the CV if status, amount, currency, user and package all match.
import { admin, send, cors, readJSON, requireUser } from './_lib/server.js';
import { paypal, verifyCapture } from './_lib/paypal.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  const user = await requireUser(req);
  if (!user) return send(res, 401, { error: 'login_required' });

  const { order_id } = await readJSON(req);
  if (!/^[A-Z0-9]{10,30}$/.test(String(order_id || ''))) return send(res, 400, { error: 'bad_order' });

  // Capture (idempotent thanks to PayPal-Request-Id). If it was already captured, read it instead.
  let r = await paypal(`/v2/checkout/orders/${order_id}/capture`, { method: 'POST', body: {}, requestId: `capture-${order_id}` })
    .catch((e) => ({ ok: false, status: 0, data: { message: e.message } }));
  if (!r.ok && r.data?.details?.[0]?.issue === 'ORDER_ALREADY_CAPTURED') r = await paypal(`/v2/checkout/orders/${order_id}`);
  if (!r.ok) {
    const issue = r.data?.details?.[0]?.issue || r.data?.name;
    console.error('PayPal capture', r.status, issue);
    return send(res, 402, { error: issue === 'INSTRUMENT_DECLINED' ? 'card_declined' : 'payment_not_completed' });
  }

  const db = admin();
  const custom = r.data.purchase_units?.[0]?.payments?.captures?.[0]?.custom_id || r.data.purchase_units?.[0]?.custom_id || '';
  const { data: pkg } = await db.from('packages').select('*').eq('code', custom.split('|')[2] || '').single();
  const v = verifyCapture(r.data, { pkg, userId: user.id });
  if (!v.ok) { console.error('PayPal verify failed', v.code, order_id); return send(res, 400, { error: 'payment_mismatch' }); }

  const { data: cv } = await db.from('cvs').select('id,user_id').eq('id', v.cvId).single();
  if (!cv || cv.user_id !== user.id) return send(res, 400, { error: 'payment_mismatch' });

  const { error } = await db.from('orders').upsert({
    user_id: user.id, cv_id: cv.id, package_code: pkg.code,
    provider: 'paypal', provider_order_id: v.captureId, status: 'paid',
    amount_cents: v.amountCents, currency: 'USD',
    unlock_until: new Date(Date.now() + pkg.edit_days * 86400_000).toISOString(),
    raw: { paypal_order: order_id, payer: r.data.payer?.email_address || null },
  }, { onConflict: 'provider,provider_order_id', ignoreDuplicates: true });
  if (error) { console.error('order insert', error); return send(res, 500, { error: 'db' }); }

  return send(res, 200, { ok: true, cv_id: cv.id });
}
