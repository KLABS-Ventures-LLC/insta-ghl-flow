import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Edit, Zap } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const automationSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  keywords: z.string().min(1, 'Keywords are required'),
  pipelineId: z.string().min(1, 'Pipeline is required'),
  stageId: z.string().min(1, 'Stage is required'),
});

type AutomationFormData = z.infer<typeof automationSchema>;

interface Automation {
  id: string;
  name: string;
  keywords: string[];
  ghl_pipeline_id: string;
  ghl_stage_id: string;
  is_active: boolean;
  created_at: string;
}

const AutomationManager = () => {
  const { user } = useAuth();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null);

  const form = useForm<AutomationFormData>({
    resolver: zodResolver(automationSchema),
    defaultValues: {
      name: '',
      keywords: '',
      pipelineId: '',
      stageId: '',
    },
  });

  useEffect(() => {
    if (user) {
      fetchAutomations();
    }
  }, [user]);

  const fetchAutomations = async () => {
    try {
      const { data, error } = await supabase
        .from('automations')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAutomations(data || []);
    } catch (error) {
      toast({
        title: "Error fetching automations",
        description: "Could not load your automations",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (data: AutomationFormData) => {
    setSubmitting(true);
    try {
      const keywords = data.keywords.split(',').map(k => k.trim()).filter(k => k);
      
      if (editingAutomation) {
        const { error } = await supabase
          .from('automations')
          .update({
            name: data.name,
            keywords,
            ghl_pipeline_id: data.pipelineId,
            ghl_stage_id: data.stageId,
          })
          .eq('id', editingAutomation.id);

        if (error) throw error;
        toast({
          title: "Automation updated",
          description: "Your automation has been updated successfully"
        });
      } else {
        const { error } = await supabase
          .from('automations')
          .insert({
            user_id: user?.id,
            name: data.name,
            keywords,
            ghl_pipeline_id: data.pipelineId,
            ghl_stage_id: data.stageId,
            is_active: true
          });

        if (error) throw error;
        toast({
          title: "Automation created",
          description: "Your automation has been created successfully"
        });
      }

      form.reset();
      setDialogOpen(false);
      setEditingAutomation(null);
      fetchAutomations();
    } catch (error) {
      toast({
        title: "Error saving automation",
        description: "Could not save your automation",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleAutomation = async (automation: Automation) => {
    try {
      const { error } = await supabase
        .from('automations')
        .update({ is_active: !automation.is_active })
        .eq('id', automation.id);

      if (error) throw error;
      
      toast({
        title: `Automation ${!automation.is_active ? 'enabled' : 'disabled'}`,
        description: `${automation.name} has been ${!automation.is_active ? 'enabled' : 'disabled'}`
      });
      
      fetchAutomations();
    } catch (error) {
      toast({
        title: "Error updating automation",
        description: "Could not update automation status",
        variant: "destructive"
      });
    }
  };

  const deleteAutomation = async (automationId: string) => {
    try {
      const { error } = await supabase
        .from('automations')
        .delete()
        .eq('id', automationId);

      if (error) throw error;
      
      toast({
        title: "Automation deleted",
        description: "Your automation has been deleted"
      });
      
      fetchAutomations();
    } catch (error) {
      toast({
        title: "Error deleting automation",
        description: "Could not delete automation",
        variant: "destructive"
      });
    }
  };

  const openEditDialog = (automation: Automation) => {
    setEditingAutomation(automation);
    form.setValue('name', automation.name);
    form.setValue('keywords', automation.keywords.join(', '));
    form.setValue('pipelineId', automation.ghl_pipeline_id);
    form.setValue('stageId', automation.ghl_stage_id);
    setDialogOpen(true);
  };

  const openNewDialog = () => {
    setEditingAutomation(null);
    form.reset();
    setDialogOpen(true);
  };

  if (loading) {
    return <div className="text-center py-8">Loading automations...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Automations</h2>
          <p className="text-muted-foreground">
            Create rules to automatically move opportunities based on Instagram keywords.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNewDialog}>
              <Plus className="h-4 w-4 mr-2" />
              New Automation
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingAutomation ? 'Edit Automation' : 'Create New Automation'}
              </DialogTitle>
              <DialogDescription>
                Set up keyword triggers to automatically move opportunities in your GHL pipeline.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Automation Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Move Interested Leads" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="keywords"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Keywords (comma separated)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., interested, pricing, buy now" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="pipelineId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Pipeline</FormLabel>
                      <FormControl>
                        <Input placeholder="Pipeline ID from GHL" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="stageId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Stage</FormLabel>
                      <FormControl>
                        <Input placeholder="Stage ID from GHL" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? 'Saving...' : editingAutomation ? 'Update Automation' : 'Create Automation'}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {automations.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Zap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">No automations created yet.</p>
            <Button onClick={openNewDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Automation
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {automations.map((automation) => (
            <Card key={automation.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{automation.name}</CardTitle>
                    <CardDescription>
                      Created {new Date(automation.created_at).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={automation.is_active}
                      onCheckedChange={() => toggleAutomation(automation)}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditDialog(automation)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deleteAutomation(automation.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Keywords:</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {automation.keywords.map((keyword, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <Label className="text-muted-foreground">Pipeline:</Label>
                      <p className="font-mono">{automation.ghl_pipeline_id}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Stage:</Label>
                      <p className="font-mono">{automation.ghl_stage_id}</p>
                    </div>
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

export default AutomationManager;