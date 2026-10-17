// Shared server helpers (Vercel Node functions). Files in api/_lib are not exposed as routes.
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

let _admin;
export function admin() {
  if (!_admin) {
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Supabase env vars missing');
    _admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return _admin;
}

export function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export function cors(req, res) {
  const origin = process.env.SITE_URL || '';
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return true; }
  return false;
}

export async function readRaw(req, limit = 1_000_000) {
  const chunks = []; let size = 0;
  for await (const c of req) { size += c.length; if (size > limit) throw new Error('payload too large'); chunks.push(c); }
  return Buffer.concat(chunks);
}

export async function readJSON(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  const raw = await readRaw(req, 200_000);
  try { return JSON.parse(raw.toString('utf8') || '{}'); } catch { return {}; }
}

/** Verify the Supabase JWT sent by the browser and return the user, or null. */
export async function requireUser(req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) return null;
  const { data, error } = await admin().auth.getUser(token);
  return error ? null : data.user;
}

/** Lemon Squeezy signs the raw body with HMAC-SHA256 (hex) in the X-Signature header. */
export function verifyLemonSignature(rawBody, signature, secret) {
  if (!signature || !secret) return false;
  const digest = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(digest, 'utf8');
  const b = Buffer.from(String(signature), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const normName = (s) => String(s || '').normalize('NFKC').replace(/[ً-ْـ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Business rules for whether a paid order may produce a NEW file now.
 * Pure function so it can be unit-tested.
 */
export function generationDecision({ order, pkg, format, cvName, now = new Date() }) {
  if (!order || order.status !== 'paid') return { ok: false, code: 'not_paid' };
  if (!pkg.formats.includes(format)) return { ok: false, code: 'format_not_in_package' };
  if (new Date(order.unlock_until) < now) return { ok: false, code: 'edit_window_closed' };
  if (order.gen_count >= 60) return { ok: false, code: 'too_many_generations' };
  if (order.locked_name && normName(order.locked_name) !== normName(cvName)) return { ok: false, code: 'name_changed' };
  return { ok: true };
}

/** Pick the best active paid order for a CV (latest unlock window). */
export async function activeOrderFor(userId, cvId) {
  const { data } = await admin().from('orders').select('*')
    .eq('user_id', userId).eq('cv_id', cvId).eq('status', 'paid')
    .order('unlock_until', { ascending: false }).limit(1);
  return data?.[0] || null;
}
