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
    const userId = url.searchParams.get('userId');
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const metaAppId = Deno.env.get('META_APP_ID');
    const redirectUri = `${url.origin}/api/instagram-callback`;
    
    // Generate state parameter for security
    const state = `${userId}_${crypto.randomUUID()}`;
    
    // Instagram OAuth URL with required permissions
    const instagramAuthUrl = new URL('https://api.instagram.com/oauth/authorize');
    instagramAuthUrl.searchParams.set('client_id', metaAppId!);
    instagramAuthUrl.searchParams.set('redirect_uri', redirectUri);
    instagramAuthUrl.searchParams.set('scope', 'user_profile,user_media,instagram_basic,pages_read_engagement,instagram_manage_messages');
    instagramAuthUrl.searchParams.set('response_type', 'code');
    instagramAuthUrl.searchParams.set('state', state);

    console.log('Instagram OAuth URL generated for user:', userId);

    return new Response(
      JSON.stringify({ 
        authUrl: instagramAuthUrl.toString(),
        state: state
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in instagram-auth function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});