import Constants from 'expo-constants';

// ✅ FIXED: Production APK reads from Constants.expoConfig.extra
const getEnvVars = () => {
  const extra = Constants.expoConfig?.extra || {};
  
  return {
    SUPABASE_URL: extra.supabaseUrl || 'https://dymujerduwloeeurcqso.supabase.co',
    SUPABASE_ANON_KEY: extra.supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5bXVqZXJkdXdsb2VldXJjcXNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxNjUyODgsImV4cCI6MjA3MDc0MTI4OH0.etUXqhniwaReVAw1x9GsoMkyRlt1h9k6pzTNxjuEOsc',
    EDAMAM_APP_ID: extra.edamamAppId || 'e6367ae7',
    EDAMAM_APP_KEY: extra.edamamAppKey || '7503bbf60dc650bc2c55409af36ba5ab',
    FOOD_API_URL: extra.foodApiUrl || 'http://54.153.205.43:8000',
    APP_ENV: extra.appEnv || 'production',
    FATSECRET_CLIENT_ID: extra.fatsecretClientId || '7546d922e502421f848438016a49c932',
    FATSECRET_CLIENT_SECRET: extra.fatsecretClientSecret || 'bdd0493313194688a49a6f1648030834',
  };
};

export default getEnvVars();