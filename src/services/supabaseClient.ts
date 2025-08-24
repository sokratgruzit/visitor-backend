import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!; // service_role key из Legacy API Keys

export const supabase = createClient(supabaseUrl, supabaseKey);
