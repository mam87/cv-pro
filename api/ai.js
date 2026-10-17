// POST /api/ai  { cv_id, action: 'summary' | 'bullets' | 'cover_letter', job?: string, index?: number }
// Premium-only AI writing assistant, written with an HR recruiter's rules.
import { admin, send, cors, readJSON, requireUser, activeOrderFor } from './_lib/server.js';

const MAX_CALLS = 40;

const SYSTEM = `You are a senior HR recruiter and professional CV writer for the Jordan / GCC job market.
Rules: no first-person pronouns; start bullets with strong action verbs; quantify results (%, counts, money, time) using ONLY facts given — never invent numbers, employers, or credentials; mirror keywords from the target job ad when provided; concise, ATS-friendly plain text, no markdown, no emojis.
Write in the same language as the CV (Arabic = Modern Standard Arabic, professional tone).`;

function prompt(action, cv, job, index) {
  const facts = JSON.stringify({ ...cv, personal: { ...cv.personal, photo: undefined, email: undefined, phone: undefined } });
  const target = job ? `\nTarget job ad:\n${String(job).slice(0, 4000)}` : '';
  if (action === 'summary') return `CV data: ${facts}${target}\n\nWrite a 3–4 sentence professional summary (50–90 words). Return only the summary.`;
  if (action === 'bullets') {
    const e = cv.experience?.[index];
    if (!e) return null;
    return `Full CV for context: ${facts}${target}\n\nRewrite the achievement bullets for this role: ${JSON.stringify(e)}\nReturn 3–5 improved bullets, one per line, no bullet symbols. Where a number is missing, keep the sentence strong without inventing one.`;
  }
  if (action === 'cover_letter') return `CV data: ${facts}${target}\n\nWrite a one-page cover letter (220–320 words) addressed to "Hiring Manager" (or "السيد/ة مدير التوظيف" in Arabic). Plain text paragraphs only.`;
  return null;
}

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  if (!process.env.ANTHROPIC_API_KEY) return send(res, 503, { error: 'ai_not_configured' });
  const user = await requireUser(req);
  if (!user) return send(res, 401, { error: 'login_required' });

  const { cv_id, action, job, index } = await readJSON(req);
  const db = admin();
  const { data: cv } = await db.from('cvs').select('*').eq('id', cv_id).single();
  if (!cv || cv.user_id !== user.id) return send(res, 404, { error: 'cv_not_found' });

  const order = await activeOrderFor(user.id, cv.id);
  if (!order) return send(res, 402, { error: 'payment_required' });
  const { data: pkg } = await db.from('packages').select('ai_enabled').eq('code', order.package_code).single();
  if (!pkg?.ai_enabled) return send(res, 403, { error: 'premium_only' });
  if (new Date(order.unlock_until) < new Date()) return send(res, 403, { error: 'edit_window_closed' });
  if (order.ai_calls >= MAX_CALLS) return send(res, 429, { error: 'ai_limit' });

  const userPrompt = prompt(action, cv.content, job, Number(index));
  if (!userPrompt) return send(res, 400, { error: 'bad_action' });

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: process.env.AI_MODEL || 'claude-sonnet-5-5', max_tokens: 1200, system: SYSTEM, messages: [{ role: 'user', content: userPrompt }] }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { console.error('AI error', r.status, JSON.stringify(j).slice(0, 300)); return send(res, 502, { error: 'ai_provider' }); }

  await db.from('orders').update({ ai_calls: order.ai_calls + 1 }).eq('id', order.id);
  const text = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n').trim();
  return send(res, 200, { text, remaining: MAX_CALLS - order.ai_calls - 1 });
}
