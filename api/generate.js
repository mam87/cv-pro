// POST /api/generate  { cv_id, format: 'pdf' | 'docx' }  → { url, expires_in }
// The final, un-watermarked file is created HERE only, after checking a paid order in the DB.
import { admin, send, cors, readJSON, requireUser, activeOrderFor, generationDecision } from './_lib/server.js';
import { renderCV } from '../shared/templates.js';
import { buildDocx } from './_lib/docx.js';

const URL_TTL = 24 * 3600; // signed link valid 24h

async function htmlToPdf(html) {
  const chromium = (await import('@sparticuz/chromium')).default;
  const puppeteer = (await import('puppeteer-core')).default;
  const browser = await puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 25000 });
    await page.evaluate(() => document.fonts.ready);
    return await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
  } finally { await browser.close(); }
}

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  const user = await requireUser(req);
  if (!user) return send(res, 401, { error: 'login_required' });

  const { cv_id, format } = await readJSON(req);
  if (!['pdf', 'docx'].includes(format)) return send(res, 400, { error: 'bad_format' });
  const db = admin();

  const { data: cv } = await db.from('cvs').select('*').eq('id', cv_id).single();
  if (!cv || cv.user_id !== user.id) return send(res, 404, { error: 'cv_not_found' });

  const order = await activeOrderFor(user.id, cv.id);
  if (!order) return send(res, 402, { error: 'payment_required' });
  const { data: pkg } = await db.from('packages').select('*').eq('code', order.package_code).single();

  const decision = generationDecision({ order, pkg, format, cvName: cv.content?.personal?.fullName });
  if (!decision.ok) {
    // Window closed → still give back the LAST file they generated (they paid for it).
    if (decision.code === 'edit_window_closed') {
      const { data: last } = await db.from('downloads').select('storage_path').eq('order_id', order.id).eq('format', format).order('created_at', { ascending: false }).limit(1);
      if (last?.[0]) {
        const { data: s } = await db.storage.from('exports').createSignedUrl(last[0].storage_path, URL_TTL, { download: true });
        return send(res, 200, { url: s.signedUrl, expires_in: URL_TTL, note: 'last_version' });
      }
    }
    return send(res, 403, { error: decision.code });
  }

  const name = (cv.content?.personal?.fullName || 'CV').replace(/[^\p{L}\p{N} _-]/gu, '').trim().replace(/\s+/g, '_') || 'CV';
  let buf, contentType;
  if (format === 'pdf') { buf = await htmlToPdf(renderCV(cv.content, { watermark: false })); contentType = 'application/pdf'; }
  else { buf = await buildDocx(cv.content); contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'; }

  const path = `${user.id}/${cv.id}/${Date.now()}.${format}`;
  const up = await db.storage.from('exports').upload(path, buf, { contentType, upsert: false });
  if (up.error) { console.error(up.error); return send(res, 500, { error: 'storage' }); }

  await db.from('orders').update({
    gen_count: order.gen_count + 1,
    locked_name: order.locked_name || cv.content?.personal?.fullName || null,
  }).eq('id', order.id);
  await db.from('downloads').insert({ user_id: user.id, cv_id: cv.id, order_id: order.id, format, storage_path: path });

  const { data: signed } = await db.storage.from('exports').createSignedUrl(path, URL_TTL, { download: `${name}.${format}` });
  return send(res, 200, { url: signed.signedUrl, expires_in: URL_TTL });
}
