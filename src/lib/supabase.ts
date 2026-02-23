
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://sxatydvrzqlrjdbutirz.supabase.co';
const supabaseKey = 'sb_secret_b72kYvpPB9banyo6ThylMg_UKGAX6GY';

export const supabase = createClient(supabaseUrl, supabaseKey);
