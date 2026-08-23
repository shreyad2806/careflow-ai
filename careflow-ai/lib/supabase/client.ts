import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export function createSupabaseClient() {
  return createClient(supabaseUrl, supabaseAnonKey);
}

// Singleton for browser usage
let browserClient: ReturnType<typeof createSupabaseClient> | null = null;

export function getSupabaseBrowserClient() {
  if (typeof window === 'undefined') {
    return createSupabaseClient();
  }
  if (!browserClient) {
    browserClient = createSupabaseClient();
  }
  return browserClient;
}
