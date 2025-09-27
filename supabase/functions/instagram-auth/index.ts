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
    const redirectUri = `${url.origin}/functions/v1/instagram-callback`;
    
    // Generate state parameter for security
    const state = `${userId}_${crypto.randomUUID()}`;
    
    // Facebook Login OAuth URL with Instagram Graph API permissions
    const facebookAuthUrl = new URL('https://www.facebook.com/v18.0/dialog/oauth');
    facebookAuthUrl.searchParams.set('client_id', metaAppId!);
    facebookAuthUrl.searchParams.set('redirect_uri', redirectUri);
    facebookAuthUrl.searchParams.set('scope', 'pages_show_list,pages_read_engagement,instagram_basic,instagram_manage_messages,pages_manage_metadata');
    facebookAuthUrl.searchParams.set('response_type', 'code');
    facebookAuthUrl.searchParams.set('state', state);

    console.log('Redirecting to Facebook OAuth for Instagram Graph API access, user:', userId);

    // Redirect to Facebook OAuth for Instagram Graph API access
    return Response.redirect(facebookAuthUrl.toString(), 302);
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