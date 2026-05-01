import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Upload, MessageSquare, Table2, LineChart, Sparkles } from 'lucide-react';
import ThemeToggle from '@/shared/layout/ThemeToggle';
import { cn } from '@/shared/lib/utils';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/data', label: 'Data Table', icon: Table2 },
  { path: '/upload', label: 'Upload', icon: Upload },
  { path: '/analytics', label: 'Analytics', icon: LineChart },
  { path: '/chat', label: 'AI Chat', icon: MessageSquare },
];

const AppSidebar = () => {
  const location = useLocation();

  return (
    <aside className="fixed left-0 top-0 z-50 flex h-screen w-64 flex-col border-r border-border/50 bg-sidebar-background">
      <div className="border-b border-border/50 px-6 py-5">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80 shadow-md shadow-primary/20">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-sidebar-foreground">InsightFlow</h1>
            <p className="text-xs text-muted-foreground">Analytics Platform</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        <div className="px-3 mb-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Menu</p>
        </div>
        {navItems.map(item => {
          const isActive = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path} className="block">
              <div
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
                )}
              >
                <item.icon className={cn('h-5 w-5', isActive ? 'text-primary' : '')} />
                <span>{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border/50 px-4 py-4">
        <div className="mb-3">
          <ThemeToggle />
        </div>
        <div className="rounded-lg bg-muted/50 p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span>All systems operational</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default AppSidebar;