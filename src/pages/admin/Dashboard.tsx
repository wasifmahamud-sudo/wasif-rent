import React, { useState } from 'react';
import { Sidebar } from '../../components/Sidebar';
import { AiAssistant } from '../../components/AiAssistant';

// Existing Pages
import Bills from './Bills';
import Tenants from './Tenants';
import Reminders from './Reminders';
import Reports from './Reports';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* 1. Left Sidebar */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        aiOpen={aiOpen}
        setAiOpen={setAiOpen}
      />

      {/* 2. Main Content Container */}
      <div className="flex-1 flex flex-col h-screen overflow-y-auto">
        {/* Top Navbar Header */}
        <header className="h-16 border-b border-slate-800/80 bg-slate-900/40 backdrop-blur-md px-8 flex items-center justify-between sticky top-0 z-20">
          <h1 className="text-xl font-bold tracking-tight text-white capitalize">
            {activeTab === 'bills' ? 'Month Bills' : activeTab}
          </h1>

          <div className="flex items-center gap-4">
            <span className="text-xs px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              System Active
            </span>
            <div className="w-8 h-8 rounded-full bg-blue-600/30 border border-blue-500/40 flex items-center justify-center font-bold text-xs text-blue-300">
              AD
            </div>
          </div>
        </header>

        {/* Dynamic Page Rendering */}
        <main className="p-8 flex-1">
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
                  <p className="text-sm text-slate-400">Total Revenue</p>
                  <h2 className="text-3xl font-bold mt-2 text-white">৳ 45,000</h2>
                </div>
                <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
                  <p className="text-sm text-slate-400">Active Tenants</p>
                  <h2 className="text-3xl font-bold mt-2 text-blue-400">12</h2>
                </div>
                <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
                  <p className="text-sm text-slate-400">Pending Reminders</p>
                  <h2 className="text-3xl font-bold mt-2 text-amber-400">3</h2>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'tenants' && <Tenants />}
          {activeTab === 'bills' && <Bills />}
          {activeTab === 'reminders' && <Reminders />}
          {activeTab === 'reports' && <Reports />}
        </main>
      </div>

      {/* 3. Floating AI Drawer */}
      <AiAssistant isOpen={aiOpen} onClose={() => setAiOpen(false)} />
    </div>
  );
}
