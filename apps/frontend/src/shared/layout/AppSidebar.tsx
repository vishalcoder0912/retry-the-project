import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Upload, MessageSquare, Database, Sparkles, Table2 } from 'lucide-react';
import { motion } from 'framer-motion';
import ThemeToggle from '@/shared/layout/ThemeToggle';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/data', label: 'Data Table', icon: Table2 },
  { path: '/upload', label: 'Upload Data', icon: Upload },
  { path: '/chat', label: 'AI Chat', icon: MessageSquare },
];

const AppSidebar = () => {
  const location = useLocation();

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col z-50">
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center glow-primary">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-base font-bold text-sidebar-accent-foreground tracking-tight">InsightFlow</h1>
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">AI Analytics</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(item => {
          const isActive = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path}>
              <motion.div
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'text-sidebar-primary-foreground bg-primary'
                    : 'text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent'
                }`}
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.98 }}
              >
                <item.icon className="w-4 h-4" />
                <span className="font-medium">{item.label}</span>
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* Status */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="mb-3">
          <ThemeToggle />
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-sidebar-accent">
          <Database className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Local Processing</span>
          <span className="ml-auto w-2 h-2 rounded-full bg-success animate-pulse-slow" />
        </div>
      </div>
    </aside>
  );
};

export default AppSidebar;
