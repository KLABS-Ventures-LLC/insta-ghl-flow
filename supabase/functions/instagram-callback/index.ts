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
    const redirectUri = `${url.origin}/api/instagram-callback`;

    // Exchange code for access token
    const tokenResponse = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: metaAppId!,
        client_secret: metaAppSecret!,
        grant_type: 'authorization_code',
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

    // Get long-lived access token
    const longLivedTokenResponse = await fetch(
      `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${metaAppSecret}&access_token=${accessToken}`
    );

    let longLivedToken = accessToken;
    let expiresAt = null;

    if (longLivedTokenResponse.ok) {
      const longLivedData = await longLivedTokenResponse.json();
      longLivedToken = longLivedData.access_token;
      expiresAt = new Date(Date.now() + (longLivedData.expires_in * 1000)).toISOString();
    }

    // Get user profile info
    const profileResponse = await fetch(
      `https://graph.instagram.com/me?fields=id,username&access_token=${longLivedToken}`
    );

    let username = 'Unknown';
    if (profileResponse.ok) {
      const profileData = await profileResponse.json();
      username = profileData.username;
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
        access_token: longLivedToken,
        refresh_token: tokenData.user_id?.toString(),
        expires_at: expiresAt,
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

    console.log(`Instagram integration successful for user ${userId} with username ${username}`);

    return new Response(
      `<html><body><script>
        window.opener?.postMessage({ type: 'INSTAGRAM_AUTH_SUCCESS', username: '${username}' }, '*');
        window.close();
      </script><p>Instagram connected successfully! You can close this window.</p></body></html>`,
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