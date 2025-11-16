import envConfig from '../config/env-config';

export const logEnvironmentVariables = () => {
  console.log('=== Environment Variables Debug ===');
  console.log('SUPABASE_URL:', envConfig.SUPABASE_URL ? '✓ Loaded' : '✗ Missing');
  console.log('SUPABASE_ANON_KEY:', envConfig.SUPABASE_ANON_KEY ? '✓ Loaded' : '✗ Missing');
  console.log('EDAMAM_APP_ID:', envConfig.EDAMAM_APP_ID ? '✓ Loaded' : '✗ Missing');
  console.log('EDAMAM_APP_KEY:', envConfig.EDAMAM_APP_KEY ? '✓ Loaded' : '✗ Missing');
  console.log('FOOD_API_URL:', envConfig.FOOD_API_URL);
  console.log('APP_ENV:', envConfig.APP_ENV);
  console.log('FATSECRET_CLIENT_ID:', envConfig.FATSECRET_CLIENT_ID ? '✓ Loaded' : '✗ Missing');
  console.log('=====================================');
};