// @ts-nocheck - Deno runtime types not available in local VS Code
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const startTime = Date.now()
  
  try {
    // Create Supabase client with service role key
    const supabase = createClient(
      Deno.env.get('PROJECT_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    )

    console.log('🧹 Starting unified cache cleanup...')

    // Run cleanup function
    const { data, error } = await supabase.rpc('cleanup_expired_cache')

    if (error) {
      console.error('❌ Cleanup error:', error)
      
      // Send error notification
      await sendErrorNotification(error)
      
      throw error
    }

    // Calculate statistics
    const stats = {
      popularDeleted: data[0]?.popular_deleted || 0,
      searchDeleted: data[0]?.search_deleted || 0,
      similarDeleted: data[0]?.similar_deleted || 0,
      totalDeleted: (data[0]?.popular_deleted || 0) + 
                    (data[0]?.search_deleted || 0) + 
                    (data[0]?.similar_deleted || 0),
      executionTime: Date.now() - startTime,
      timestamp: new Date().toISOString()
    }

    console.log('✅ Cleanup completed:', stats)

    // Get current cache status
    const cacheStatus = await getCacheStatus(supabase)

    // If popular recipes cache was deleted, trigger automatic refresh
    let refreshTriggered = false
    if (stats.popularDeleted > 0) {
      console.log('🔄 Popular recipes cache was deleted, triggering automatic refresh...')
      try {
        // Trigger refresh function (non-blocking, fire-and-forget)
        const refreshUrl = `${Deno.env.get('PROJECT_URL')}/functions/v1/refresh-popular-recipes`
        const refreshHeaders = {
          'Authorization': `Bearer ${Deno.env.get('SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json'
        }
        
        // Start refresh in background (don't wait for it to complete)
        fetch(refreshUrl, { 
          method: 'POST', 
          headers: refreshHeaders 
        }).catch(err => console.error('Background refresh trigger failed:', err))
        
        refreshTriggered = true
        console.log('✅ Automatic refresh triggered (running in background, will take ~6 minutes)')
      } catch (error) {
        console.error('⚠️ Failed to trigger automatic refresh:', error)
      }
    }

    // Send notification if significant cleanup (more than 50 entries)
    if (stats.totalDeleted >= 50) {
      await sendCleanupNotification(stats, cacheStatus)
    }

    // Log to database (optional - for tracking)
    await logCleanupExecution(supabase, stats, refreshTriggered)

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        stats,
        cacheStatus,
        refreshTriggered,
        message: refreshTriggered 
          ? 'Cache cleaned and automatic refresh triggered (6 minutes)'
          : 'Unified cache cleaned successfully'
      }),
      { 
        headers: { 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    console.error('💥 Cleanup failed:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    )
  }
})

// Get current cache status
async function getCacheStatus(supabase: any) {
  try {
    const [popular, search, similar] = await Promise.all([
      supabase.from('cache_popular_recipes').select('*', { count: 'exact', head: true }),
      supabase.from('cache_search_results').select('*', { count: 'exact', head: true }),
      supabase.from('cache_similar_recipes').select('*', { count: 'exact', head: true })
    ])

    return {
      popularRecipes: popular.count || 0,
      searchResults: search.count || 0,
      similarRecipes: similar.count || 0,
      total: (popular.count || 0) + (search.count || 0) + (similar.count || 0)
    }
  } catch (error) {
    console.error('Error getting cache status:', error)
    return { error: error.message }
  }
}

// Send cleanup notification (Slack)
async function sendCleanupNotification(stats: any, cacheStatus: any) {
  const slackWebhook = Deno.env.get('SLACK_WEBHOOK_URL')
  if (!slackWebhook) {
    console.log('⚠️ Slack webhook URL not configured (optional)')
    return
  }

  try {
    const message = {
      text: '🧹 Recipe Cache Cleanup Report',
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🧹 Recipe Cache Cleanup Completed'
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Entries Deleted:*\n${stats.totalDeleted}`
            },
            {
              type: 'mrkdwn',
              text: `*Execution Time:*\n${stats.executionTime}ms`
            },
            {
              type: 'mrkdwn',
              text: `*Popular Recipes:*\n${stats.popularDeleted} deleted`
            },
            {
              type: 'mrkdwn',
              text: `*Search Results:*\n${stats.searchDeleted} deleted`
            },
            {
              type: 'mrkdwn',
              text: `*Similar Recipes:*\n${stats.similarDeleted} deleted`
            },
            {
              type: 'mrkdwn',
              text: `*Remaining Entries:*\n${cacheStatus.total}`
            }
          ]
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `✅ Completed at ${new Date(stats.timestamp).toLocaleString()}`
            }
          ]
        }
      ]
    }

    await fetch(slackWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    })

    console.log('✅ Slack notification sent')
  } catch (error) {
    console.error('❌ Failed to send Slack notification:', error)
  }
}

// Send error notification
async function sendErrorNotification(error: any) {
  const slackWebhook = Deno.env.get('SLACK_WEBHOOK_URL')
  if (!slackWebhook) return

  try {
    await fetch(slackWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `🚨 Cache Cleanup Failed: ${error.message}`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*🚨 Cache Cleanup Error*\n\`\`\`${error.message}\`\`\``
            }
          }
        ]
      })
    })
  } catch (err) {
    console.error('Failed to send error notification:', err)
  }
}

// Log cleanup execution to database (optional)
async function logCleanupExecution(supabase: any, stats: any, refreshTriggered: boolean = false) {
  try {
    // Check if cleanup_logs table exists
    const { error: tableError } = await supabase
      .from('cleanup_logs')
      .select('id')
      .limit(1)

    if (tableError) {
      console.log('⚠️ cleanup_logs table not found (optional feature)')
      return
    }

    // Insert log
    await supabase
      .from('cleanup_logs')
      .insert({
        popular_deleted: stats.popularDeleted,
        search_deleted: stats.searchDeleted,
        similar_deleted: stats.similarDeleted,
        total_deleted: stats.totalDeleted,
        execution_time_ms: stats.executionTime,
        executed_at: stats.timestamp
      })
    
    console.log('✅ Cleanup execution logged')
  } catch (error) {
    console.error('Failed to log cleanup execution:', error)
    // Don't throw - this is optional logging
  }
}
