import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Pipeline {
  id: string;
  name: string;
  stages: PipelineStage[];
}

interface PipelineStage {
  id: string;
  name: string;
  position: number;
}

const PipelineDisplay = () => {
  const { user } = useAuth();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasGHLIntegration, setHasGHLIntegration] = useState(false);

  useEffect(() => {
    if (user) {
      checkGHLIntegration();
    }
  }, [user]);

  const checkGHLIntegration = async () => {
    try {
      const { data, error } = await supabase
        .from('integrations')
        .select('*')
        .eq('user_id', user?.id)
        .eq('platform', 'gohighlevel')
        .eq('is_active', true)
        .single();

      if (data && !error) {
        setHasGHLIntegration(true);
        fetchPipelines();
      }
    } catch (error) {
      setHasGHLIntegration(false);
    }
  };

  const fetchPipelines = async () => {
    setLoading(true);
    try {
      // Call edge function to fetch pipelines from GHL
      const { data, error } = await supabase.functions.invoke('get-ghl-pipelines', {
        body: { userId: user?.id }
      });

      if (error) throw error;
      
      setPipelines(data.pipelines || []);
      toast({
        title: "Pipelines loaded",
        description: `Found ${data.pipelines?.length || 0} pipelines`
      });
    } catch (error) {
      console.error('Error fetching pipelines:', error);
      toast({
        title: "Error loading pipelines",
        description: "Could not fetch pipelines from GoHighLevel",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (!hasGHLIntegration) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-muted-foreground" />
            <span>GoHighLevel Pipelines</span>
          </CardTitle>
          <CardDescription>
            Connect your GoHighLevel account to view and manage pipelines.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Please set up your GoHighLevel integration in the Integrations tab first.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Pipelines & Stages</h2>
          <p className="text-muted-foreground">
            View your GoHighLevel pipelines and stages for automation setup.
          </p>
        </div>
        <Button 
          onClick={fetchPipelines} 
          disabled={loading}
          variant="outline"
          size="sm"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading pipelines...</p>
        </div>
      ) : pipelines.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No pipelines found.</p>
            <Button onClick={fetchPipelines} className="mt-4" variant="outline">
              Try Again
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {pipelines.map((pipeline) => (
            <Card key={pipeline.id}>
              <CardHeader>
                <CardTitle>{pipeline.name}</CardTitle>
                <CardDescription>
                  Pipeline ID: {pipeline.id}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground">Stages:</h4>
                  <div className="flex flex-wrap gap-2">
                    {pipeline.stages
                      ?.sort((a, b) => a.position - b.position)
                      .map((stage) => (
                        <Badge key={stage.id} variant="secondary">
                          {stage.name}
                        </Badge>
                      ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default PipelineDisplay;