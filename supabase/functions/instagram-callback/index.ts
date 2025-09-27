import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error) {
      console.log('Instagram OAuth error:', error);
      return new Response(
        `<html><body><script>window.close();</script><p>Authentication failed: ${error}</p></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    if (!code || !state) {
      return new Response(
        '<html><body><script>window.close();</script><p>Missing authorization code or state</p></body></html>',
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Extract user ID from state
    const userId = state.split('_')[0];
    
    const metaAppId = Deno.env.get('META_APP_ID');
    const metaAppSecret = Deno.env.get('META_APP_SECRET');
    const redirectUri = `${url.origin}/functions/v1/instagram-callback`;

    // Exchange code for access token via Facebook Graph API
    const tokenResponse = await fetch('https://graph.facebook.com/v18.0/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: metaAppId!,
        client_secret: metaAppSecret!,
        redirect_uri: redirectUri,
        code: code,
      }),
    });

    if (!tokenResponse.ok) {
      console.log('Token exchange failed:', tokenResponse.status, await tokenResponse.text());
      return new Response(
        '<html><body><script>window.close();</script><p>Failed to exchange authorization code</p></body></html>',
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Get user's Facebook pages (which include Instagram Business accounts)
    const pagesResponse = await fetch(
      `https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}`
    );

    let instagramAccountId = null;
    let instagramUsername = 'Business Account';

    if (pagesResponse.ok) {
      const pagesData = await pagesResponse.json();
      
      // Find Instagram Business account connected to pages
      for (const page of pagesData.data || []) {
        const igResponse = await fetch(
          `https://graph.facebook.com/v18.0/${page.id}?fields=instagram_business_account&access_token=${accessToken}`
        );
        
        if (igResponse.ok) {
          const igData = await igResponse.json();
          if (igData.instagram_business_account) {
            instagramAccountId = igData.instagram_business_account.id;
            
            // Get Instagram account info
            const igInfoResponse = await fetch(
              `https://graph.facebook.com/v18.0/${instagramAccountId}?fields=username&access_token=${accessToken}`
            );
            
            if (igInfoResponse.ok) {
              const igInfo = await igInfoResponse.json();
              instagramUsername = igInfo.username || 'Business Account';
            }
            break;
          }
        }
      }
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Store integration in database
    const { error: dbError } = await supabase
      .from('integrations')
      .upsert({
        user_id: userId,
        platform: 'instagram',
        access_token: accessToken,
        refresh_token: instagramAccountId,
        expires_at: null, // Facebook tokens don't expire like Instagram Basic Display
        is_active: true
      }, {
        onConflict: 'user_id,platform'
      });

    if (dbError) {
      console.error('Database error:', dbError);
      return new Response(
        '<html><body><script>window.close();</script><p>Failed to save integration</p></body></html>',
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    console.log(`Instagram Graph API integration successful for user ${userId} with account ${instagramUsername}`);

    return new Response(
      `<html><body><script>
        window.opener?.postMessage({ type: 'INSTAGRAM_AUTH_SUCCESS', username: '${instagramUsername}' }, '*');
        window.close();
      </script><p>Instagram Business Account connected successfully! You can close this window.</p></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  } catch (error) {
    console.error('Error in instagram-callback function:', error);
    return new Response(
      '<html><body><script>window.close();</script><p>Authentication failed</p></body></html>',
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
});