// Shared browser helpers: Supabase client, auth, API calls, toasts, error messages.
import { CONFIG } from './config.js';

export const DEMO = !CONFIG.SUPABASE_URL;
let _sb;

export async function supa() {
  if (DEMO) return null;
  if (!_sb) {
    const m = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
    _sb = m.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  }
  return _sb;
}

export async function getUser() {
  const sb = await supa();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.user || null;
}

export async function signInEmail(email) {
  const sb = await supa();
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.href } });
  if (error) throw new Error(/rate limit/i.test(error.message) ? 'أُرسلت روابط دخول كثيرة خلال وقت قصير. انتظر قليلاً ثم حاول مرة أخرى.' : error.message);
}
export async function signInGoogle() {
  const sb = await supa();
  await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.href } });
}
export async function signOut() { const sb = await supa(); await sb?.auth.signOut(); location.reload(); }

export const ERR = {
  login_required: 'سجّل الدخول أولاً.',
  cv_not_found: 'لم نجد هذه السيرة في حسابك.',
  payment_required: 'لم يصل تأكيد الدفع بعد. انتظر دقيقة ثم حاول مرة أخرى.',
  format_not_in_package: 'هذه الصيغة غير مشمولة في باقتك. باقة «احترافي» تشمل Word.',
  edit_window_closed: 'انتهت فترة التعديل المجاني لباقتك. يمكنك تحميل آخر نسخة أو شراء باقة جديدة.',
  name_changed: 'الاسم في السيرة يختلف عن الاسم الذي دُفع له. الباقة لشخص واحد؛ أنشئ سيرة جديدة لشخص آخر.',
  too_many_generations: 'وصلت للحد الأقصى من مرات التوليد لهذا الطلب. تواصل معنا.',
  package_unavailable: 'هذه الباقة غير متاحة حالياً.',
  payment_provider: 'تعذّر فتح صفحة الدفع. حاول بعد قليل.',
  premium_only: 'المساعد الذكي متاح في باقة «مميّز» فقط.',
  ai_limit: 'استهلكت عدد طلبات المساعد الذكي في باقتك.',
  ai_not_configured: 'المساعد الذكي غير مفعّل على هذا الموقع بعد.',
  network: 'تعذّر الاتصال. تأكد من الإنترنت وحاول مرة أخرى.',
  card_declined: 'رفض البنك البطاقة. جرّب بطاقة أخرى أو ادفع بحوالة CliQ.',
  payment_not_completed: 'لم تكتمل عملية الدفع ولم يُخصم منك شيء. حاول مرة أخرى.',
  payment_mismatch: 'بيانات الدفع لا تطابق الطلب. تواصل معنا وأرسل رقم العملية من PayPal.',
  bad_order: 'رابط العودة من PayPal غير صالح.',
};

export async function api(path, body) {
  const sb = await supa();
  const { data } = await sb.auth.getSession();
  let r;
  try {
    r = await fetch(`${CONFIG.API_BASE}/api/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` },
      body: JSON.stringify(body),
    });
  } catch { throw new Error(ERR.network); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(ERR[j.error] || `خطأ (${r.status})`);
  return j;
}

let toastTimer;
export function toast(msg, ms = 3500) {
  let el = document.querySelector('.toast');
  if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); document.body.append(el); }
  el.textContent = msg; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const store = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};

export const FALLBACK_PACKAGES = [
  { code: 'basic', name_ar: 'أساسي', price_usd_cents: 500, price_jod_fils: 3000, formats: ['pdf'], edit_days: 7, ai_enabled: false },
  { code: 'pro', name_ar: 'احترافي', price_usd_cents: 900, price_jod_fils: 6000, formats: ['pdf', 'docx'], edit_days: 30, ai_enabled: false },
  { code: 'premium', name_ar: 'مميّز', price_usd_cents: 1900, price_jod_fils: 12000, formats: ['pdf', 'docx'], edit_days: 90, ai_enabled: true },
];

export async function loadPackages() {
  const sb = await supa();
  if (!sb) return FALLBACK_PACKAGES;
  const { data } = await sb.from('packages').select('*').eq('active', true).order('sort');
  return data?.length ? data : FALLBACK_PACKAGES;
}
