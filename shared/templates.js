// CV Pro — shared CV renderer (used by the browser preview AND the server PDF generator)
// Pure ES module, no dependencies.

export const TEMPLATES = {
  classic: { ar: 'كلاسيكي', en: 'Classic', photo: true },
  modern: { ar: 'عصري', en: 'Modern', photo: true },
  ats: { ar: 'متوافق مع ATS', en: 'ATS Plain', photo: false },
  medical: { ar: 'طبي / صحي', en: 'Medical', photo: true },
};

export const LABELS = {
  ar: {
    summary: 'الملخص المهني', experience: 'الخبرات العملية', education: 'التعليم',
    skills: 'المهارات', certifications: 'الشهادات والتراخيص', languages: 'اللغات',
    publications: 'الأبحاث والمنشورات', references: 'المعرّفون', present: 'حتى الآن',
    referencesAvailable: 'تُقدَّم عند الطلب', contact: 'التواصل', license: 'رقم الترخيص',
    nationality: 'الجنسية', profile: 'نبذة',
  },
  en: {
    summary: 'Professional Summary', experience: 'Professional Experience', education: 'Education',
    skills: 'Skills', certifications: 'Certifications & Licenses', languages: 'Languages',
    publications: 'Publications', references: 'References', present: 'Present',
    referencesAvailable: 'Available upon request', contact: 'Contact', license: 'License No.',
    nationality: 'Nationality', profile: 'Profile',
  },
};

export function emptyCV(lang = 'ar') {
  return {
    lang, template: 'modern', accent: '#1d4e89',
    personal: { fullName: '', title: '', email: '', phone: '', location: '', linkedin: '', website: '', nationality: '', license: '', photo: '' },
    summary: '',
    experience: [], education: [], skills: [], certifications: [], languages: [], publications: [],
    references: 'available',
  };
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const has = (v) => Array.isArray(v) ? v.length > 0 : !!String(v ?? '').trim();
const bullets = (t) => String(t || '').split('\n').map((s) => s.replace(/^\s*[-•*]\s*/, '').trim()).filter(Boolean);
const safeColor = (c) => (/^#[0-9a-fA-F]{6}$/.test(c || '') ? c : '#1d4e89');
const safeImg = (src) => (/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/.test(src || '') ? src : '');

function range(a, b, cur, L) {
  const end = cur ? L.present : b;
  if (!a && !end) return '';
  return `<span class="dates">${esc(a)}${a && end ? ' – ' : ''}${esc(end)}</span>`;
}

function contactItems(p) {
  return [p.email, p.phone, p.location, p.linkedin, p.website].filter(has).map(esc);
}

// ---------- section builders ----------
function sec(title, body, cls = '') {
  return body ? `<section class="sec ${cls}"><h2>${esc(title)}</h2>${body}</section>` : '';
}

function expHTML(cv, L) {
  return cv.experience.filter((e) => has(e.role) || has(e.company)).map((e) => `
    <div class="item">
      <div class="row"><div><div class="role">${esc(e.role)}</div><div class="org">${esc(e.company)}${has(e.location) ? ' · ' + esc(e.location) : ''}</div></div>${range(e.start, e.end, e.current, L)}</div>
      ${bullets(e.bullets).length ? `<ul>${bullets(e.bullets).map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
    </div>`).join('');
}
function eduHTML(cv, L) {
  return cv.education.filter((e) => has(e.degree) || has(e.school)).map((e) => `
    <div class="item">
      <div class="row"><div><div class="role">${esc(e.degree)}</div><div class="org">${esc(e.school)}${has(e.location) ? ' · ' + esc(e.location) : ''}</div></div>${range(e.start, e.end, false, L)}</div>
      ${has(e.details) ? `<p class="small">${esc(e.details)}</p>` : ''}
    </div>`).join('');
}
const certHTML = (cv) => cv.certifications.filter((c) => has(c.name)).map((c) => `<div class="li"><b>${esc(c.name)}</b>${has(c.issuer) ? ' — ' + esc(c.issuer) : ''}${has(c.year) ? ` <span class="dates">${esc(c.year)}</span>` : ''}</div>`).join('');
const pubHTML = (cv) => cv.publications.filter((c) => has(c.title)).map((c) => `<div class="li">${esc(c.title)}${has(c.venue) ? '. <i>' + esc(c.venue) + '</i>' : ''}${has(c.year) ? ` (${esc(c.year)})` : ''}</div>`).join('');
const langHTML = (cv) => cv.languages.filter((c) => has(c.name)).map((c) => `<div class="li"><b>${esc(c.name)}</b>${has(c.level) ? ' — ' + esc(c.level) : ''}</div>`).join('');
const skillsChips = (cv) => cv.skills.filter(has).map((s) => `<span class="chip">${esc(s)}</span>`).join('');
const skillsInline = (cv) => cv.skills.filter(has).map(esc).join(' • ');
function refsHTML(cv, L) {
  if (cv.references === 'available') return `<p>${L.referencesAvailable}</p>`;
  return has(cv.references) ? `<p>${esc(cv.references).replace(/\n/g, '<br>')}</p>` : '';
}

// ---------- base CSS ----------
function baseCSS(cv, rtl, fonts) {
  const a = safeColor(cv.accent);
  return `
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: #fff; }
  body { font-family: ${fonts}; color: #1f2933; font-size: 10.2pt; line-height: 1.5; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { width: 210mm; min-height: 297mm; position: relative; }
  h1 { font-size: 23pt; line-height: 1.2; font-weight: 700; color: #111827; }
  .title { font-size: 12pt; color: ${a}; font-weight: 600; margin-top: 2pt; }
  h2 { font-size: 11pt; font-weight: 700; color: ${a}; text-transform: ${rtl ? 'none' : 'uppercase'}; letter-spacing: ${rtl ? '0' : '.06em'}; margin-bottom: 6pt; padding-bottom: 3pt; border-bottom: 1.2pt solid ${a}33; }
  .sec { margin-bottom: 12pt; break-inside: auto; }
  .item { margin-bottom: 8pt; break-inside: avoid; }
  .row { display: flex; justify-content: space-between; gap: 10pt; align-items: baseline; }
  .role { font-weight: 700; font-size: 10.6pt; color: #111827; }
  .org { color: #4b5563; font-size: 9.8pt; }
  .dates { color: #6b7280; font-size: 9pt; white-space: nowrap; font-variant-numeric: tabular-nums; }
  ul { padding-inline-start: 14pt; margin-top: 3pt; }
  li { margin-bottom: 1.5pt; }
  .li { margin-bottom: 3pt; break-inside: avoid; }
  .small { font-size: 9.4pt; color: #4b5563; margin-top: 2pt; }
  .chip { display: inline-block; padding: 1.5pt 7pt; margin: 0 0 4pt 4pt; border-radius: 10pt; background: ${a}14; color: #1f2933; font-size: 9pt; }
  .contact { color: #4b5563; font-size: 9.3pt; display: flex; flex-wrap: wrap; gap: 1pt 0; }
  .contact > span + span::before { content: "|"; color: #c4c9d1; margin: 0 7pt; }
  .photo { width: 92pt; height: 92pt; border-radius: 50%; object-fit: cover; }
  .num { unicode-bidi: isolate; direction: ltr; display: inline-block; }
  `;
}

const FONT_LINK = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&family=Noto+Naskh+Arabic:wght@400;600;700&family=Source+Serif+4:wght@400;600;700&display=swap" rel="stylesheet">';

function watermarkBlock(lang) {
  const t = lang === 'ar' ? 'معاينة · CV Pro' : 'PREVIEW · CV Pro';
  const tiles = Array.from({ length: 260 }, () => `<span>${t}</span>`).join('');
  return `<div class="wm">${tiles}</div>`;
}
const WM_CSS = `
  .wm { position: fixed; inset: -40% -40%; display: flex; flex-wrap: wrap; gap: 46px 70px; transform: rotate(-30deg); pointer-events: none; z-index: 50; align-content: flex-start; }
  .wm span { font: 700 22px sans-serif; color: rgba(220, 38, 38, .16); white-space: nowrap; }
  body { user-select: none; -webkit-user-select: none; }
  @media print { body * { display: none !important; } body::after { content: "Purchase to download — CV Pro"; display: block; } }
`;

// ---------- templates ----------
function header(cv, L, { photo = true, center = false } = {}) {
  const p = cv.personal;
  const img = photo && safeImg(p.photo) ? `<img class="photo" src="${safeImg(p.photo)}" alt="">` : '';
  const meta = [has(p.nationality) ? `${L.nationality}: ${esc(p.nationality)}` : '', has(p.license) ? `${L.license}: <span class="num">${esc(p.license)}</span>` : ''].filter(Boolean);
  return `<header class="hd ${center ? 'center' : ''}">
    ${img}
    <div class="hd-text">
      <h1>${esc(p.fullName) || '—'}</h1>
      ${has(p.title) ? `<div class="title">${esc(p.title)}</div>` : ''}
      <div class="contact">${contactItems(p).map((c) => `<span><bdi>${c}</bdi></span>`).join('')}</div>
      ${meta.length ? `<div class="contact">${meta.map((m) => `<span>${m}</span>`).join('')}</div>` : ''}
    </div>
  </header>`;
}

function mainSections(cv, L, { skillsAs = 'chips', order } = {}) {
  const map = {
    summary: () => sec(L.summary, has(cv.summary) ? `<p>${esc(cv.summary)}</p>` : ''),
    experience: () => sec(L.experience, expHTML(cv, L)),
    education: () => sec(L.education, eduHTML(cv, L)),
    skills: () => sec(L.skills, skillsAs === 'chips' ? (skillsChips(cv) ? `<div>${skillsChips(cv)}</div>` : '') : (skillsInline(cv) ? `<p>${skillsInline(cv)}</p>` : '')),
    certifications: () => sec(L.certifications, certHTML(cv)),
    publications: () => sec(L.publications, pubHTML(cv)),
    languages: () => sec(L.languages, langHTML(cv)),
    references: () => sec(L.references, refsHTML(cv, L)),
  };
  return (order || ['summary', 'experience', 'education', 'skills', 'certifications', 'publications', 'languages', 'references']).map((k) => map[k]()).join('');
}

function tplClassic(cv, L, rtl) {
  return {
    fonts: rtl ? "'Noto Naskh Arabic', 'Source Serif 4', serif" : "'Source Serif 4', 'Noto Naskh Arabic', Georgia, serif",
    css: `.page { padding: 18mm 18mm 16mm; }
      .hd { display: flex; gap: 16pt; align-items: center; padding-bottom: 10pt; margin-bottom: 12pt; border-bottom: 2.5pt solid ${safeColor(cv.accent)}; }
      .hd .contact { margin-top: 5pt; }`,
    body: header(cv, L) + mainSections(cv, L, { skillsAs: 'inline' }),
  };
}

function tplModern(cv, L, rtl) {
  const a = safeColor(cv.accent);
  const p = cv.personal;
  const img = safeImg(p.photo) ? `<img class="photo" src="${safeImg(p.photo)}" alt="">` : '';
  const side = `
    ${img}
    <div class="side-block"><h3>${L.contact}</h3>${contactItems(p).map((c) => `<div class="side-li"><bdi>${c}</bdi></div>`).join('')}
      ${has(p.nationality) ? `<div class="side-li">${L.nationality}: ${esc(p.nationality)}</div>` : ''}
      ${has(p.license) ? `<div class="side-li">${L.license}: <span class="num">${esc(p.license)}</span></div>` : ''}</div>
    ${cv.skills.filter(has).length ? `<div class="side-block"><h3>${L.skills}</h3>${cv.skills.filter(has).map((s) => `<div class="side-li">▪ ${esc(s)}</div>`).join('')}</div>` : ''}
    ${langHTML(cv) ? `<div class="side-block"><h3>${L.languages}</h3>${cv.languages.filter((l) => has(l.name)).map((l) => `<div class="side-li"><b>${esc(l.name)}</b>${has(l.level) ? `<br><small>${esc(l.level)}</small>` : ''}</div>`).join('')}</div>` : ''}`;
  return {
    fonts: rtl ? "'IBM Plex Sans Arabic', 'IBM Plex Sans', sans-serif" : "'IBM Plex Sans', 'IBM Plex Sans Arabic', sans-serif",
    css: `.page { display: grid; grid-template-columns: 64mm 1fr; }
      .side { background: ${a}; color: #fff; padding: 16mm 9mm; min-height: 297mm; }
      .side .photo { display: block; margin: 0 auto 14pt; border: 3pt solid #ffffff55; width: 104pt; height: 104pt; }
      .side h3 { font-size: 10pt; letter-spacing: ${rtl ? 0 : '.08em'}; text-transform: ${rtl ? 'none' : 'uppercase'}; border-bottom: 1pt solid #ffffff55; padding-bottom: 3pt; margin: 12pt 0 6pt; }
      .side-li { font-size: 9.2pt; margin-bottom: 4pt; word-break: break-word; color: #f1f5f9; }
      .main { padding: 16mm 13mm 14mm; }
      .main h1 { font-size: 24pt; }
      .main .title { margin-bottom: 14pt; }`,
    body: `<aside class="side">${side}</aside><main class="main"><h1>${esc(p.fullName) || '—'}</h1>${has(p.title) ? `<div class="title">${esc(p.title)}</div>` : ''}
      ${mainSections(cv, L, { order: ['summary', 'experience', 'education', 'certifications', 'publications', 'references'] })}</main>`,
  };
}

function tplATS(cv, L, rtl) {
  // Single column, no photo, no tables/columns, standard headings → parses cleanly in applicant tracking systems.
  return {
    fonts: rtl ? "'IBM Plex Sans Arabic', Arial, sans-serif" : "'IBM Plex Sans', Arial, sans-serif",
    css: `.page { padding: 16mm 17mm; }
      h1 { font-size: 20pt; } .title { color: #111827; }
      h2 { color: #111827; border-bottom: 1pt solid #111827; }
      .hd { margin-bottom: 10pt; } .hd .contact { margin-top: 3pt; }`,
    body: header(cv, L, { photo: false }) + mainSections(cv, L, { skillsAs: 'inline' }),
  };
}

function tplMedical(cv, L, rtl) {
  const a = safeColor(cv.accent);
  return {
    fonts: rtl ? "'IBM Plex Sans Arabic', 'IBM Plex Sans', sans-serif" : "'IBM Plex Sans', 'IBM Plex Sans Arabic', sans-serif",
    css: `.page { padding: 0 0 14mm; }
      .hd { display: flex; gap: 16pt; align-items: center; background: linear-gradient(${rtl ? '270deg' : '90deg'}, ${a}, ${a}cc); color: #fff; padding: 14mm 16mm 12mm; margin-bottom: 12pt; }
      .hd h1, .hd .title, .hd .contact { color: #fff; } .hd .contact > span + span::before { color: #ffffff88; }
      .hd .photo { border: 3pt solid #ffffffaa; }
      .body { padding: 0 16mm; }
      h2::before { content: ""; display: inline-block; width: 7pt; height: 7pt; background: ${a}; border-radius: 2pt; margin-inline-end: 6pt; }`,
    body: header(cv, L) + `<div class="body">${mainSections(cv, L, { order: ['summary', 'certifications', 'experience', 'education', 'publications', 'skills', 'languages', 'references'] })}</div>`,
  };
}

const IMPL = { classic: tplClassic, modern: tplModern, ats: tplATS, medical: tplMedical };

/**
 * Render a CV to a full standalone HTML document.
 * @param {object} cv  CV content JSON
 * @param {{watermark?: boolean}} opts
 */
export function renderCV(cv, opts = {}) {
  const c = { ...emptyCV(), ...cv, personal: { ...emptyCV().personal, ...(cv?.personal || {}) } };
  for (const k of ['experience', 'education', 'skills', 'certifications', 'languages', 'publications']) if (!Array.isArray(c[k])) c[k] = [];
  const lang = c.lang === 'en' ? 'en' : 'ar';
  const rtl = lang === 'ar';
  const L = LABELS[lang];
  const t = (IMPL[c.template] || tplModern)(c, L, rtl);
  return `<!doctype html><html lang="${lang}" dir="${rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(c.personal.fullName || 'CV')}</title>${FONT_LINK}
<style>${baseCSS(c, rtl, t.fonts)}${t.css}${opts.watermark ? WM_CSS : ''}</style></head>
<body><div class="page">${t.body}</div>${opts.watermark ? watermarkBlock(lang) : ''}</body></html>`;
}
