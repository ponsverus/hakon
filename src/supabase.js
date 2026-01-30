import { createClient } from '@supabase/supabase-js';

// Variáveis de ambiente (Vite)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validação defensiva (evita build quebrado silencioso)
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase ENV não configurada corretamente.\n' +
    'Verifique na Vercel:\n' +
    '- VITE_SUPABASE_URL\n' +
    '- VITE_SUPABASE_ANON_KEY'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
