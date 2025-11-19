// ===========================================
// SUPABASE EDGE FUNCTION: Daily Scheduled Recipe Notifications
// Checks for scheduled recipes and creates notifications
// Called by cron-job.org daily at 9am
// ===========================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('📅 Daily Scheduled Recipe Notifications - Starting...')

    // Create Supabase client with service role key (bypasses RLS)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Call the SQL function
    const { data, error } = await supabaseClient.rpc(
      'check_and_create_daily_scheduled_recipe_notifications'
    )

    if (error) {
      console.error('❌ Error calling function:', error)
      throw error
    }

    console.log('✅ Function completed:', data)

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        notifications_created: data[0]?.notifications_created || 0,
        users_processed: data[0]?.users_processed || 0,
        recipes_checked: data[0]?.recipes_checked || 0
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('❌ Error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})
