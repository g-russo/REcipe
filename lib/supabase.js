import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import Constants from 'expo-constants'

// ✅ FIXED: Read from Constants.expoConfig.extra for production APK
const extra = Constants.expoConfig?.extra || {};

const supabaseUrl = extra.supabaseUrl || 'https://dymujerduwloeeurcqso.supabase.co'
const supabaseAnonKey = extra.supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5bXVqZXJkdXdsb2VldXJjcXNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxNjUyODgsImV4cCI6MjA3MDc0MTI4OH0.etUXqhniwaReVAw1x9GsoMkyRlt1h9k6pzTNxjuEOsc'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
