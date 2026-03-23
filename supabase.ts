import { createClient } from '@supabase/supabase-js';

// SUPABASE CLIENT - connects app to cloud database
const supabaseUrl = 'https://gvozqzpfwtwpkofgrdit.supabase.co';
const supabaseAnonKey = 'sb_publishable_eYs9qBkMaNXC8RhQUXWG6A_onmBfLo5';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);