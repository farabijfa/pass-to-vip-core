/* config/supabase.js */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // MUST use Service Role key for backend logic

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase URL or Service Key in .env file');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false // We don't need session persistence for a backend service
  }
});

module.exports = supabase;