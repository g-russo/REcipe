// @ts-nocheck - Deno runtime types not available in local VS Code
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface NotificationRequest {
  title: string;
  body: string;
  data?: Record<string, any>;
  userIds?: string[]; // Specific users (optional)
  sendToAll?: boolean; // Send to all active users (optional)
}

serve(async (req) => {
  try {
    console.log('📬 Starting notification send...');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('PROJECT_URL') ?? '';
    const supabaseKey = Deno.env.get('SERVICE_ROLE_KEY') ?? '';
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing PROJECT_URL or SERVICE_ROLE_KEY environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body
    const { title, body, data, userIds, sendToAll }: NotificationRequest = await req.json();

    if (!title || !body) {
      return new Response(
        JSON.stringify({ error: 'Title and body are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📤 Notification: "${title}" - "${body}"`);

    // Get push tokens based on criteria
    let query = supabase
      .from('user_push_tokens')
      .select('push_token, user_id, device_type')
      .eq('is_active', true);

    if (userIds && userIds.length > 0 && !sendToAll) {
      query = query.in('user_id', userIds);
      console.log(`🎯 Targeting ${userIds.length} specific users`);
    } else {
      console.log('📢 Sending to all active users');
    }

    const { data: tokens, error: tokenError } = await query;

    if (tokenError) {
      throw tokenError;
    }

    if (!tokens || tokens.length === 0) {
      console.log('⚠️ No active push tokens found');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No active push tokens found',
          sent: 0 
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📤 Sending to ${tokens.length} devices...`);

    // Prepare Expo push messages
    const messages = tokens.map(token => ({
      to: token.push_token,
      sound: 'default',
      title,
      body,
      data: {
        ...data,
        userId: token.user_id,
      },
      priority: 'high' as const,
      channelId: 'default',
    }));

    // Send notifications in batches (Expo allows max 100 per request)
    const batchSize = 100;
    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(batch),
      });

      const result = await response.json();
      results.push(result);

      // Count successes and errors
      if (result.data) {
        result.data.forEach((item: any) => {
          if (item.status === 'ok') {
            successCount++;
          } else {
            errorCount++;
            console.error('❌ Push notification error:', item);
          }
        });
      }
    }

    console.log(`✅ Notifications sent: ${successCount} success, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        errors: errorCount,
        total: tokens.length,
        results,
        message: `Notifications sent to ${successCount}/${tokens.length} devices`,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error sending notifications:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/send-notifications' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
