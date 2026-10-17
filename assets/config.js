// Public browser config. ONLY public values here (anon key is safe to expose; RLS protects data).
// Leave SUPABASE_URL empty to run the site in demo mode (no login, no payments).
export const CONFIG = {
  SUPABASE_URL: 'https://ghxnmnydeuvnrsulywbj.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoeG5tbnlkZXV2bnJzdWx5d2JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyMzUzMzQsImV4cCI6MjEwNzgxMTMzNH0.fMuLGhfEglUlUHY9RJz3jizvhP0pyMO9YIo5rLg3XiI', // public anon key (safe; RLS protects data)
  API_BASE: '',                // '' when the site and /api are on the same Vercel domain
  CLIQ_ALIAS: 'CVPRO',         // your CliQ alias shown to customers
  CLIQ_BANK: 'اسم البنك',
  SUPPORT_WHATSAPP: '+962 7X XXX XXXX',
};
