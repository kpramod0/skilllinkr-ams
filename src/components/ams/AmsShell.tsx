"use client";
import React, { useState } from "react";
import { 
  Menu, X, ShieldCheck, Layers, BookOpen, Users, Award, 
  Briefcase, Clock, FileSpreadsheet, Download, Mail, 
  Building2, UserCog, History, LogOut, ArrowLeft
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

export type AmsTab = 
  | "dashboard" | "institutions" | "admins" | "cycles" | "projects" 
  | "audit" | "students" | "faculty" | "schemes" | "roster" 
  | "reports" | "exports" | "communications";

interface AmsShellProps {
  access: { isSuperAdmin: boolean; isAdmin: boolean; domain: string | null; institutionName?: string | null; status: string; name?: string | null };
  user: { email: string } | null;
  activeTab: AmsTab;
  setActiveTab: (tab: AmsTab) => void;
  children: React.ReactNode;
}

export function AmsShell({ access, user, activeTab, setActiveTab, children }: AmsShellProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const superAdminNav = [
    { section: "OVERVIEW", items: [{ id: "dashboard", label: "Dashboard", icon: Layers }] },
    { section: "ADMINISTRATION", items: [
      { id: "institutions", label: "Institutions", icon: Building2 },
      { id: "admins", label: "Academic Administrators", icon: UserCog }
    ]},
    { section: "GOVERNANCE", items: [{ id: "audit", label: "Audit Activity", icon: History }] }
  ];

  const academicAdminNav = [
    { section: "OVERVIEW", items: [{ id: "dashboard", label: "Dashboard", icon: Layers }] },
    { section: "SETUP", items: [
      { id: "cycles", label: "Academic Cycles", icon: BookOpen },
      { id: "students", label: "Students & Faculty", icon: Users },
      { id: "faculty", label: "Faculty Capacity", icon: Users },
      { id: "schemes", label: "Evaluation Schemes", icon: Award }
    ]},
    { section: "OPERATIONS", items: [
      { id: "projects", label: "Projects", icon: Briefcase },
      { id: "roster", label: "Roster Requests", icon: Clock },
      { id: "reports", label: "Shared Reports", icon: FileSpreadsheet }
    ]},
    { section: "REPORTING", items: [
      { id: "exports", label: "Exports", icon: Download },
      { id: "communications", label: "Communications", icon: Mail }
    ]}
  ];

  const navToUse = access.isSuperAdmin ? superAdminNav : academicAdminNav;

  const handleNavClick = (id: string) => {
    setActiveTab(id as AmsTab);
    setIsMobileOpen(false);
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full" style={{ backgroundColor: '#ffffff', borderRight: '1px solid #e4e4e8' }}>
      {/* Brand */}
      <div className="p-6 flex items-center gap-3" style={{ borderBottom: '1px solid #e4e4e8' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm" style={{ backgroundColor: '#e6f8f1' }}>
          <ShieldCheck className="w-6 h-6" style={{ color: '#10b981' }} />
        </div>
        <div>
          <h1 className="font-bold text-lg leading-none" style={{ color: '#1a1a2e' }}>AMS</h1>
          <p className="text-xs mt-1 font-medium" style={{ color: '#6b6b80' }}>
            {access.isSuperAdmin ? "Super Admin" : `Academic Admin`}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
        {navToUse.map((group, idx) => (
          <div key={idx}>
            <h3 className="text-[10px] font-bold uppercase tracking-wider mb-2 px-3" style={{ color: '#a1a1aa' }}>
              {group.section}
            </h3>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
                    style={
                      isActive 
                        ? { backgroundColor: '#e6f8f1', color: '#10b981' }
                        : { backgroundColor: 'transparent', color: '#6b6b80' }
                    }
                  >
                    <Icon className="w-4 h-4" style={{ color: isActive ? '#10b981' : '#6b6b80' }} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* User / Exit */}
      <div className="p-4 space-y-3" style={{ borderTop: '1px solid #e4e4e8', backgroundColor: '#f9fafb' }}>
        <div className="px-3 py-2">
            {access.name && <p className="text-sm font-bold truncate mb-0.5" style={{ color: '#1a1a2e' }}>{access.name}</p>}
            <p className="text-xs font-semibold truncate" style={{ color: access.name ? '#6b6b80' : '#1a1a2e' }}>{user?.email}</p>
          <p className="text-[10px] mt-0.5" style={{ color: '#6b6b80' }}>
            {access.isSuperAdmin ? "Global Access" : access.institutionName || access.domain || "Unknown Institution"}
          </p>
        </div>
        <button onClick={async () => {
            const supabase = createClient();
            await supabase.auth.signOut();
            window.location.href = "/ams/login";
          }} className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors hover:bg-red-50" style={{ color: '#ef4444' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            Log Out
          </button>
          <Link href="/main/academic" className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors hover:bg-white mt-1" style={{ color: '#6b6b80' }}>
            <ArrowLeft className="w-4 h-4" />
            Main Portal
          </Link>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden text-[#1a1a2e]" style={{ backgroundColor: '#F0F0F3', color: '#1a1a2e' }} data-theme="light">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-[264px] shrink-0 h-full border-r border-[#d4d4dc] bg-[#ffffff]">
        <SidebarContent />
      </aside>

      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <aside 
        className="fixed inset-y-0 left-0 w-[264px] z-50 lg:hidden transition-transform duration-300"
        style={{ 
          backgroundColor: '#ffffff',
          transform: isMobileOpen ? 'translateX(0)' : 'translateX(-100%)'
        }}
      >
        <div className="absolute top-4 right-4">
          <button onClick={() => setIsMobileOpen(false)} className="p-2 rounded-full" style={{ color: '#6b6b80', backgroundColor: '#e4e4e8' }}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <SidebarContent />
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden flex items-center justify-between p-4" style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #e4e4e8' }}>
          <div className="flex items-center gap-3">
            <button onClick={() => setIsMobileOpen(true)} className="p-2 -ml-2 rounded-lg" style={{ color: '#1a1a2e' }}>
              <Menu className="w-7 h-7" />
            </button>
            <div className="flex items-center gap-2">
               <ShieldCheck className="w-5 h-5" style={{ color: '#10b981' }} />
               <span className="font-bold text-lg" style={{ color: '#1a1a2e' }}>AMS</span>
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 custom-scrollbar">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

