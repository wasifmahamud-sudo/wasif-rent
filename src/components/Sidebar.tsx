import React, { useState } from 'react';
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
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const [collapsed, setCollapsed] = useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tenants', label: 'Tenants', icon: Users },
    { id: 'bills', label: 'Month Bills', icon: Receipt },
    { id: 'reminders', label: 'Payment Reminders', icon: Bell },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
  ];

  return (
    <aside 
      className={`relative h-screen bg-slate-900 border-r border-slate-800 text-slate-300 transition-all duration-300 flex flex-col justify-between ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Collapse Toggle Button */}
      <button 
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-8 bg-slate-800 border border-slate-700 text-slate-300 hover:text-white p-1 rounded-full shadow-lg z-50"
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      <div>
        {/* Brand Header */}
        <div className="h-16 flex items-center px-6 border-b border-slate-800/80 gap-3">
          <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
            <Sparkles size={20} />
          </div>
          {!collapsed && (
            <span className="font-bold text-white tracking-wide text-lg">
              Smart<span className="text-blue-400">Rent</span>
            </span>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="p-4 space-y-1.5">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl font-medium transition-all duration-200 text-sm ${
                  isActive 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' 
                    : 'hover:bg-slate-800/60 hover:text-slate-100 text-slate-400'
                }`}
              >
                <Icon size={20} className={isActive ? 'text-white' : 'text-slate-400'} />
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer / User Logout Section */}
      <div className="p-4 border-t border-slate-800/80">
        <button className="w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl font-medium text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-colors text-sm">
          <LogOut size={20} />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
};
