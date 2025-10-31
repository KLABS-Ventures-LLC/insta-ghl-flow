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
    const { userId } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Initialize Supabase client with service role key to bypass RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Get user's GHL integration
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('api_key')
      .eq('user_id', userId)
      .eq('platform', 'gohighlevel')
      .eq('is_active', true)
      .single();

    if (integrationError || !integration) {
      console.log('Integration error:', integrationError);
      return new Response(
        JSON.stringify({ error: 'GoHighLevel integration not found' }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Fetch pipelines from GHL API
    const ghlResponse = await fetch('https://rest.gohighlevel.com/v1/pipelines/', {
      headers: {
        'Authorization': `Bearer ${integration.api_key}`,
        'Content-Type': 'application/json'
      }
    });

    if (!ghlResponse.ok) {
      console.log('GHL API error:', ghlResponse.status, await ghlResponse.text());
      return new Response(
        JSON.stringify({ error: 'Failed to fetch pipelines from GoHighLevel' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const ghlData = await ghlResponse.json();
    console.log('GHL pipelines fetched successfully:', ghlData.pipelines?.length || 0);

    return new Response(
      JSON.stringify({ 
        pipelines: ghlData.pipelines || [],
        success: true 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in get-ghl-pipelines function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});