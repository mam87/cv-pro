// POST /api/checkout  { cv_id, package }  → { url }
// Creates a Lemon Squeezy checkout bound to this user + CV. Nothing is unlocked here.
import { admin, send, cors, readJSON, requireUser } from './_lib/server.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  const user = await requireUser(req);
  if (!user) return send(res, 401, { error: 'login_required' });

  const { cv_id, package: code } = await readJSON(req);
  const db = admin();
  const { data: cv } = await db.from('cvs').select('id,user_id,content').eq('id', cv_id).single();
  if (!cv || cv.user_id !== user.id) return send(res, 404, { error: 'cv_not_found' });
  const { data: pkg } = await db.from('packages').select('*').eq('code', code).eq('active', true).single();
  if (!pkg?.ls_variant_id) return send(res, 400, { error: 'package_unavailable' });

  const site = process.env.SITE_URL;
  const body = {
    data: {
      type: 'checkouts',
      attributes: {
        checkout_options: { embed: false, media: false, logo: true },
        checkout_data: {
          email: user.email,
          name: cv.content?.personal?.fullName || undefined,
          custom: { user_id: user.id, cv_id: cv.id, package: pkg.code },
        },
        product_options: {
          redirect_url: `${site}/builder.html?cv=${cv.id}&paid=1`,
          receipt_button_text: 'Download my CV',
          receipt_link_url: `${site}/builder.html?cv=${cv.id}&paid=1`,
        },
        expires_at: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
      },
      relationships: {
        store: { data: { type: 'stores', id: String(process.env.LEMONSQUEEZY_STORE_ID) } },
        variant: { data: { type: 'variants', id: String(pkg.ls_variant_id) } },
      },
    },
  };

  const r = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
      Authorization: `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`,
    },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { console.error('LS checkout error', r.status, JSON.stringify(j).slice(0, 500)); return send(res, 502, { error: 'payment_provider' }); }
  return send(res, 200, { url: j.data.attributes.url });
}
