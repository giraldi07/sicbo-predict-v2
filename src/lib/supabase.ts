
import { createClient } from '@supabase/supabase-js';

// Gunakan Environment Variables untuk keamanan.
// NEXT_PUBLIC_ agar bisa diakses di sisi browser.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sxatydvrzqlrjdbutirz.supabase.co';
// Gunakan fallback 'MISSING' agar createClient tidak melempar error fatal saat inisialisasi
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'MISSING_KEY';

if (supabaseKey === 'MISSING_KEY') {
  console.warn("PERINGATAN: NEXT_PUBLIC_SUPABASE_ANON_KEY tidak ditemukan di Environment Variables.");
}

export const supabase = createClient(supabaseUrl, supabaseKey);
