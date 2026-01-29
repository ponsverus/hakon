import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || 'https://rgzkcrqqjolkxmlevlnf.supabase.co';

const supabaseKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnemtjcnFxam9sa3htbGV2bG5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1MTcxNjEsImV4cCI6MjA4NTA5MzE2MX0.rL03O-nDWiNU3kSPC3u_kiyfuj1B95arVEx4_O5LNxQ';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
