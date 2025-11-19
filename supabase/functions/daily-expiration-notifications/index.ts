// Supabase Edge Function: Daily Expiration Notifications
// Calls database function to create notifications at 9am daily
// Deployed to: https://YOUR_PROJECT.supabase.co/functions/v1/daily-expiration-notifications

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    // CORS headers
    if (req.method === 'OPTIONS') {
      return new Response('ok', {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'authorization, content-type',
        },
      })
    }

    // Create Supabase client with service role (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase credentials')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('🔔 Running daily expiration notification check...')

    // Call the database function
    const { data, error } = await supabase.rpc('check_and_create_daily_expiration_notifications')

    if (error) {
      console.error('❌ Error:', error)
      throw error
    }

    const result = data[0] || { notifications_created: 0, users_processed: 0, items_checked: 0 }

    console.log('✅ Notifications created:', result.notifications_created)
    console.log('   Users processed:', result.users_processed)
    console.log('   Items checked:', result.items_checked)

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        notifications_created: result.notifications_created,
        users_processed: result.users_processed,
        items_checked: result.items_checked,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  } catch (error) {
    console.error('❌ Function error:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  }
})
