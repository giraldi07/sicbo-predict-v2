
import { createClient } from '@supabase/supabase-js';

// Menggunakan Environment Variables untuk keamanan total.
// Variabel NEXT_PUBLIC_ memungkinkan akses di sisi browser tanpa membocorkan Secret Key.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Inisialisasi client. Jika key kosong, client akan dibuat dengan string kosong 
// agar aplikasi tidak crash seketika, namun error akan ditangani di UI.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseKey || 'missing-key'
);
