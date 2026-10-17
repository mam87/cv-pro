// CV Pro — builder page logic
import { renderCV, emptyCV, TEMPLATES } from '../shared/templates.js';
import { checkCV, ACTION_VERBS } from '../shared/ats.js';
import { SAMPLE_AR, SAMPLE_EN } from '../shared/samples.js';
import { CONFIG } from './config.js';
import { DEMO, supa, getUser, signInEmail, signInGoogle, signOut, api, toast, $, $$, esc, store, loadPackages } from './core.js';

const DRAFT_KEY = 'cvpro:draft';
const params = new URLSearchParams(location.search);
let state = { cvId: null, cv: emptyCV('ar') };
let user = null, packages = [], selectedPkg = 'pro', order = null, pendingManual = null, pkgMap = {};

// ---------------- field schemas ----------------
const LISTS = {
  experience: { title: 'وظيفة', add: 'أضف وظيفة', fields: [
    ['role', 'المسمى الوظيفي', 'أخصائي مختبر أول'], ['company', 'جهة العمل', 'مستشفى الجامعة'], ['location', 'المدينة', 'عمّان'],
    ['start', 'من', '2019'], ['end', 'إلى', '2023'], ['current', 'أعمل هنا حالياً', 'check'],
    ['bullets', 'الإنجازات (كل إنجاز في سطر)', 'خفّضت زمن تسليم النتائج 30% عبر…', 'area'],
  ] },
  education: { title: 'مؤهل', add: 'أضف مؤهلاً', fields: [
    ['degree', 'الدرجة والتخصص', 'بكالوريوس علوم مختبرات طبية'], ['school', 'الجامعة / المعهد', 'الجامعة الأردنية'], ['location', 'المدينة', ''],
    ['start', 'من', '2011'], ['end', 'إلى', '2015'], ['details', 'تفاصيل (معدل، مرتبة شرف…)', 'تقدير جيد جداً'],
  ] },
  certifications: { title: 'شهادة', add: 'أضف شهادة أو ترخيصاً', fields: [['name', 'اسم الشهادة', 'PMP'], ['issuer', 'الجهة المانحة', 'PMI'], ['year', 'السنة', '2023']] },
  languages: { title: 'لغة', add: 'أضف لغة', fields: [['name', 'اللغة', 'الإنجليزية'], ['level', 'المستوى', 'select:اللغة الأم|ممتاز|متقدّم|متوسط|مبتدئ|Native|Fluent|Advanced|Intermediate|Basic']] },
  publications: { title: 'منشور', add: 'أضف بحثاً أو منشوراً', fields: [['title', 'العنوان', ''], ['venue', 'المجلة / المؤتمر', ''], ['year', 'السنة', '']] },
};

const TIPS = {
  personal: '<strong>نصيحة توظيف:</strong> استخدم بريداً باسمك، ورقماً يبدأ برمز الدولة. المسمى تحت اسمك يجب أن يطابق الوظيفة التي تتقدم لها، لا وظيفتك القديمة.',
  summary: '<strong>المعادلة:</strong> سنوات الخبرة + التخصص + أبرز إنجاز برقم + ما تبحث عنه. 3–4 جمل، بدون «أنا».',
  experience: '<strong>اكتب إنجازات لا مهاماً:</strong> «خفّضت الهدر 18% خلال 6 أشهر» أقوى من «مسؤول عن المخزون». ابدأ بفعل، وضع رقماً في ثلث النقاط على الأقل.',
  education: '<strong>الترتيب:</strong> الأحدث أولاً. اذكر المعدل فقط إذا كان مرتفعاً أو كنت حديث تخرج.',
  skills: '<strong>سر ATS:</strong> انسخ الكلمات المفتاحية من إعلان الوظيفة نفسه (أسماء أنظمة، معايير، برامج). 8–12 مهارة كافية.',
  certs: '<strong>للمهن الطبية والهندسية:</strong> رقم الترخيص المهني والشهادات المعتمدة يقرؤها مسؤول التوظيف قبل الخبرات.',
  design: '<strong>اختيار القالب:</strong> للشركات الكبرى ومواقع التوظيف استخدم «متوافق مع ATS». للتسليم باليد أو عبر الواتساب «عصري» أو «طبي».',
};

// ---------------- state ----------------
function get(path) { return path.split('.').reduce((o, k) => (o == null ? o : o[k]), state.cv); }
function set(path, val) {
  const ks = path.split('.'); let o = state.cv;
  for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]];
  o[ks.at(-1)] = val;
}

let saveT, prevT;
function changed({ rerenderForm = false } = {}) {
  if (rerenderForm) renderForm();
  clearTimeout(prevT); prevT = setTimeout(updatePreview, 220);
  updateScore();
  store.set(DRAFT_KEY, state);
  clearTimeout(saveT); saveT = setTimeout(saveRemote, 1500);
}

async function saveRemote() {
  if (DEMO || !user) return;
  const sb = await supa();
  const title = state.cv.personal.fullName || 'سيرتي الذاتية';
  if (state.cvId) {
    const { error } = await sb.from('cvs').update({ content: state.cv, title }).eq('id', state.cvId);
    if (error) console.warn(error);
  } else {
    const { data, error } = await sb.from('cvs').insert({ user_id: user.id, content: state.cv, title }).select('id').single();
    if (!error) { state.cvId = data.id; store.set(DRAFT_KEY, state); history.replaceState(null, '', `?cv=${data.id}`); }
  }
  setStatus('saved');
}
function setStatus(s) { const el = $('#save-st'); if (el) el.textContent = s === 'saved' ? 'محفوظ في حسابك' : (user ? '' : 'محفوظ على هذا الجهاز'); }

// ---------------- form rendering ----------------
const inp = (path, label, ph = '', type = 'text', req = false, cls = '') =>
  `<label class="f"><span>${label}${req ? ' <b>*</b>' : ''}</span><input type="${type}" id="f-${path}" data-path="${path}" value="${esc(get(path))}" placeholder="${esc(ph)}" class="${cls}"></label>`;

function listHTML(key) {
  const spec = LISTS[key];
  const items = state.cv[key];
  return `<div class="list" data-list="${key}">${items.map((it, i) => `
    <div class="item-card">
      <div class="tools">
        <span class="muted" style="margin-inline-end:auto">${spec.title} ${i + 1}</span>
        <button class="btn sm ghost" data-move="${key}.${i}.-1" ${i === 0 ? 'disabled' : ''} aria-label="أعلى">↑</button>
        <button class="btn sm ghost" data-move="${key}.${i}.1" ${i === items.length - 1 ? 'disabled' : ''} aria-label="أسفل">↓</button>
        <button class="btn sm ghost" data-del="${key}.${i}" aria-label="حذف">حذف</button>
      </div>
      <div class="grid2">${spec.fields.map(([f, label, ph, kind]) => {
        const path = `${key}.${i}.${f}`;
        if (ph === 'check') return `<label class="check"><input type="checkbox" id="f-${path}" data-path="${path}" ${it[f] ? 'checked' : ''}> ${label}</label>`;
        if (String(ph).startsWith('select:')) return `<label class="f"><span>${label}</span><select id="f-${path}" data-path="${path}"><option value=""></option>${ph.slice(7).split('|').map((o) => `<option ${it[f] === o ? 'selected' : ''}>${o}</option>`).join('')}</select></label>`;
        if (kind === 'area') return `<label class="f" style="grid-column:1/-1"><span>${label}</span><textarea id="f-${path}" data-path="${path}" placeholder="${esc(ph)}">${esc(it[f])}</textarea>
          <div class="chips" aria-label="أفعال إنجاز">${ACTION_VERBS[state.cv.lang === 'en' ? 'en' : 'ar'].slice(0, 10).map((v) => `<button type="button" class="chip" data-verb="${path}">${v}</button>`).join('')}</div></label>`;
        return `<label class="f"><span>${label}</span><input type="text" id="f-${path}" data-path="${path}" value="${esc(it[f])}" placeholder="${esc(ph)}" ${f === 'end' && it.current ? 'disabled' : ''}></label>`;
      }).join('')}</div>
    </div>`).join('')}
    <button class="btn" type="button" data-add="${key}">+ ${spec.add}</button></div>`;
}

const step = (n, id, title, body, open = false) => `<details class="step" id="step-${id}" ${open ? 'open' : ''}><summary><span class="n">${n}</span>${title}<span class="st" id="st-${id}"></span></summary><div class="body">${body}</div></details>`;

function renderForm() {
  const openSet = new Set($$('.step[open]').map((d) => d.id));
  const first = !openSet.size;
  const isOpen = (id) => (first ? id === 'step-personal' : openSet.has(`step-${id}`));
  const p = 'personal';
  const html = `
  <div class="panel" style="margin-bottom:10px">
    <div class="copyline"><b>ابدأ بسرعة:</b>
      <button class="btn sm" data-sample="ar">املأ بمثال عربي</button>
      <button class="btn sm" data-sample="en">English example</button>
      <button class="btn sm ghost" data-reset>ابدأ من الصفر</button>
      <span class="muted" id="save-st" style="margin-inline-start:auto"></span></div>
  </div>
  ${step(1, 'personal', 'البيانات الشخصية', `<div class="tip">${TIPS.personal}</div>
    <div class="grid2">${inp(`${p}.fullName`, 'الاسم الكامل', 'سارة أحمد الخطيب', 'text', true)}${inp(`${p}.title`, 'المسمى الوظيفي المستهدف', 'أخصائية مختبرات طبية', 'text', true)}
    ${inp(`${p}.email`, 'البريد الإلكتروني', 'name@gmail.com', 'email', true, 'ltr')}${inp(`${p}.phone`, 'الهاتف', '+962 79 000 0000', 'tel', true, 'ltr')}
    ${inp(`${p}.location`, 'المدينة والدولة', 'عمّان، الأردن')}${inp(`${p}.linkedin`, 'LinkedIn', 'linkedin.com/in/…', 'text', false, 'ltr')}
    ${inp(`${p}.website`, 'موقع / Portfolio', '', 'text', false, 'ltr')}${inp(`${p}.nationality`, 'الجنسية (مهمة للخليج)', 'أردني')}
    ${inp(`${p}.license`, 'رقم الترخيص المهني (اختياري)', '', 'text', false, 'ltr')}
    <label class="f"><span>صورة شخصية (اختيارية)</span><input type="file" id="f-photo" accept="image/png,image/jpeg,image/webp">
      ${state.cv.personal.photo ? '<button class="btn sm ghost" data-rmphoto type="button">إزالة الصورة</button>' : ''}</label></div>`, isOpen('personal'))}
  ${step(2, 'summary', 'الملخص المهني', `<div class="tip">${TIPS.summary}</div>
    <label class="f"><span>الملخص <span id="sum-count"></span></span><textarea id="f-summary" data-path="summary" placeholder="أخصائي بخبرة 8 سنوات في…">${esc(state.cv.summary)}</textarea></label>`, isOpen('summary'))}
  ${step(3, 'experience', 'الخبرات العملية', `<div class="tip">${TIPS.experience}</div>${listHTML('experience')}`, isOpen('experience'))}
  ${step(4, 'education', 'التعليم', `<div class="tip">${TIPS.education}</div>${listHTML('education')}`, isOpen('education'))}
  ${step(5, 'skills', 'المهارات واللغات', `<div class="tip">${TIPS.skills}</div>
    <label class="f"><span>أضف مهارة واضغط Enter (أو افصل بفاصلة)</span><input type="text" id="f-skill" placeholder="ISO 15189، Excel، قيادة الفرق"></label>
    <div class="chips" id="skills">${state.cv.skills.map((s, i) => `<button type="button" class="chip x" data-rmskill="${i}" aria-label="حذف ${esc(s)}">${esc(s)}</button>`).join('')}</div>
    <h3 style="font-size:15px">اللغات</h3>${listHTML('languages')}`, isOpen('skills'))}
  ${step(6, 'certs', 'الشهادات والمنشورات والمعرّفون', `<div class="tip">${TIPS.certs}</div>${listHTML('certifications')}
    <h3 style="font-size:15px">الأبحاث والمنشورات (اختياري)</h3>${listHTML('publications')}
    <label class="f"><span>المعرّفون</span><select id="f-refmode"><option value="available" ${state.cv.references === 'available' ? 'selected' : ''}>تُقدَّم عند الطلب (الأفضل غالباً)</option><option value="custom" ${state.cv.references !== 'available' ? 'selected' : ''}>اكتبهم بالاسم</option></select></label>
    ${state.cv.references !== 'available' ? `<textarea id="f-references" data-path="references" placeholder="د. … — رئيس القسم — 07…">${esc(state.cv.references)}</textarea>` : ''}`, isOpen('certs'))}
  ${step(7, 'design', 'اللغة والقالب والألوان', `<div class="tip">${TIPS.design}</div>
    <div class="grid2">
      <label class="f"><span>لغة السيرة</span><select id="f-lang" data-path="lang"><option value="ar" ${state.cv.lang === 'ar' ? 'selected' : ''}>العربية</option><option value="en" ${state.cv.lang === 'en' ? 'selected' : ''}>English</option></select></label>
      <label class="f"><span>القالب</span><select id="f-template" data-path="template">${Object.entries(TEMPLATES).map(([k, t]) => `<option value="${k}" ${state.cv.template === k ? 'selected' : ''}>${t.ar}</option>`).join('')}</select></label>
    </div>
    <div class="chips" aria-label="لون التصميم">${['#1d4e89', '#0f5f5c', '#2d3748', '#7a2e3a', '#5b3f8c', '#8a5a14'].map((c) => `<button type="button" class="chip" data-accent="${c}" aria-label="لون ${c}" style="width:34px;height:34px;padding:0;background:${c};${state.cv.accent === c ? 'outline:3px solid var(--ink);outline-offset:2px' : ''}"></button>`).join('')}</div>`, isOpen('design'))}
  ${step(8, 'checkout', 'الدفع والتحميل', '<div id="checkout"></div>', isOpen('checkout') || params.get('paid') === '1')}
  `;
  $('#form-col').innerHTML = html;
  renderCheckout(); setStatus(); updateCounters();
}

function updateCounters() {
  const n = String(state.cv.summary || '').trim().split(/\s+/).filter(Boolean).length;
  const el = $('#sum-count'); if (el) el.textContent = `— ${n} كلمة`;
  const filled = (id, ok) => { const s = $(`#st-${id}`); if (s) s.textContent = ok ? '✓ مكتمل' : ''; };
  const p = state.cv.personal;
  filled('personal', p.fullName && p.email && p.phone && p.title);
  filled('summary', n >= 35);
  filled('experience', state.cv.experience.length);
  filled('education', state.cv.education.length);
  filled('skills', state.cv.skills.length >= 6);
}

// ---------------- events ----------------
function bind() {
  const col = $('#form-col');
  col.addEventListener('input', (e) => {
    const t = e.target, path = t.dataset.path;
    if (!path) return;
    set(path, t.type === 'checkbox' ? t.checked : t.value);
    if (path === 'lang') return changed({ rerenderForm: true });
    if (t.type === 'checkbox' && path.endsWith('.current')) { const end = $(`#f-${path.replace('.current', '.end')}`); if (end) end.disabled = t.checked; }
    updateCounters(); changed();
  });
  col.addEventListener('change', async (e) => {
    const t = e.target;
    if (t.id === 'f-refmode') { state.cv.references = t.value === 'available' ? 'available' : ''; changed({ rerenderForm: true }); }
    if (t.id === 'f-template' || t.id === 'f-lang') changed();
    if (t.id === 'f-photo' && t.files[0]) { state.cv.personal.photo = await resizePhoto(t.files[0]); changed({ rerenderForm: true }); toast('أُضيفت الصورة.'); }
  });
  col.addEventListener('keydown', (e) => {
    if (e.target.id === 'f-skill' && (e.key === 'Enter' || e.key === ',' || e.key === '،')) { e.preventDefault(); addSkills(e.target); }
  });
  col.addEventListener('focusout', (e) => { if (e.target.id === 'f-skill' && e.target.value.trim()) addSkills(e.target); });
  col.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset;
    if (d.add) { const blank = Object.fromEntries(LISTS[d.add].fields.map(([f, , ph]) => [f, ph === 'check' ? false : ''])); state.cv[d.add].push(blank); changed({ rerenderForm: true }); setTimeout(() => $(`#f-${d.add}.${state.cv[d.add].length - 1}.${LISTS[d.add].fields[0][0]}`)?.focus(), 0); }
    else if (d.del) { const [k, i] = d.del.split('.'); state.cv[k].splice(+i, 1); changed({ rerenderForm: true }); }
    else if (d.move) { const [k, i, dir] = d.move.split('.'); const a = state.cv[k], j = +i + +dir; [a[i], a[j]] = [a[j], a[i]]; changed({ rerenderForm: true }); }
    else if (d.rmskill) { state.cv.skills.splice(+d.rmskill, 1); changed({ rerenderForm: true }); }
    else if (d.verb) { const ta = $(`#f-${d.verb}`); const pre = ta.value && !ta.value.endsWith('\n') ? '\n' : ''; ta.value += `${pre}${b.textContent} `; ta.focus(); set(d.verb, ta.value); changed(); }
    else if (d.accent) { state.cv.accent = d.accent; changed({ rerenderForm: true }); }
    else if (d.rmphoto !== undefined) { state.cv.personal.photo = ''; changed({ rerenderForm: true }); }
    else if (d.sample) { state.cv = structuredClone(d.sample === 'en' ? SAMPLE_EN : SAMPLE_AR); changed({ rerenderForm: true }); toast('هذا مثال توضيحي. استبدله ببياناتك.'); }
    else if (d.reset !== undefined) { if (b.dataset.confirm) { state.cv = emptyCV(state.cv.lang); changed({ rerenderForm: true }); } else { b.dataset.confirm = '1'; b.textContent = 'اضغط مرة أخرى للتأكيد'; } }
  });
  $$('.mobile-tabs [data-tab]').forEach((b) => b.addEventListener('click', () => showPane(b.dataset.tab)));
  addEventListener('resize', fitSheet);
}

function addSkills(input) {
  const parts = input.value.split(/[,،\n]/).map((s) => s.trim()).filter(Boolean);
  for (const s of parts) if (!state.cv.skills.includes(s)) state.cv.skills.push(s);
  input.value = '';
  changed({ rerenderForm: true });
  setTimeout(() => $('#f-skill')?.focus(), 0);
}

function showPane(which) {
  $$('.mobile-tabs [data-tab]').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === which));
  $$('[data-pane]').forEach((p) => p.dataset.hideMobile = p.dataset.pane === which ? '0' : '1');
  if (which === 'preview') setTimeout(fitSheet, 30);
}

function resizePhoto(file) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const s = 320, c = document.createElement('canvas'); c.width = c.height = s;
      const m = Math.min(img.width, img.height);
      c.getContext('2d').drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, s, s);
      res(c.toDataURL('image/jpeg', 0.85)); URL.revokeObjectURL(img.src);
    };
    img.onerror = rej; img.src = URL.createObjectURL(file);
  });
}

// ---------------- preview + score ----------------
function updatePreview() {
  const f = $('#sheet');
  f.onload = () => {
    const h = f.contentDocument?.documentElement.scrollHeight || 1123;
    f.style.height = `${Math.max(h, 1123)}px`; fitSheet();
    f.contentDocument?.fonts?.ready.then(() => { const h2 = f.contentDocument.documentElement.scrollHeight; f.style.height = `${Math.max(h2, 1123)}px`; fitSheet(); });
  };
  f.srcdoc = renderCV(state.cv, { watermark: true });
}
function fitSheet() {
  const frame = $('#sheet-frame'), sc = $('#sheet-scale'), f = $('#sheet');
  const w = frame.clientWidth - 28; if (w <= 0) return;
  const k = Math.min(1, w / 794);
  sc.style.transform = `scale(${k})`;
  sc.style.height = `${parseFloat(f.style.height || 1123) * k}px`;
  sc.style.width = '794px';
  frame.style.height = `${parseFloat(f.style.height || 1123) * k + 28}px`;
}
function updateScore() {
  const r = checkCV(state.cv);
  const ring = $('#ring');
  ring.style.setProperty('--v', r.score);
  ring.style.setProperty('--c', r.score >= 80 ? 'var(--ok)' : r.score >= 55 ? 'var(--warn)' : 'var(--bad)');
  $('#ring-v').textContent = r.score;
  const items = [...r.tips.slice(0, 3), ...r.notes.slice(0, 1)];
  $('#tips').innerHTML = items.length ? items.map((t) => `<li>${esc(t)}</li>`).join('') : '<li>سيرتك قوية وجاهزة للتقديم.</li>';
}

// ---------------- checkout ----------------
const fmtJOD = (f) => `${+(f / 1000).toFixed(2)} د.أ`;
const fmtUSD = (c) => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`;
const FEAT = (p) => [
  p.formats.includes('docx') ? 'PDF + ملف Word قابل للتعديل' : 'ملف PDF عالي الدقة',
  `تعديل وإعادة تحميل مجاناً لمدة ${p.edit_days} يوماً`,
  'كل القوالب الأربعة، بالعربي أو الإنجليزي',
  ...(p.ai_enabled ? ['مساعد ذكي لصياغة الملخص والإنجازات', 'رسالة تغطية (Cover Letter) مخصّصة'] : []),
];

function renderCheckout() {
  const old = $('#checkout'); if (!old) return;
  const box = old.cloneNode(false); old.replaceWith(box); // drop old listeners
  const pk = packages.map((p) => `
    <label class="pkg">${p.code === 'pro' ? '<span class="badge">الأكثر طلباً</span>' : ''}
      <input type="radio" name="pkg" value="${p.code}" ${selectedPkg === p.code ? 'checked' : ''}>
      <b>${esc(p.name_ar)}</b>
      <div class="price">${fmtJOD(p.price_jod_fils)} <small>أو ${fmtUSD(p.price_usd_cents)} بالبطاقة</small></div>
      <ul>${FEAT(p).map((f) => `<li>${f}</li>`).join('')}</ul>
    </label>`).join('');

  let action = '';
  const p = pkgMap[selectedPkg];
  if (DEMO) {
    action = `<div class="notice warn">هذه نسخة تجريبية للعرض. الدفع والتحميل يعملان بعد ربط Supabase وبوابة الدفع حسب ملف الإعداد.</div>
      <div class="pay-row"><button class="btn primary" disabled>ادفع ${fmtUSD(p.price_usd_cents)} بالبطاقة</button><button class="btn" disabled>حوالة CliQ ${fmtJOD(p.price_jod_fils)}</button></div>`;
  } else if (!user) {
    action = `<div class="panel"><b>سجّل الدخول لحفظ سيرتك والدفع</b>
      <span class="muted">بياناتك محفوظة على هذا الجهاز، وستنتقل لحسابك بعد الدخول.</span>
      <div class="copyline"><input type="email" id="login-email" class="ltr" placeholder="name@gmail.com" style="flex:1;min-width:180px"><button class="btn primary" id="btn-magic">أرسل رابط الدخول</button></div>
      <button class="btn" id="btn-google">الدخول بحساب Google</button></div>`;
  } else if (order) {
    const op = pkgMap[order.package_code] || p;
    const until = new Date(order.unlock_until).toLocaleDateString('ar-JO', { day: 'numeric', month: 'long', year: 'numeric' });
    action = `<div class="notice ok">تم الدفع — باقة «${esc(op.name_ar)}». التعديل وإعادة التحميل متاحان حتى ${until}.</div>
      <div class="pay-row">${op.formats.map((f) => `<button class="btn primary" data-gen="${f}">تحميل ${f === 'pdf' ? 'PDF' : 'Word'}</button>`).join('')}</div>
      <p class="muted">الملف مرتبط بالاسم «${esc(order.locked_name || state.cv.personal.fullName)}». لسيرة شخص آخر أنشئ سيرة جديدة.</p>
      ${op.ai_enabled ? aiPanel() : ''}`;
  } else if (pendingManual) {
    action = `<div class="notice warn">استلمنا طلب الحوالة (المرجع ${esc(pendingManual.reference)}). يُفعَّل التحميل خلال ساعات العمل بعد مطابقة المبلغ، وتصلك رسالة.</div>`;
  } else {
    action = `<div class="pay-row">
        <button class="btn primary" id="btn-card">ادفع ${fmtUSD(p.price_usd_cents)} بالبطاقة (فيزا / ماستركارد)</button>
        <button class="btn" id="btn-cliq">حوالة CliQ — ${fmtJOD(p.price_jod_fils)}</button></div>
      <div class="panel" id="cliq-panel" hidden>
        <div>حوّل <b>${fmtJOD(p.price_jod_fils)}</b> عبر CliQ إلى الاسم المستعار:</div>
        <div class="copyline"><code id="alias">${esc(CONFIG.CLIQ_ALIAS)}</code><button class="btn sm" data-copy="alias">نسخ</button><span class="muted">${esc(CONFIG.CLIQ_BANK)}</span></div>
        <label class="f"><span>رقم مرجع الحوالة (من تطبيق البنك)</span><input type="text" id="cliq-ref" class="ltr"></label>
        <label class="f"><span>اسم المحوِّل</span><input type="text" id="cliq-name"></label>
        <button class="btn primary" id="btn-cliq-send">أرسلت الحوالة</button>
      </div>
      <p class="muted">الدفع آمن عبر بوابة معتمدة. لا نرى بيانات بطاقتك. الملف يُنشأ فوراً بعد تأكيد البنك.</p>`;
  }
  box.innerHTML = `<div class="pkgs">${pk}</div>${action}`;
  wireCheckout(box);
}

function aiPanel() {
  return `<div class="panel"><b>المساعد الذكي</b><span class="muted">الصق إعلان الوظيفة ليطابق المساعد كلماتها المفتاحية. لن يخترع أرقاماً غير موجودة في بياناتك.</span>
    <textarea id="ai-job" placeholder="الصق نص إعلان الوظيفة هنا (اختياري)"></textarea>
    <div class="pay-row"><button class="btn" data-ai="summary">اكتب الملخص</button>
      ${state.cv.experience.map((e, i) => `<button class="btn" data-ai="bullets" data-i="${i}">حسّن إنجازات: ${esc(e.role || 'وظيفة ' + (i + 1))}</button>`).join('')}
      <button class="btn" data-ai="cover_letter">رسالة تغطية</button></div>
    <div id="ai-out"></div></div>`;
}

function wireCheckout(box) {
  box.addEventListener('change', (e) => { if (e.target.name === 'pkg') { selectedPkg = e.target.value; renderCheckout(); } });
  $('#btn-magic', box)?.addEventListener('click', async () => {
    const email = $('#login-email').value.trim();
    if (!/\S+@\S+\.\S+/.test(email)) return toast('اكتب بريداً صحيحاً.');
    try { await signInEmail(email); toast('أرسلنا رابط الدخول إلى بريدك.', 6000); } catch (err) { toast(err.message); }
  });
  $('#btn-google', box)?.addEventListener('click', signInGoogle);
  $('#btn-cliq', box)?.addEventListener('click', () => { $('#cliq-panel').hidden = !$('#cliq-panel').hidden; });
  $('[data-copy]', box)?.addEventListener('click', async (e) => {
    const t = $('#' + e.target.dataset.copy).textContent;
    try { await navigator.clipboard.writeText(t); toast('تم النسخ.'); } catch { getSelection().selectAllChildren($('#' + e.target.dataset.copy)); }
  });
  $('#btn-card', box)?.addEventListener('click', async (e) => {
    if (!readyToPay()) return;
    e.target.disabled = true; e.target.textContent = 'جارٍ فتح صفحة الدفع…';
    try { await saveRemote(); const { url } = await api('checkout', { cv_id: state.cvId, package: selectedPkg }); location.href = url; }
    catch (err) { toast(err.message); renderCheckout(); }
  });
  $('#btn-cliq-send', box)?.addEventListener('click', async () => {
    if (!readyToPay()) return;
    const ref = $('#cliq-ref').value.trim();
    if (ref.length < 4) return toast('اكتب رقم مرجع الحوالة كما يظهر في تطبيق البنك.');
    await saveRemote();
    const sb = await supa();
    const { data, error } = await sb.from('manual_payments').insert({ user_id: user.id, cv_id: state.cvId, package_code: selectedPkg, reference: ref, payer_name: $('#cliq-name').value.trim() }).select().single();
    if (error) return toast('تعذّر إرسال الطلب. تأكد من رقم المرجع وحاول مرة أخرى.');
    pendingManual = data; renderCheckout();
  });
  $$('[data-gen]', box).forEach((b) => b.addEventListener('click', async () => {
    const old = b.textContent; b.disabled = true; b.textContent = 'جارٍ تجهيز الملف…';
    try { await saveRemote(); const r = await api('generate', { cv_id: state.cvId, format: b.dataset.gen }); location.href = r.url; if (r.note === 'last_version') toast('انتهت فترة التعديل؛ هذه آخر نسخة حمّلتها.'); }
    catch (err) { toast(err.message, 6000); }
    b.disabled = false; b.textContent = old;
  }));
  $$('[data-ai]', box).forEach((b) => b.addEventListener('click', async () => {
    const out = $('#ai-out'); out.innerHTML = '<p class="muted">يكتب…</p>';
    try {
      await saveRemote();
      const r = await api('ai', { cv_id: state.cvId, action: b.dataset.ai, index: b.dataset.i, job: $('#ai-job').value });
      const target = b.dataset.ai === 'summary' ? 'summary' : b.dataset.ai === 'bullets' ? `experience.${b.dataset.i}.bullets` : null;
      out.innerHTML = `<textarea id="ai-text" style="min-height:160px">${esc(r.text)}</textarea>
        <div class="pay-row">${target ? `<button class="btn primary" id="ai-apply">استخدم هذا النص</button>` : ''}<button class="btn" id="ai-copy">نسخ</button><span class="muted">متبقٍ ${r.remaining} طلب</span></div>`;
      $('#ai-apply')?.addEventListener('click', () => { set(target, $('#ai-text').value); changed({ rerenderForm: true }); toast('تم التطبيق. راجع النص قبل التحميل.'); });
      $('#ai-copy').addEventListener('click', async () => { try { await navigator.clipboard.writeText($('#ai-text').value); toast('تم النسخ.'); } catch { $('#ai-text').select(); } });
    } catch (err) { out.innerHTML = `<p class="notice warn">${esc(err.message)}</p>`; }
  }));
}

function readyToPay() {
  const p = state.cv.personal;
  const miss = [!p.fullName && 'الاسم', !p.email && 'البريد', !p.phone && 'الهاتف'].filter(Boolean);
  if (miss.length) { toast(`أكمل: ${miss.join('، ')} قبل الدفع.`); $('#step-personal').open = true; return false; }
  return true;
}

async function refreshOrder() {
  if (DEMO || !user || !state.cvId) return;
  const sb = await supa();
  const { data } = await sb.from('orders').select('*').eq('cv_id', state.cvId).eq('status', 'paid').order('unlock_until', { ascending: false }).limit(1);
  order = data?.[0] || null;
  if (!order) {
    const { data: m } = await sb.from('manual_payments').select('*').eq('cv_id', state.cvId).eq('status', 'pending').limit(1);
    pendingManual = m?.[0] || null;
  }
}

async function waitForPayment() {
  const box = $('#checkout');
  box?.insertAdjacentHTML('afterbegin', '<div class="notice warn" id="wait">نتأكّد من الدفع مع البنك… لا تغلق الصفحة.</div>');
  for (let i = 0; i < 40 && !order; i++) { await new Promise((r) => setTimeout(r, 3000)); await refreshOrder(); }
  history.replaceState(null, '', `?cv=${state.cvId}`);
  renderCheckout();
  toast(order ? 'تم تأكيد الدفع. يمكنك التحميل الآن.' : 'لم يصل التأكيد بعد. سيظهر زر التحميل تلقائياً عند وصوله؛ أعد فتح الصفحة بعد دقائق.', 7000);
}

// ---------------- nav ----------------
function renderNav() {
  $('#nav').innerHTML = DEMO ? '<span class="muted">نسخة تجريبية</span>'
    : user ? `<a class="btn ghost" href="account.html">سيري وطلباتي</a><button class="btn sm" id="btn-out">خروج</button>`
      : `<button class="btn sm" id="btn-in">دخول</button>`;
  $('#btn-out')?.addEventListener('click', signOut);
  $('#btn-in')?.addEventListener('click', () => { $('#step-checkout').open = true; $('#step-checkout').scrollIntoView({ behavior: 'smooth' }); });
}

// ---------------- boot ----------------
async function boot() {
  if (params.get('new')) { store.set(DRAFT_KEY, { cvId: null, cv: emptyCV('ar') }); history.replaceState(null, '', location.pathname); }
  const draft = store.get(DRAFT_KEY);
  if (draft?.cv) state = { cvId: draft.cvId || null, cv: { ...emptyCV(), ...draft.cv } };
  else { state.cv = structuredClone(SAMPLE_AR); setTimeout(() => toast('هذا مثال جاهز لترى النتيجة. اضغط «ابدأ من الصفر» أو عدّل عليه.', 6000), 800); }
  packages = await loadPackages(); pkgMap = Object.fromEntries(packages.map((p) => [p.code, p]));
  user = await getUser();
  if (user) {
    const sb = await supa();
    const id = params.get('cv');
    if (id) {
      const { data } = await sb.from('cvs').select('*').eq('id', id).single();
      if (data) state = { cvId: data.id, cv: { ...emptyCV(), ...data.content } };
    } else if (state.cvId) {
      const { data } = await sb.from('cvs').select('id').eq('id', state.cvId).maybeSingle();
      if (!data) state.cvId = null; // draft belonged to another account
    }
    await refreshOrder();
    sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') location.reload(); });
  }
  renderNav(); renderForm(); bind(); updatePreview(); updateScore(); showPane('form');
  if (user && !state.cvId) saveRemote();
  if (params.get('paid') === '1' && !order) waitForPayment();
}
boot();
