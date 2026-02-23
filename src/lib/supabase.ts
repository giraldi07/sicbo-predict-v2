
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://sxatydvrzqlrjdbutirz.supabase.co';
// PERHATIAN: Gunakan "anon" "public" key (dimulai dengan eyJ...), BUKAN "service_role" atau "secret" key.
// Anda bisa menemukannya di Supabase Dashboard > Settings > API.
const supabaseKey = 'GANTI_DENGAN_ANON_PUBLIC_KEY_ANDA';

export const supabase = createClient(supabaseUrl, supabaseKey);
