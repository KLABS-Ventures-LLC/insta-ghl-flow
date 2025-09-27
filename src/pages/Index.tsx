import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import IntegrationSetup from '@/components/IntegrationSetup';
import PipelineDisplay from '@/components/PipelineDisplay';
import AutomationManager from '@/components/AutomationManager';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground mb-2">Welcome to InstaFlow</h1>
          <p className="text-lg text-muted-foreground">
            Automate your Instagram to GoHighLevel workflow
          </p>
        </div>

        <Tabs defaultValue="integrations" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
            <TabsTrigger value="pipelines">Pipelines</TabsTrigger>
            <TabsTrigger value="automations">Automations</TabsTrigger>
          </TabsList>
          
          <TabsContent value="integrations" className="mt-6">
            <IntegrationSetup />
          </TabsContent>
          
          <TabsContent value="pipelines" className="mt-6">
            <PipelineDisplay />
          </TabsContent>
          
          <TabsContent value="automations" className="mt-6">
            <AutomationManager />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Index;
