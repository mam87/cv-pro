// CV Pro — HR / ATS quality checker. Returns a 0–100 score and actionable tips (AR/EN).

const VERBS_EN = ['led', 'managed', 'developed', 'implemented', 'designed', 'improved', 'reduced', 'increased', 'achieved', 'built', 'launched', 'coordinated', 'trained', 'supervised', 'established', 'streamlined', 'delivered', 'analyzed', 'created', 'optimized', 'negotiated', 'organized', 'introduced', 'validated', 'audited', 'performed', 'prepared', 'mentored', 'automated', 'resolved', 'directed', 'spearheaded', 'oversaw', 'ensured', 'maintained', 'executed'];
const VERBS_AR = ['قدت', 'قيادة', 'أدرت', 'إدارة', 'طورت', 'تطوير', 'نفذت', 'تنفيذ', 'صممت', 'تصميم', 'حسنت', 'تحسين', 'خفضت', 'تخفيض', 'خفض', 'رفعت', 'زيادة', 'حققت', 'تحقيق', 'أسست', 'تأسيس', 'أطلقت', 'إطلاق', 'نسقت', 'تنسيق', 'دربت', 'تدريب', 'أشرفت', 'الإشراف', 'إشراف', 'أنشأت', 'إنشاء', 'حللت', 'تحليل', 'أعددت', 'إعداد', 'راجعت', 'مراجعة', 'دققت', 'تدقيق', 'أتمتة', 'حل', 'وضعت', 'وضع', 'قمت', 'متابعة', 'ضمان', 'تطبيق', 'طبقت', 'اعتماد', 'بناء', 'بنيت'];
export const ACTION_VERBS = { en: VERBS_EN.slice(0, 24).map((v) => v[0].toUpperCase() + v.slice(1)), ar: ['قُدت', 'أدرت', 'طوّرت', 'نفّذت', 'صمّمت', 'حسّنت', 'خفّضت', 'رفعت', 'حقّقت', 'أسّست', 'أطلقت', 'درّبت', 'أشرفت على', 'أعددت', 'دقّقت', 'أتمتت', 'قلّلت', 'اعتمدت'] };

const words = (t) => String(t || '').trim().split(/\s+/).filter(Boolean);
const bl = (t) => String(t || '').split('\n').map((s) => s.replace(/^\s*[-•*]\s*/, '').trim()).filter(Boolean);
const norm = (s) => s.replace(/[ً-ْ]/g, '').toLowerCase();

export function checkCV(cv) {
  const ar = cv.lang !== 'en';
  const T = (a, e) => (ar ? a : e);
  const p = cv.personal || {};
  const tips = [];
  let score = 0;
  const add = (pts, ok, tip) => { if (ok) score += pts; else if (tip) tips.push({ pts, tip }); };

  // 1. Contact (15)
  add(5, !!p.fullName?.trim(), T('أضف اسمك الكامل.', 'Add your full name.'));
  add(5, /\S+@\S+\.\S+/.test(p.email || ''), T('أضف بريداً إلكترونياً مهنياً صحيحاً.', 'Add a valid professional email.'));
  add(5, (p.phone || '').replace(/\D/g, '').length >= 8, T('أضف رقم هاتف مع رمز الدولة (+962…).', 'Add a phone number with country code.'));
  // 2. Headline (5)
  add(5, !!p.title?.trim(), T('أضف مسمّى وظيفياً واضحاً تحت اسمك يطابق الوظيفة المستهدفة.', 'Add a headline matching your target role.'));
  // 3. Summary 35–100 words (10)
  const sw = words(cv.summary).length;
  add(10, sw >= 35 && sw <= 100, sw < 35 ? T(`الملخص قصير (${sw} كلمة). اكتب 3–4 جمل: سنوات الخبرة، التخصص، أبرز إنجاز رقمي، وما تبحث عنه.`, `Summary is short (${sw} words). Aim for 3–4 sentences: years, specialty, top quantified win, goal.`) : T(`الملخص طويل (${sw} كلمة). اختصره لأقل من 100 كلمة.`, `Summary is long (${sw} words). Keep it under 100.`));
  // 4. Experience present (15)
  const exp = (cv.experience || []).filter((e) => e.role || e.company);
  add(15, exp.length >= 1, T('أضف خبرة عملية واحدة على الأقل (يشمل التدريب والتطوع).', 'Add at least one experience (internships/volunteering count).'));
  // 5. ≥2 bullets per role (10)
  const thin = exp.filter((e) => bl(e.bullets).length < 2);
  add(10, exp.length && !thin.length, exp.length ? T(`أضف نقطتين على الأقل لكل وظيفة (${thin.map((e) => e.role || e.company).join('، ')}).`, `Add at least 2 bullets per role (${thin.map((e) => e.role || e.company).join(', ')}).`) : null);
  // 6. Quantified achievements ≥30% (10)
  const all = exp.flatMap((e) => bl(e.bullets));
  const quant = all.filter((b) => /[0-9٠-٩]|%|٪/.test(b)).length;
  add(10, all.length && quant / all.length >= 0.3, all.length ? T(`فقط ${quant} من ${all.length} نقاط فيها أرقام. مسؤولو التوظيف يحبون الأرقام: نسبة، عدد، مبلغ، مدة.`, `Only ${quant}/${all.length} bullets have numbers. Quantify: %, counts, money, time.`) : null);
  // 7. Action verbs ≥50% (10)
  const verbs = (ar ? VERBS_AR : VERBS_EN).map(norm);
  const strong = all.filter((b) => { const w = norm(words(b)[0] || ''); return verbs.some((v) => w.startsWith(v) || w === v); }).length;
  add(10, all.length && strong / all.length >= 0.5, all.length ? T('ابدأ كل نقطة بفعل إنجاز (طوّرت، قُدت، خفّضت…) بدل "مسؤول عن".', 'Start bullets with action verbs (Led, Built, Reduced…) instead of "Responsible for".') : null);
  // 8. Skills ≥6 (10)
  const sk = (cv.skills || []).filter((s) => String(s).trim()).length;
  add(10, sk >= 6, T(`أضف ${Math.max(6 - sk, 1)}+ مهارات. انسخ الكلمات المفتاحية من إعلان الوظيفة نفسه.`, `Add ${Math.max(6 - sk, 1)}+ skills. Mirror keywords from the job ad.`));
  // 9. No first person (5)
  const text = [cv.summary, ...all].join(' ');
  add(5, !(ar ? /(^|\s)(أنا|انا)(\s|$)/ : /\b(I|me|my)\b/).test(text), T('تجنّب ضمير المتكلم "أنا" في السيرة.', 'Avoid first-person pronouns (I, me, my).'));
  // 10. Education (5)
  add(5, (cv.education || []).some((e) => e.degree || e.school), T('أضف مؤهلك العلمي.', 'Add your education.'));
  // 11. Length 250–900 words (5)
  const total = words([cv.summary, ...all, ...(cv.skills || [])].join(' ')).length;
  add(5, total >= 120 && total <= 900, total < 120 ? T('السيرة قصيرة جداً؛ فصّل إنجازاتك أكثر.', 'CV is too thin; expand your achievements.') : T('السيرة طويلة؛ صفحتان كحدّ أقصى.', 'CV is long; keep it to 2 pages max.'));
  // 12. Dates filled (5)
  add(5, exp.every((e) => e.start && (e.end || e.current)), exp.length ? T('أكمل تواريخ البداية والنهاية لكل وظيفة.', 'Complete start/end dates for every role.') : null);
  // 13. Languages (5)
  add(5, (cv.languages || []).some((l) => l.name), T('أضف اللغات ومستواك (مثلاً: الإنجليزية — متقدّم).', 'Add languages with level.'));

  // Advisory (no points)
  const notes = [];
  if (cv.template === 'ats' && p.photo) notes.push(T('قالب ATS لا يعرض الصورة؛ هذا مقصود.', 'ATS template hides the photo by design.'));
  if (cv.template !== 'ats' && p.photo) notes.push(T('الصورة مقبولة في الخليج والأردن، لكن لا تضعها عند التقديم لأمريكا أو بريطانيا أو كندا.', 'Photos are fine for Gulf roles; remove them for US/UK/Canada.'));
  if (/@(hotmail|yahoo)\./i.test(p.email || '')) notes.push(T('بريد Gmail أو بريد باسمك يبدو أكثر احترافية.', 'A Gmail or name-based domain looks more professional.'));

  tips.sort((a, b) => b.pts - a.pts);
  return { score: Math.round((score / 110) * 100), tips: tips.map((t) => t.tip), notes };
}
