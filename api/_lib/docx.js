// Build an editable, ATS-friendly Word file (Arabic RTL or English LTR) from CV JSON.
import { Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle, TabStopType, LevelFormat } from 'docx';
import { LABELS } from '../../shared/templates.js';

const bl = (t) => String(t || '').split('\n').map((s) => s.replace(/^\s*[-•*]\s*/, '').trim()).filter(Boolean);
const has = (v) => !!String(v ?? '').trim();

export async function buildDocx(cvIn) {
  const cv = cvIn || {};
  const rtl = cv.lang !== 'en';
  const L = LABELS[rtl ? 'ar' : 'en'];
  const accent = (/^#[0-9a-f]{6}$/i.test(cv.accent || '') ? cv.accent : '#1d4e89').slice(1);
  const font = rtl ? 'Arial' : 'Calibri';           // installed on every Windows/Mac/Office → no font substitution
  const p = cv.personal || {};
  const align = rtl ? AlignmentType.RIGHT : AlignmentType.LEFT;

  const run = (text, o = {}) => new TextRun({ text: String(text ?? ''), font, rightToLeft: rtl, size: 21, ...o });
  const para = (children, o = {}) => new Paragraph({ children, bidirectional: rtl, alignment: align, spacing: { after: 60 }, ...o });
  const heading = (t) => para([run(t, { bold: true, size: 24, color: accent })], {
    spacing: { before: 240, after: 100 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: accent, space: 2 } },
  });
  // Right-aligned dates via a tab stop at the far edge (works for RTL and LTR).
  const roleLine = (title, dates) => new Paragraph({
    bidirectional: rtl, alignment: align, spacing: { before: 120, after: 20 },
    tabStops: [{ type: TabStopType.RIGHT, position: 9600 }],
    children: [run(title, { bold: true, size: 22 }), ...(dates ? [run('\t'), run(dates, { color: '6B7280', size: 19 })] : [])],
  });
  const dates = (a, b, cur) => { const e = cur ? L.present : b; return [a, e].filter(has).join(' – '); };

  const out = [];
  out.push(para([run(p.fullName || '', { bold: true, size: 44 })], { spacing: { after: 40 } }));
  if (has(p.title)) out.push(para([run(p.title, { size: 26, color: accent, bold: true })]));
  const contact = [p.email, p.phone, p.location, p.linkedin, p.website].filter(has).join('  |  ');
  if (contact) out.push(para([run(contact, { size: 19, color: '4B5563' })]));
  const meta = [has(p.nationality) ? `${L.nationality}: ${p.nationality}` : '', has(p.license) ? `${L.license}: ${p.license}` : ''].filter(Boolean).join('  |  ');
  if (meta) out.push(para([run(meta, { size: 19, color: '4B5563' })]));

  if (has(cv.summary)) { out.push(heading(L.summary)); out.push(para([run(cv.summary)], { alignment: rtl ? AlignmentType.RIGHT : AlignmentType.JUSTIFIED })); }

  const exp = (cv.experience || []).filter((e) => has(e.role) || has(e.company));
  if (exp.length) {
    out.push(heading(L.experience));
    for (const e of exp) {
      out.push(roleLine(e.role, dates(e.start, e.end, e.current)));
      out.push(para([run([e.company, e.location].filter(has).join(' · '), { color: '4B5563', italics: !rtl })]));
      for (const b of bl(e.bullets)) out.push(new Paragraph({ children: [run(b)], bidirectional: rtl, alignment: align, numbering: { reference: 'bul', level: 0 }, spacing: { after: 30 } }));
    }
  }
  const edu = (cv.education || []).filter((e) => has(e.degree) || has(e.school));
  if (edu.length) {
    out.push(heading(L.education));
    for (const e of edu) {
      out.push(roleLine(e.degree, dates(e.start, e.end)));
      out.push(para([run([e.school, e.location].filter(has).join(' · '), { color: '4B5563' })]));
      if (has(e.details)) out.push(para([run(e.details, { size: 19 })]));
    }
  }
  const sk = (cv.skills || []).filter(has);
  if (sk.length) { out.push(heading(L.skills)); out.push(para([run(sk.join(' • '))])); }
  const certs = (cv.certifications || []).filter((c) => has(c.name));
  if (certs.length) { out.push(heading(L.certifications)); for (const c of certs) out.push(para([run(c.name, { bold: true }), run([c.issuer, c.year].filter(has).length ? ' — ' + [c.issuer, c.year].filter(has).join(', ') : '')])); }
  const pubs = (cv.publications || []).filter((c) => has(c.title));
  if (pubs.length) { out.push(heading(L.publications)); for (const c of pubs) out.push(para([run(c.title), ...(has(c.venue) ? [run('. '), run(c.venue, { italics: true })] : []), run(has(c.year) ? ` (${c.year})` : '')])); }
  const langs = (cv.languages || []).filter((c) => has(c.name));
  if (langs.length) { out.push(heading(L.languages)); out.push(para([run(langs.map((l) => (has(l.level) ? `${l.name} — ${l.level}` : l.name)).join('   |   '))])); }
  if (cv.references === 'available') { out.push(heading(L.references)); out.push(para([run(L.referencesAvailable)])); }
  else if (has(cv.references)) { out.push(heading(L.references)); for (const line of String(cv.references).split('\n')) out.push(para([run(line)])); }

  const doc = new Document({
    creator: 'CV Pro', title: `${p.fullName || 'CV'}`,
    styles: { default: { document: { run: { font, size: 21 } } } },
    numbering: { config: [{ reference: 'bul', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: align, style: { paragraph: { indent: rtl ? { right: 360, hanging: 260 } : { left: 360, hanging: 260 } } } }] }] },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } } }, children: out }],
  });
  return Packer.toBuffer(doc);
}
