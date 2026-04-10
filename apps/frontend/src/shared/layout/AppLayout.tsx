import { Outlet, useLocation } from 'react-router-dom';
import AppSidebar from '@/shared/layout/AppSidebar';
import { useData } from '@/features/data/context/useData';

const pageMeta: Record<string, { title: string; ref: string }> = {
  '/': { title: 'Subject: Global Salary Analysis', ref: 'REF: DEPT-INTEL-2024-B' },
  '/data': { title: '2.0 Data Master Table', ref: 'TOTAL REGISTRY REVIEW ACTIVE' },
  '/upload': { title: 'File Ingestion Protocol', ref: 'REF: INTAKE-PROC-3.0' },
  '/analytics': { title: '4.0 Analytics Deep-Dive', ref: 'CROSS-DIMENSIONAL ANALYSIS ACTIVE' },
  '/chat': { title: '5.0 Artificial Intelligence Interface', ref: 'TERMINAL ACCESS: SECURE_CHANNEL_09' },
};

const AppLayout = () => {
  const location = useLocation();
  const { dataset } = useData();
  const meta = pageMeta[location.pathname] ?? pageMeta['/'];

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className="ml-80 min-h-screen">
        <div className="border-b border-border px-10 py-6">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="terminal-label">FILE: {dataset?.name?.toUpperCase() ?? 'UNASSIGNED'}</p>
              <h1 className="terminal-heading mt-2">{meta.title}</h1>
              <p className="mt-2 text-sm uppercase tracking-[0.08em] text-muted-foreground">{meta.ref}</p>
            </div>
            <div className="terminal-panel px-4 py-3 text-sm uppercase tracking-[0.08em] text-success">
              System Status: Secure
            </div>
          </div>
        </div>
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;
