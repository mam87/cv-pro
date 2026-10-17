// POST /api/paypal-create  { cv_id, package } → { url }  (PayPal approval page)
// The price is read from the database, never from the browser.
import { admin, send, cors, readJSON, requireUser } from './_lib/server.js';
import { paypal, usd, customId } from './_lib/paypal.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  const user = await requireUser(req);
  if (!user) return send(res, 401, { error: 'login_required' });

  const { cv_id, package: code } = await readJSON(req);
  const db = admin();
  const { data: cv } = await db.from('cvs').select('id,user_id').eq('id', cv_id).single();
  if (!cv || cv.user_id !== user.id) return send(res, 404, { error: 'cv_not_found' });
  const { data: pkg } = await db.from('packages').select('*').eq('code', code).eq('active', true).single();
  if (!pkg) return send(res, 400, { error: 'package_unavailable' });

  const site = process.env.SITE_URL;
  const r = await paypal('/v2/checkout/orders', {
    method: 'POST',
    body: {
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: cv.id,
        custom_id: customId(user.id, cv.id, pkg.code),
        description: `CV Pro — ${pkg.name_en} package`,
        amount: { currency_code: 'USD', value: usd(pkg.price_usd_cents) },
      }],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: 'CV Pro',
            shipping_preference: 'NO_SHIPPING',
            user_action: 'PAY_NOW',
            return_url: `${site}/builder.html?cv=${cv.id}&pp=1`,
            cancel_url: `${site}/builder.html?cv=${cv.id}&pp=cancel`,
          },
        },
      },
    },
  }).catch((e) => ({ ok: false, data: { message: e.message } }));

  if (!r.ok) { console.error('PayPal create', r.status, JSON.stringify(r.data).slice(0, 400)); return send(res, 502, { error: 'payment_provider' }); }
  const link = (r.data.links || []).find((l) => l.rel === 'payer-action' || l.rel === 'approve');
  if (!link) return send(res, 502, { error: 'payment_provider' });
  return send(res, 200, { url: link.href, order_id: r.data.id });
}
