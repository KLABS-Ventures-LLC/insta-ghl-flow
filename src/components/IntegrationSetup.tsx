import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Instagram, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const ghlSchema = z.object({
  apiKey: z.string().min(1, 'API Key is required'),
});

type GHLFormData = z.infer<typeof ghlSchema>;

interface Integration {
  id: string;
  platform: string;
  is_active: boolean;
  created_at: string;
}

const IntegrationSetup = () => {
  const { user } = useAuth();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<GHLFormData>({
    resolver: zodResolver(ghlSchema),
    defaultValues: {
      apiKey: '',
    },
  });

  useEffect(() => {
    if (user) {
      fetchIntegrations();
    }
  }, [user]);

  const fetchIntegrations = async () => {
    try {
      const { data, error } = await supabase
        .from('integrations')
        .select('*')
        .eq('user_id', user?.id);

      if (error) throw error;
      setIntegrations(data || []);
    } catch (error) {
      toast({
        title: "Error fetching integrations",
        description: "Could not load your integrations",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGHLSubmit = async (data: GHLFormData) => {
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('integrations')
        .upsert({
          user_id: user?.id,
          platform: 'gohighlevel',
          api_key: data.apiKey,
          is_active: true
        }, {
          onConflict: 'user_id,platform'
        });

      if (error) throw error;

      toast({
        title: "GoHighLevel connected",
        description: "Your GHL integration has been set up successfully"
      });
      
      form.reset();
      fetchIntegrations();
    } catch (error) {
      toast({
        title: "Connection failed",
        description: "Could not connect to GoHighLevel",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const connectInstagram = async () => {
    try {
      // Get Instagram OAuth URL from edge function
      const { data, error } = await supabase.functions.invoke('instagram-auth', {
        body: {},
        method: 'GET'
      });

      if (error) throw error;

      // Open popup window for Instagram OAuth
      const popup = window.open(
        `https://idxhqaiafptdftmdjgki.supabase.co/functions/v1/instagram-auth?userId=${user?.id}`,
        'instagram-auth',
        'width=600,height=700,left=' + 
        (window.screen.width / 2 - 300) + ',top=' + 
        (window.screen.height / 2 - 350)
      );

      // Listen for successful authentication
      const handleMessage = (event: MessageEvent) => {
        if (event.data.type === 'INSTAGRAM_AUTH_SUCCESS') {
          toast({
            title: "Instagram connected",
            description: `Successfully connected Instagram account: @${event.data.username}`,
          });
          fetchIntegrations();
          window.removeEventListener('message', handleMessage);
        }
      };

      window.addEventListener('message', handleMessage);

      // Check if popup was closed without completion
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', handleMessage);
        }
      }, 1000);

    } catch (error) {
      console.error('Instagram connection error:', error);
      toast({
        title: "Connection failed",
        description: "Could not initiate Instagram connection",
        variant: "destructive"
      });
    }
  };

  const disconnectIntegration = async (platform: string) => {
    try {
      const { error } = await supabase
        .from('integrations')
        .delete()
        .eq('user_id', user?.id)
        .eq('platform', platform);

      if (error) throw error;

      toast({
        title: "Integration disconnected",
        description: `${platform} integration has been removed`
      });
      
      fetchIntegrations();
    } catch (error) {
      toast({
        title: "Disconnect failed",
        description: `Could not disconnect ${platform} integration`,
        variant: "destructive"
      });
    }
  };

  const getIntegrationStatus = (platform: string) => {
    return integrations.find(int => int.platform === platform && int.is_active);
  };

  if (loading) {
    return <div className="text-center py-8">Loading integrations...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Platform Integrations</h2>
        <p className="text-muted-foreground">
          Connect your Instagram and GoHighLevel accounts to enable automations.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Instagram Integration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Instagram className="h-5 w-5" />
              <span>Instagram</span>
              {getIntegrationStatus('instagram') ? (
                <Badge variant="default" className="ml-auto">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="secondary" className="ml-auto">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Not Connected
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Connect your Instagram Business account to monitor outbound messages and trigger automations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Button 
                onClick={connectInstagram}
                disabled={!!getIntegrationStatus('instagram')}
                className="w-full"
              >
                {getIntegrationStatus('instagram') ? 'Connected' : 'Connect Instagram'}
              </Button>
              {getIntegrationStatus('instagram') && (
                <Button 
                  onClick={() => disconnectIntegration('instagram')}
                  variant="outline"
                  className="w-full"
                >
                  Disconnect
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* GoHighLevel Integration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <div className="h-5 w-5 bg-primary rounded flex items-center justify-center">
                <span className="text-xs text-primary-foreground font-bold">G</span>
              </div>
              <span>GoHighLevel</span>
              {getIntegrationStatus('gohighlevel') ? (
                <Badge variant="default" className="ml-auto">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="secondary" className="ml-auto">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Not Connected
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Enter your GHL API key to manage pipelines and opportunities.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleGHLSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="apiKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>API Key</FormLabel>
                      <FormControl>
                        <Input 
                          type="password" 
                          placeholder="Enter your GHL API key"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={submitting}
                >
                  {submitting ? 'Connecting...' : 'Connect GoHighLevel'}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default IntegrationSetup;