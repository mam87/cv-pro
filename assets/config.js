// Public browser config. ONLY public values here (anon key is safe to expose; RLS protects data).
// Leave SUPABASE_URL empty to run the site in demo mode (no login, no payments).
export const CONFIG = {
  SUPABASE_URL: '',            // https://xxxx.supabase.co
  SUPABASE_ANON_KEY: '',       // Project Settings → API → anon public
  API_BASE: '',                // '' when the site and /api are on the same Vercel domain
  CLIQ_ALIAS: 'CVPRO',         // your CliQ alias shown to customers
  CLIQ_BANK: 'اسم البنك',
  SUPPORT_WHATSAPP: '+962 7X XXX XXXX',
};
