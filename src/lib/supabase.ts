import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://aztmthbcqcxweaveeuus.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6dG10aGJjcWN4d2VhdmVldXVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNTc0MTAsImV4cCI6MjA4OTgzMzQxMH0.-tv9Su5irkKpsHDWWYGj8HHjKDHY3oGZvi-Q9bP10yE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
