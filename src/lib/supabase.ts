
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://sxatydvrzqlrjdbutirz.supabase.co';
// PERHATIAN: Gunakan "anon" "public" key (dimulai dengan eyJ...), BUKAN "service_role" atau "secret" key.
// Anda bisa menemukannya di Supabase Dashboard > Settings > API.
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4YXR5ZHZyenFscmpkYnV0aXJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4MzMxMTMsImV4cCI6MjA4NzQwOTExM30.S7zPEbF85rAJ2rrJOi7moCtI7UOe3gyXX7kOMu-5bfU';

export const supabase = createClient(supabaseUrl, supabaseKey);
