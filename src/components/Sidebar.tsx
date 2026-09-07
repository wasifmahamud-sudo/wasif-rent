import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Receipt, 
  Bell, 
  BarChart3, 
  LogOut, 
  ChevronLeft, 
  ChevronRight,
  Sparkles
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  aiOpen: boolean;
  setAiOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  setActiveTab, 
  collapsed, 
  setCollapsed,
  aiOpen,
  setAiOpen
}) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tenants', label: 'Tenants', icon: Users },
    { id: 'bills', label: 'Month Bills', icon: Receipt },
    { id: 'reminders', label: 'Payment Reminders', icon: Bell },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
  ];

  return (
    <aside 
      className={`relative h-screen bg-slate-900/90 backdrop-blur-md border-r border-slate-800 text-slate-300 transition-all duration-300 flex flex-col justify-between shrink-0 z-30 ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Collapse Toggle Button */}
      <button 
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-7 bg-slate-800 border border-slate-700 text-slate-300 hover:text-white p-1 rounded-full shadow-lg z-50 transition-colors"
        title="Toggle Sidebar"
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      <div>
        {/* Brand Header */}
        <div className="h-16 flex items-center px-5 border-b border-slate-800/80 gap-3">
          <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
            <Sparkles size={20} />
          </div>
          {!collapsed && (
            <span className="font-bold text-white tracking-wide text-lg">
              Smart<span className="text-blue-400">Rent</span>
            </span>
          )}
        </div>

        {/* AI Assistant Quick Toggle */}
        <div className="p-3">
          <button
            onClick={() => setAiOpen(!aiOpen)}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              aiOpen 
                ? 'bg-gradient-to-r from-blue-600/30 to-indigo-600/30 border border-blue-500/50 text-blue-300' 
                : 'bg-slate-800/60 border border-slate-700/60 hover:border-slate-600 text-slate-300'
            }`}
          >
            <Sparkles size={18} className="text-blue-400 animate-pulse" />
            {!collapsed && (
              <div className="flex items-center justify-between w-full">
                <span>Ask AI Assistant</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">Beta</span>
              </div>
            )}
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="px-3 py-2 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl font-medium transition-all duration-200 text-sm ${
                  isActive 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                    : 'hover:bg-slate-800/60 hover:text-slate-100 text-slate-400'
                }`}
              >
                <Icon size={18} className={isActive ? 'text-white' : 'text-slate-400'} />
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer / Logout */}
      <div className="p-3 border-t border-slate-800/80">
        <button className="w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl font-medium text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-colors text-sm">
          <LogOut size={18} />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
};
