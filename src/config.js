// Supabase configuration
// Replace these with your actual Supabase project credentials
export const supabaseConfig = {
  url: 'https://xbiavlxjohoxhvabevpi.supabase.co', // Your Supabase project URL
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaWF2bHhqb2hveGh2YWJldnBpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1NTI1MzAsImV4cCI6MjA3MDEyODUzMH0.8K2ggHoa1LTwQczlKT3ehVc0TZSNumJ1-QzKAJ84RNw' // Your Supabase anon key
};

// Admin configuration
export const adminConfig = {
  password: 'admin123' // Change this to your desired admin password
};

// Environment variables for production
export const getSupabaseConfig = () => {
  // Force using the hardcoded config for now
  return {
    url: supabaseConfig.url,
    anonKey: supabaseConfig.anonKey,
    adminPassword: adminConfig.password
  };
};
