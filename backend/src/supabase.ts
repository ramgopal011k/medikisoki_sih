import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const defaultUrl = 'https://ttjjhazurqydtksemdkk.supabase.co';
const supabaseUrl = process.env.SUPABASE_URL || defaultUrl;

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Critical Security Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required.');
}

const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabase = createClient(supabaseUrl, supabaseServiceKey);

