import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Send, TestTube } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const testMessageSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  opportunityId: z.string().min(1, 'Opportunity ID is required'),
});

type TestMessageFormData = z.infer<typeof testMessageSchema>;

const TestMessageInterface = () => {
  const { user } = useAuth();
  const [sending, setSending] = useState(false);

  const form = useForm<TestMessageFormData>({
    resolver: zodResolver(testMessageSchema),
    defaultValues: {
      message: '',
      opportunityId: '',
    },
  });

  const handleTestMessage = async (data: TestMessageFormData) => {
    setSending(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('process-instagram-message', {
        body: {
          message: data.message,
          userId: user?.id,
          opportunityId: data.opportunityId
        }
      });

      if (error) throw error;

      if (result.success) {
        toast({
          title: "Automation triggered!",
          description: `Message processed by automation: ${result.automationTriggered}. Opportunity moved to stage ${result.stageId}`,
        });
      } else {
        toast({
          title: "No automation triggered",
          description: result.message || "No matching keywords found",
        });
      }
    } catch (error) {
      console.error('Test message error:', error);
      toast({
        title: "Test failed",
        description: "Could not process test message",
        variant: "destructive"
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <TestTube className="h-5 w-5" />
          <span>Test Instagram Automation</span>
        </CardTitle>
        <CardDescription>
          Test your keyword automations by simulating an outbound Instagram message.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleTestMessage)} className="space-y-4">
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Outbound Message Content</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Type your outbound Instagram message here (e.g., 'Hi John, I've sent you the pricing information you requested...')"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="opportunityId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>GHL Opportunity ID</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Enter the opportunity ID from GoHighLevel"
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
              disabled={sending}
            >
              <Send className="h-4 w-4 mr-2" />
              {sending ? 'Testing Automation...' : 'Test Automation'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default TestMessageInterface;