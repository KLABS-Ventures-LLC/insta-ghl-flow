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
    const { message, userId, opportunityId } = await req.json();

    if (!message || !userId) {
      return new Response(
        JSON.stringify({ error: 'Message and userId are required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user's active automations
    const { data: automations, error: automationError } = await supabase
      .from('automations')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (automationError || !automations || automations.length === 0) {
      console.log('No active automations found for user:', userId);
      return new Response(
        JSON.stringify({ message: 'No active automations found' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Check if outbound message contains any keywords from automations
    const messageText = message.toLowerCase();
    let matchedAutomation = null;

    for (const automation of automations) {
      const hasKeyword = automation.keywords.some((keyword: string) => 
        messageText.includes(keyword.toLowerCase())
      );
      
      if (hasKeyword) {
        matchedAutomation = automation;
        break;
      }
    }

    if (!matchedAutomation) {
      console.log('No matching keywords found in outbound message');
      return new Response(
        JSON.stringify({ message: 'No matching keywords found in outbound message' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get user's GHL integration
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('api_key')
      .eq('user_id', userId)
      .eq('platform', 'gohighlevel')
      .eq('is_active', true)
      .single();

    if (integrationError || !integration) {
      console.log('GHL integration not found for user:', userId);
      return new Response(
        JSON.stringify({ error: 'GoHighLevel integration not found' }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Move opportunity to the specified stage in GHL
    if (opportunityId) {
      const moveResponse = await fetch(`https://rest.gohighlevel.com/v1/pipelines/${matchedAutomation.ghl_pipeline_id}/opportunities/${opportunityId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${integration.api_key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          stageId: matchedAutomation.ghl_stage_id
        })
      });

      if (!moveResponse.ok) {
        console.log('Failed to move opportunity in GHL:', moveResponse.status);
        return new Response(
          JSON.stringify({ error: 'Failed to move opportunity in GoHighLevel' }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      console.log(`Opportunity ${opportunityId} moved to stage ${matchedAutomation.ghl_stage_id} via outbound message automation: ${matchedAutomation.name}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        automationTriggered: matchedAutomation.name,
        pipelineId: matchedAutomation.ghl_pipeline_id,
        stageId: matchedAutomation.ghl_stage_id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in process-instagram-message function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});