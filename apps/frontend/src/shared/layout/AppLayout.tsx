import { Outlet, useLocation } from 'react-router-dom';
import AppSidebar from '@/shared/layout/AppSidebar';
import { useData } from '@/features/data/context/useData';

const pageMeta: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Dashboard', subtitle: 'Overview & Insights' },
  '/data': { title: 'Data Table', subtitle: 'View & Manage Data' },
  '/upload': { title: 'Upload', subtitle: 'Import Your Data' },
  '/analytics': { title: 'Analytics', subtitle: 'Deep Dive Analysis' },
  '/chat': { title: 'AI Chat', subtitle: 'Natural Language Interface' },
};

const AppLayout = () => {
  const location = useLocation();
  const { dataset } = useData();
  const meta = pageMeta[location.pathname] ?? pageMeta['/'];

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className="pl-64 min-h-screen">
        <div className="border-b border-border/50 px-8 py-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground mb-1">
                <span className="font-medium text-foreground">{dataset?.name || 'No Dataset'}</span>
                {dataset && (
                  <>
                    <span className="text-border">•</span>
                    <span>{dataset.rowCount.toLocaleString()} rows</span>
                  </>
                )}
              </div>
              <h1 className="text-2xl font-semibold text-foreground">{meta.title}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">{meta.subtitle}</p>
            </div>
          </div>
        </div>
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;