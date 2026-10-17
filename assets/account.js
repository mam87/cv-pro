// CV Pro — "My CVs & orders" + admin panel
import { DEMO, supa, getUser, signOut, toast, $, esc } from './core.js';

const app = $('#app');
const d = (s) => (s ? new Date(s).toLocaleDateString('ar-JO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const money = (c, cur) => `${(c / 100).toFixed(2)} ${cur === 'JOD' ? 'د.أ' : cur}`;

async function boot() {
  $('#btn-out').addEventListener('click', signOut);
  if (DEMO) { app.innerHTML = '<div class="notice warn">هذه الصفحة تعمل بعد ربط Supabase (راجع ملف الإعداد).</div>'; return; }
  const user = await getUser();
  if (!user) { location.href = 'builder.html'; return; }
  const sb = await supa();

  const [{ data: cvs }, { data: orders }, { data: prof }] = await Promise.all([
    sb.from('cvs').select('id,title,updated_at').order('updated_at', { ascending: false }),
    sb.from('orders').select('*').eq('user_id', user.id).order('paid_at', { ascending: false }),
    sb.from('profiles').select('role').eq('id', user.id).single(),
  ]);

  app.innerHTML = `
    <h2>سيري الذاتية</h2>
    <div class="tbl"><table><thead><tr><th>الاسم</th><th>آخر تعديل</th><th>الحالة</th><th></th></tr></thead><tbody>
      ${(cvs || []).map((c) => { const o = (orders || []).find((x) => x.cv_id === c.id && x.status === 'paid'); const active = o && new Date(o.unlock_until) > new Date();
        return `<tr><td>${esc(c.title)}</td><td>${d(c.updated_at)}</td><td>${o ? `<span class="pill ${active ? 'ok' : ''}">${active ? 'مدفوعة — حتى ' + d(o.unlock_until) : 'مدفوعة (انتهى التعديل)'}</span>` : '<span class="pill">مسودة</span>'}</td><td><a class="btn sm" href="builder.html?cv=${c.id}">فتح</a></td></tr>`; }).join('') || '<tr><td colspan="4" class="muted">لا توجد سير بعد. ابدأ من زر «سيرة جديدة».</td></tr>'}
    </tbody></table></div>
    <h2>مدفوعاتي</h2>
    <div class="tbl"><table><thead><tr><th>التاريخ</th><th>الباقة</th><th>الطريقة</th><th>المبلغ</th><th>الحالة</th></tr></thead><tbody>
      ${(orders || []).map((o) => `<tr><td>${d(o.paid_at)}</td><td>${esc(o.package_code)}</td><td>${o.provider === 'cliq' ? 'CliQ' : 'بطاقة'}</td><td class="num">${money(o.amount_cents, o.currency)}</td><td><span class="pill ${o.status === 'paid' ? 'ok' : 'warn'}">${o.status === 'paid' ? 'مدفوع' : 'مسترد'}</span></td></tr>`).join('') || '<tr><td colspan="5" class="muted">لا مدفوعات بعد.</td></tr>'}
    </tbody></table></div>
    <div id="admin"></div>`;

  if (prof?.role === 'admin') renderAdmin(sb);
}

async function renderAdmin(sb) {
  const box = $('#admin');
  const [{ data: pending }, { data: rev }, { data: pkgs }] = await Promise.all([
    sb.from('manual_payments').select('*').eq('status', 'pending').order('created_at'),
    sb.rpc('admin_revenue'),
    sb.from('packages').select('*').order('sort'),
  ]);
  const today = new Date().toISOString().slice(0, 10), month = today.slice(0, 7);
  const sum = (f) => (rev || []).filter(f).reduce((a, r) => a + Number(r.total_cents), 0);
  const cnt = (f) => (rev || []).filter(f).reduce((a, r) => a + Number(r.orders), 0);
  const pkgPrice = Object.fromEntries((pkgs || []).map((p) => [p.code, p.price_jod_fils / 1000]));

  box.innerHTML = `
    <h2>لوحة الإدارة</h2>
    <div class="kpis">
      <div class="kpi"><span class="muted">طلبات اليوم</span><b>${cnt((r) => r.day === today)}</b></div>
      <div class="kpi"><span class="muted">طلبات هذا الشهر</span><b>${cnt((r) => r.day.startsWith(month))}</b></div>
      <div class="kpi"><span class="muted">إيراد الشهر (بطاقة، $)</span><b>${(sum((r) => r.day.startsWith(month) && r.currency === 'USD') / 100).toFixed(2)}</b></div>
      <div class="kpi"><span class="muted">إيراد الشهر (CliQ، د.أ)</span><b>${(sum((r) => r.day.startsWith(month) && r.currency === 'JOD') / 100).toFixed(2)}</b></div>
    </div>
    <h2>حوالات CliQ بانتظار المراجعة (${(pending || []).length})</h2>
    <p class="muted">طابق رقم المرجع والمبلغ في تطبيق البنك قبل الموافقة.</p>
    <div class="tbl"><table><thead><tr><th>التاريخ</th><th>المرجع</th><th>المحوِّل</th><th>الباقة</th><th>المبلغ المتوقع</th><th></th></tr></thead><tbody>
      ${(pending || []).map((m) => `<tr><td>${d(m.created_at)}</td><td class="num">${esc(m.reference)}</td><td>${esc(m.payer_name || '')}</td><td>${esc(m.package_code)}</td><td class="num">${pkgPrice[m.package_code] ?? '—'} د.أ</td>
        <td class="row"><button class="btn sm primary" data-ok="${m.id}">موافقة</button><button class="btn sm" data-no="${m.id}">رفض</button></td></tr>`).join('') || '<tr><td colspan="6" class="muted">لا يوجد.</td></tr>'}
    </tbody></table></div>
    <h2>الباقات والأسعار</h2>
    <p class="muted">رقم Variant من Lemon Squeezy (Products → المنتج → Variant ID). الأسعار بالسنت والفلس.</p>
    <div class="tbl"><table><thead><tr><th>الباقة</th><th>سنت $</th><th>فلس د.أ</th><th>أيام التعديل</th><th>Variant ID</th><th>مفعّلة</th><th></th></tr></thead><tbody>
      ${(pkgs || []).map((p) => `<tr data-code="${p.code}"><td>${esc(p.name_ar)}</td>
        <td><input type="text" id="usd-${p.code}" value="${p.price_usd_cents}" style="width:80px" class="ltr"></td>
        <td><input type="text" id="jod-${p.code}" value="${p.price_jod_fils}" style="width:80px" class="ltr"></td>
        <td><input type="text" id="days-${p.code}" value="${p.edit_days}" style="width:60px" class="ltr"></td>
        <td><input type="text" id="var-${p.code}" value="${esc(p.ls_variant_id || '')}" style="width:110px" class="ltr"></td>
        <td><input type="checkbox" id="act-${p.code}" ${p.active ? 'checked' : ''}></td>
        <td><button class="btn sm" data-save="${p.code}">حفظ</button></td></tr>`).join('')}
    </tbody></table></div>`;

  box.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.ok || b.dataset.no) {
      b.disabled = true;
      const { error } = await sb.rpc('admin_review_manual', { p_id: b.dataset.ok || b.dataset.no, p_approve: !!b.dataset.ok });
      if (error) { toast(error.message); b.disabled = false; return; }
      toast(b.dataset.ok ? 'تمت الموافقة وتفعيل التحميل للعميل.' : 'تم الرفض.'); b.closest('tr').remove();
    }
    if (b.dataset.save) {
      const c = b.dataset.save, n = (id) => parseInt($(`#${id}-${c}`).value, 10);
      const { error } = await sb.from('packages').update({ price_usd_cents: n('usd'), price_jod_fils: n('jod'), edit_days: n('days'), ls_variant_id: $(`#var-${c}`).value.trim() || null, active: $(`#act-${c}`).checked }).eq('code', c);
      toast(error ? error.message : 'تم الحفظ.');
    }
  });
}
boot();
