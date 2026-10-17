// Example CVs used for "fill with example" and for tests.
export const SAMPLE_AR = {
  lang: 'ar', template: 'modern', accent: '#1d4e89',
  personal: { fullName: 'سارة أحمد الخطيب', title: 'أخصائية مختبرات طبية أولى', email: 'sara.khatib@gmail.com', phone: '+962 79 123 4567', location: 'عمّان، الأردن', linkedin: 'linkedin.com/in/sara-khatib', website: '', nationality: 'أردنية', license: 'JMLA-2015-0457', photo: '' },
  summary: 'أخصائية مختبرات طبية بخبرة 9 سنوات في الكيمياء السريرية وأمراض الدم داخل مستشفى تعليمي يستقبل أكثر من 1,200 عينة يومياً. قُدت تطبيق متطلبات ISO 15189 حتى حصل المختبر على الاعتماد، وخفّضت زمن تسليم النتائج الطارئة بنسبة 35%. أبحث عن دور إشرافي في مختبر معتمد يركّز على الجودة وسلامة المرضى.',
  experience: [
    { role: 'أخصائية مختبرات أولى — الكيمياء السريرية', company: 'مستشفى الجامعة', location: 'عمّان', start: '2019', end: '', current: true, bullets: 'قُدت فريقاً من 6 فنيين لتشغيل خط الكيمياء الآلي بطاقة 1,200 عينة يومياً\nخفّضت زمن تسليم نتائج الطوارئ من 62 إلى 40 دقيقة عبر إعادة تصميم مسار العينات\nأعددت 40+ إجراء تشغيل قياسي ضمن ملف اعتماد ISO 15189 الناجح عام 2023\nطبّقت قواعد Westgard للرقابة الداخلية وخفّضت حالات رفض التشغيل بنسبة 28%' },
    { role: 'أخصائية مختبرات', company: 'مختبرات الشفاء التخصصية', location: 'إربد', start: '2016', end: '2019', current: false, bullets: 'نفّذت 150+ فحصاً يومياً في أمراض الدم والتخثر\nدرّبت 12 طالب امتياز على السلامة الحيوية وضبط الجودة' },
  ],
  education: [
    { degree: 'ماجستير تحاليل طبية', school: 'جامعة البلقاء التطبيقية', location: '', start: '2018', end: '2020', details: '' },
    { degree: 'بكالوريوس علوم مختبرات طبية', school: 'الجامعة الأردنية', location: '', start: '2011', end: '2015', details: 'تقدير جيد جداً' },
  ],
  skills: ['ISO 15189:2022', 'الكيمياء السريرية', 'أمراض الدم', 'قواعد Westgard', 'نظام LIS', 'التدقيق الداخلي', 'السلامة الحيوية', 'قيادة الفرق'],
  certifications: [{ name: 'مدقق داخلي ISO 15189', issuer: 'جهة تدريب معتمدة', year: '2022' }, { name: 'ترخيص مزاولة المهنة', issuer: 'وزارة الصحة الأردنية', year: '2015' }],
  languages: [{ name: 'العربية', level: 'اللغة الأم' }, { name: 'الإنجليزية', level: 'متقدّم' }],
  publications: [],
  references: 'available',
};

export const SAMPLE_EN = {
  lang: 'en', template: 'classic', accent: '#0f5f5c',
  personal: { fullName: 'Omar Haddad', title: 'Senior Software Engineer', email: 'omar.haddad@gmail.com', phone: '+962 78 555 0101', location: 'Amman, Jordan', linkedin: 'linkedin.com/in/omarhaddad', website: 'omarhaddad.dev', nationality: '', license: '', photo: '' },
  summary: 'Senior software engineer with 8 years building payment and logistics platforms used by 2M+ customers across the GCC. Led the migration of a monolith to services that cut infrastructure cost by 30% and incident volume by half. Looking to lead a product engineering team in a fast-growing fintech.',
  experience: [
    { role: 'Senior Software Engineer', company: 'Aramex', location: 'Amman', start: '2021', end: '', current: true, bullets: 'Led a team of 5 engineers delivering a shipment-tracking API handling 40M requests/day\nReduced cloud spend by 30% ($420K/yr) by consolidating services and right-sizing clusters\nIntroduced contract testing, cutting production incidents by 52% in 12 months' },
    { role: 'Software Engineer', company: 'Fawry', location: 'Cairo', start: '2017', end: '2021', current: false, bullets: 'Built bill-payment integrations with 30+ billers in Node.js and PostgreSQL\nAutomated reconciliation jobs, saving the finance team 60 hours per month' },
  ],
  education: [{ degree: 'B.Sc. Computer Science', school: 'University of Jordan', location: '', start: '2013', end: '2017', details: 'GPA 3.6/4.0' }],
  skills: ['Node.js', 'TypeScript', 'PostgreSQL', 'AWS', 'System Design', 'Kubernetes', 'CI/CD', 'Team Leadership'],
  certifications: [{ name: 'AWS Solutions Architect – Associate', issuer: 'Amazon Web Services', year: '2022' }],
  languages: [{ name: 'Arabic', level: 'Native' }, { name: 'English', level: 'Fluent' }],
  publications: [],
  references: 'available',
};
