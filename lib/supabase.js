import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'

// ✅ FIXED: Read from Constants.expoConfig.extra for production APK
const extra = Constants.expoConfig?.extra || {};

const supabaseUrl = extra.supabaseUrl || 'https://dymujerduwloeeurcqso.supabase.co'
const supabaseAnonKey = extra.supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5bXVqZXJkdXdsb2VldXJjcXNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxNjUyODgsImV4cCI6MjA3MDc0MTI4OH0.etUXqhniwaReVAw1x9GsoMkyRlt1h9k6pzTNxjuEOsc'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

// Safe helper to call supabase.auth.getUser() without throwing on invalid refresh tokens
export async function safeGetUser() {
  try {
    return await supabase.auth.getUser();
  } catch (e) {
    console.error('⚠️ supabase.auth.getUser threw an error:', e?.name || e, e?.message || e);

    // If the stored refresh token is invalid or missing, attempt to clear local session and sign out
    const msg = (e && e.message) ? e.message.toLowerCase() : '';
    if (e?.name === 'AuthApiError' || msg.includes('invalid refresh token') || msg.includes('refresh token not found')) {
      try {
        console.log('🔐 Clearing Supabase local session due to invalid refresh token')
        await supabase.auth.signOut();
      } catch (so) {
        console.warn('⚠️ Error while signing out during safeGetUser cleanup:', so);
      }

      // Try to remove common AsyncStorage keys Supabase might use
      try { await AsyncStorage.removeItem('supabase.auth.token'); } catch (_) { }
      try { await AsyncStorage.removeItem('@supabase/auth-token'); } catch (_) { }
      try { await AsyncStorage.removeItem('supabase.auth'); } catch (_) { }
    }

    return { data: { user: null }, error: e };
  }
}
