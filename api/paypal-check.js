// GET /api/paypal-check — diagnoses PayPal key problems WITHOUT revealing secrets.
// Shows only: environment, key lengths, the first 4 chars of the (public) client id, and PayPal's error text.
import { send } from './_lib/server.js';
import { paypalAuth } from './_lib/paypal.js';

export default async function handler(req, res) {
  const a = await paypalAuth().catch((e) => ({ ok: false, error: e.message }));
  const tips = [];
  if (!a.ok) {
    if (a.error === 'missing_keys') tips.push('PAYPAL_CLIENT_ID or PAYPAL_SECRET is empty in Vercel, or you did not redeploy after adding them.');
    if (a.error === 'invalid_client') tips.push(`PayPal rejected the keys for the "${a.info?.env}" environment. Copy Client ID and Secret from the SAME tab (Sandbox or Live) as PAYPAL_ENV, from the same app.`);
    if (a.info && a.info.client_id_length && a.info.client_id_length < 60) tips.push('Client ID looks too short — it is usually about 80 characters. Make sure you did not copy the Merchant ID or App ID.');
    if (a.info && a.info.secret_length && a.info.secret_length < 60) tips.push('Secret looks too short — it is usually about 80 characters. Click the eye icon and copy the full secret.');
  }
  return send(res, a.ok ? 200 : 500, { ok: a.ok, ...(a.info || {}), paypal_error: a.error || null, paypal_error_description: a.error_description || null, tips });
}
