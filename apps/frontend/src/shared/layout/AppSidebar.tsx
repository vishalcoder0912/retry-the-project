import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Upload, MessageSquare, Database, Table2, LineChart, AlertTriangle, TrendingUp, Filter, Download, CheckCircle } from 'lucide-react';
import ThemeToggle from '@/shared/layout/ThemeToggle';

const navItems = [
  { path: '/', label: '1.0 Dashboard', icon: LayoutDashboard },
  { path: '/data', label: '2.0 Data Table', icon: Table2 },
  { path: '/upload', label: '3.0 Upload', icon: Upload },
  { path: '/analytics', label: '4.0 Analytics', icon: LineChart },
  { path: '/analytics/profile', label: '4.1 Profile', icon: CheckCircle },
  { path: '/analytics/anomalies', label: '4.2 Anomalies', icon: AlertTriangle },
  { path: '/analytics/relationships', label: '4.3 Relations', icon: TrendingUp },
  { path: '/analytics/cleaning', label: '4.4 Cleaning', icon: Filter },
  { path: '/analytics/export', label: '4.5 Export', icon: Download },
  { path: '/chat', label: '5.0 AI Chat', icon: MessageSquare },
];

const AppSidebar = () => {
  const location = useLocation();

  return (
    <aside className="fixed left-0 top-0 z-50 flex h-screen w-80 flex-col border-r border-sidebar-border bg-sidebar-background">
      <div className="border-b border-sidebar-border px-8 py-8">
        <Link to="/" className="block">
          <h1 className="text-[2.1rem] font-semibold uppercase tracking-[0.04em] text-sidebar-accent-foreground">InsightFlow</h1>
          <p className="mt-3 text-sm uppercase tracking-[0.08em] text-accent">Secure Data Terminal</p>
        </Link>
      </div>

      <nav className="flex-1 py-8">
        {navItems.map(item => {
          const isActive = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path} className="block border-b border-sidebar-border">
              <div
                className={`flex items-center gap-4 px-8 py-6 text-[1.05rem] uppercase tracking-[0.08em] transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                }`}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-sidebar-border px-8 py-6">
        <div className="mb-4">
          <ThemeToggle />
        </div>
        <div className="terminal-panel px-4 py-4">
          <div className="mb-2 flex items-center gap-3">
            <Database className="h-4 w-4 text-success" />
            <span className="text-sm uppercase tracking-[0.08em] text-success">System Status: Secure</span>
          </div>
          <div className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Encryption: AES-256</div>
          <div className="mt-4 h-1 w-full bg-muted">
            <div className="h-1 w-4/5 bg-success" />
          </div>
        </div>
        <div className="mt-8 text-sm uppercase tracking-[0.12em] text-accent">Top Secret // NOFORN</div>
      </div>
    </aside>
  );
};

export default AppSidebar;
