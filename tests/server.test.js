import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verifyLemonSignature, generationDecision } from '../api/_lib/server.js';
import { buildDocx } from '../api/_lib/docx.js';
import { renderCV } from '../shared/templates.js';
import { checkCV } from '../shared/ats.js';
import { SAMPLE_AR, SAMPLE_EN } from '../shared/samples.js';

const secret = 'whsec_test_123';
const body = Buffer.from(JSON.stringify({ meta: { event_name: 'order_created' } }));
const sign = (b, s = secret) => crypto.createHmac('sha256', s).update(b).digest('hex');

test('webhook: valid signature accepted', () => assert.equal(verifyLemonSignature(body, sign(body), secret), true));
test('webhook: forged signature rejected', () => assert.equal(verifyLemonSignature(body, sign(body, 'wrong'), secret), false));
test('webhook: tampered body rejected', () => assert.equal(verifyLemonSignature(Buffer.from(body.toString().replace('created', 'refunded')), sign(body), secret), false));
test('webhook: missing signature rejected', () => assert.equal(verifyLemonSignature(body, undefined, secret), false));

const pro = { formats: ['pdf', 'docx'] };
const basic = { formats: ['pdf'] };
const future = new Date(Date.now() + 86400e3).toISOString();
const past = new Date(Date.now() - 1000).toISOString();
const order = (o = {}) => ({ status: 'paid', unlock_until: future, gen_count: 0, locked_name: null, ...o });

test('gen: no order → not_paid', () => assert.equal(generationDecision({ order: null, pkg: pro, format: 'pdf' }).code, 'not_paid'));
test('gen: refunded → not_paid', () => assert.equal(generationDecision({ order: order({ status: 'refunded' }), pkg: pro, format: 'pdf' }).code, 'not_paid'));
test('gen: basic cannot get docx', () => assert.equal(generationDecision({ order: order(), pkg: basic, format: 'docx' }).code, 'format_not_in_package'));
test('gen: window closed', () => assert.equal(generationDecision({ order: order({ unlock_until: past }), pkg: pro, format: 'pdf' }).code, 'edit_window_closed'));
test('gen: name swap blocked', () => assert.equal(generationDecision({ order: order({ locked_name: 'سارة أحمد' }), pkg: pro, format: 'pdf', cvName: 'Ali Hasan' }).code, 'name_changed'));
test('gen: same name with diacritics/spacing allowed', () => assert.equal(generationDecision({ order: order({ locked_name: 'سارة  أحمد' }), pkg: pro, format: 'pdf', cvName: 'سارَة أحمد' }).ok, true));
test('gen: paid pro pdf ok', () => assert.equal(generationDecision({ order: order(), pkg: pro, format: 'pdf', cvName: 'x' }).ok, true));

test('render: escapes HTML injection', () => {
  const h = renderCV({ ...SAMPLE_EN, personal: { ...SAMPLE_EN.personal, fullName: '<script>alert(1)</script>' } });
  assert.ok(!h.includes('<script>alert'));
});
test('render: rejects non-image photo URLs', () => {
  const h = renderCV({ ...SAMPLE_EN, template: 'modern', personal: { ...SAMPLE_EN.personal, photo: 'javascript:alert(1)' } });
  assert.ok(!h.includes('javascript:'));
});
test('render: watermark only in preview', () => {
  assert.ok(renderCV(SAMPLE_AR, { watermark: true }).includes('class="wm"'));
  assert.ok(!renderCV(SAMPLE_AR).includes('class="wm"'));
});
test('ats: sample CVs score high, empty CV low', () => {
  assert.ok(checkCV(SAMPLE_AR).score >= 90);
  assert.ok(checkCV(SAMPLE_EN).score >= 90);
  assert.ok(checkCV({ lang: 'ar', personal: {} }).score < 15);
});
test('docx: builds Arabic and English files', async () => {
  for (const s of [SAMPLE_AR, SAMPLE_EN]) {
    const buf = await buildDocx(s);
    assert.ok(buf.length > 5000);
    assert.equal(buf.subarray(0, 2).toString(), 'PK');
  }
});
