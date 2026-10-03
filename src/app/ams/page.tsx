"use client";

import React, { useState, useEffect } from "react";
import { 
  ShieldCheck, Users, BookOpen, FileSpreadsheet, CheckCircle, 
  Download, Mail, AlertCircle, Clock, Layers, Award,
  Building2, UserCog, Briefcase, History, Search, Plus
} from "lucide-react";
import { AmsShell, AmsTab } from "@/components/ams/AmsShell";
import Link from "next/link";

export default function AmsDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [access, setAccess] = useState<{
    isSuperAdmin: boolean;
    isAdmin: boolean;
    domain: string | null;
    institutionId: string | null;
    institutionName: string | null;
    status: string;
  } | null>(null);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [activeTab, setActiveTab] = useState<AmsTab>("dashboard");

  const [rosterRequests, setRosterRequests] = useState<any[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [importMode, setImportMode] = useState<"student" | "faculty">("student");

  const [metrics, setMetrics] = useState<{institutions:number, administrators:number, activeCycles:number, projects:number} | null>(null);
  const [adminMetrics, setAdminMetrics] = useState<{eligibleStudents:number, allocatedProjects:number, activeCycles:number} | null>(null);
  const [searchInstitution, setSearchInstitution] = useState("");
  const [searchAdmin, setSearchAdmin] = useState("");
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [academicCycles, setAcademicCycles] = useState<any[]>([]);
  const [isLoadingCycles, setIsLoadingCycles] = useState(false);
  const [showCycleModal, setShowCycleModal] = useState(false);
  const [editingCycle, setEditingCycle] = useState<any | null>(null);
  
  // Cycle Form State
  const [cycleForm, setCycleForm] = useState({ name: "", start_date: "", end_date: "", status: "draft" });

  const [adminsData, setAdminsData] = useState<{admins:any[], invitations:any[]}>({admins:[], invitations:[]});
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteDomain, setInviteDomain] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [invitePosition, setInvitePosition] = useState("");
  const [inviteContactNo, setInviteContactNo] = useState("");
  const [isInviting, setIsInviting] = useState(false);

  useEffect(() => {
    // Keep tab in sync with URL if supported, otherwise just start at dashboard
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get("tab") as AmsTab;
    if (tab) setActiveTab(tab);
    
    fetchAmsAccess();
  }, []);

  // Update URL silently to preserve deep linking when tab changes
  useEffect(() => {
    if (activeTab !== 'dashboard' && typeof window !== 'undefined') {
      window.history.replaceState(null, '', `?tab=${activeTab}`);
    } else if (activeTab === 'dashboard' && typeof window !== 'undefined') {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [activeTab]);

  const fetchSuperAdminData = async () => {
    try {
      const [mRes, iRes, aRes] = await Promise.all([
        fetch("/api/ams/super/dashboard-metrics"),
        fetch("/api/ams/super/institutions"),
        fetch("/api/ams/super/admins")
      ]);
      if (mRes.ok) setMetrics(await mRes.json());
      if (iRes.ok) setInstitutions((await iRes.json()).institutions || []);
      if (aRes.ok) setAdminsData(await aRes.json());
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAmsAccess = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/ams/auth/check");
      const data = await res.json();

      if (res.ok && data.access) {
        if (data.access.status === 'pending_onboarding') {
          window.location.href = '/ams/onboarding';
          return;
        }
        setAccess(data.access);
        setUser(data.user);
        if (data.access.isSuperAdmin) {
          fetchSuperAdminData();
        }
        if (data.access.isAdmin) {
          fetchRosterRequests();
          fetchAdminMetrics();
        }
      } else {
        setAccess({ isSuperAdmin: false, isAdmin: false, domain: null, institutionId: null, institutionName: null, status: "denied" });
      }
    } catch (err) {
      setAccess({ isSuperAdmin: false, isAdmin: false, domain: null, institutionId: null, institutionName: null, status: "error" });
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminMetrics = async () => {
    try {
      const res = await fetch("/api/ams/admin/metrics");
      if (res.ok) setAdminMetrics(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAcademicCycles = async () => {
    try {
      setIsLoadingCycles(true);
      const res = await fetch("/api/ams/cycles");
      const data = await res.json();
      if (res.ok) {
        setAcademicCycles(data.cycles || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingCycles(false);
    }
  };

  const handleSaveCycle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/ams/cycles", {
        method: editingCycle ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingCycle ? { id: editingCycle.id, ...cycleForm } : cycleForm),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ text: data.message || "Cycle saved successfully", type: "success" });
        setShowCycleModal(false);
        fetchAcademicCycles();
      } else {
        setMessage({ text: data.error || "Failed to save cycle", type: "error" });
      }
    } catch (err: any) {
      setMessage({ text: err.message || "Failed to save cycle", type: "error" });
    }
  };

  const handleDeleteCycle = async (id: string) => {
    if (!confirm("Are you sure you want to delete this cycle?")) return;
    try {
      const res = await fetch("/api/ams/cycles", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ text: data.message || "Cycle deleted successfully", type: "success" });
        fetchAcademicCycles();
      } else {
        setMessage({ text: data.error || "Failed to delete cycle", type: "error" });
      }
    } catch (err: any) {
      setMessage({ text: err.message || "Failed to delete cycle", type: "error" });
    }
  };

  const fetchRosterRequests = async () => {
    try {
      const res = await fetch("/api/ams/roster-changes");
      const data = await res.json();
      if (res.ok) {
        setRosterRequests(data.requests || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleApproveRosterChange = async (requestId: string, status: "approved" | "rejected") => {
    try {
      setProcessingId(requestId);
      const res = await fetch("/api/ams/roster-changes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, status }),
      });
      const data = await res.json();

      if (res.ok) {
        setMessage({ text: `Roster change request ${status} successfully`, type: "success" });
        fetchRosterRequests();
      } else {
        setMessage({ text: data.error || "Failed to process request", type: "error" });
      }
    } catch (err: any) {
      setMessage({ text: err.message || "Failed to process request", type: "error" });
    } finally {
      setProcessingId(null);
    }
  };

  const handleInviteAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isInviting) return;
    try {
      setIsInviting(true);
      const res = await fetch("/api/ams/super/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          targetEmail: inviteEmail, 
          institutionId: inviteDomain,
          tempPassword,
          name: inviteName,
          position: invitePosition,
          contactNo: inviteContactNo
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.invite && data.invite.alreadyExisted) {
          setMessage({ text: "User already exists. They were granted admin access but must log in using their existing password.", type: "success" });
        } else {
          setMessage({ text: `Successfully provisioned ${inviteEmail}`, type: "success" });
        }
        setInviteEmail("");
        setInviteDomain("");
        setTempPassword("");
        setInviteName("");
        setInvitePosition("");
        setInviteContactNo("");
        fetchSuperAdminData();
      } else {
        setMessage({ text: data.error || "Failed to invite administrator", type: "error" });
      }
    } catch (err: any) {
      setMessage({ text: err.message || "An error occurred", type: "error" });
    } finally {
      setIsInviting(false);
    }
  };

  const handleManageAdmin = async (adminId: string, action: 'suspend' | 'restore' | 'delete') => {
    if (action === 'delete' && !confirm("Are you sure you want to permanently delete this administrator and all their AMS traces?")) {
      return;
    }
    
    try {
      const res = await fetch("/api/ams/super/admins/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminId, action })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ text: data.message, type: "success" });
        fetchSuperAdminData();
      } else {
        setMessage({ text: data.error || "Failed to manage admin", type: "error" });
      }
    } catch (err: any) {
      setMessage({ text: err.message || "An error occurred", type: "error" });
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    try {
      const res = await fetch("/api/ams/super/admins/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId, action: 'cancel_invite' })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ text: data.message, type: "success" });
        fetchSuperAdminData();
      } else {
        setMessage({ text: data.error || "Failed to cancel invite", type: "error" });
      }
    } catch (err: any) {
      setMessage({ text: err.message || "An error occurred", type: "error" });
    }
  };

  const handleDownloadExport = (type: string) => {
    window.open(`/api/ams/exports?type=${type}`, "_blank");
  };

  if (loading) {
    return (
      <div style={{ backgroundColor: '#F0F0F3', color: '#1a1a2e' }} className="min-h-screen flex flex-col items-center justify-center p-6" data-theme="light">
        <div className="w-10 h-10 border-4 border-[#10b981] border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-[#6b6b80] font-medium text-sm animate-pulse">Verifying Access...</p>
      </div>
    );
  }

  if (!access || (!access.isAdmin && !access.isSuperAdmin)) {
    return (
      <div style={{ backgroundColor: '#F0F0F3', color: '#1a1a2e' }} className="min-h-screen flex flex-col items-center justify-center p-6" data-theme="light">
        <div className="max-w-md w-full bg-[#ffffff] border border-[#d4d4dc] rounded-2xl p-8 text-center shadow-xl shadow-slate-200/50">
          <div className="w-16 h-16 bg-red-50 border border-red-100 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-[#1a1a2e] mb-2">Access Denied</h2>
          <p className="text-[#6b6b80] text-sm mb-6 leading-relaxed">
            The Academic Management System (AMS) is restricted to active Academic Administrators and Super Administrators.
            Your account <span className="text-[#10b981] font-semibold">{user?.email || "Unknown"}</span> lacks administrative privileges.
          </p>
          <div className="text-left bg-[#f7f7f9] border border-[#d4d4dc] rounded-xl p-4 mb-6">
            <p className="text-xs text-[#6b6b80] mb-1">• Your student/faculty session is active.</p>
            <p className="text-xs text-[#6b6b80]">• Please contact your university to request an admin invitation.</p>
          </div>
          <Link href="/main/academic" className="inline-flex items-center justify-center w-full px-6 py-3 bg-[#10b981] hover:bg-teal-700 text-[#ffffff] font-medium rounded-xl text-sm transition-colors shadow-sm">
            Return to Main Portal
          </Link>
        </div>
      </div>
    );
  }

  const renderMessage = () => {
    if (!message) return null;
    return (
      <div className={`mb-6 p-4 rounded-xl border text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm ${
        message.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800"
      }`}>
        <div className="flex items-center gap-2">
          {message.type === "success" ? <CheckCircle className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-red-600" />}
          <span className="font-medium">{message.text}</span>
        </div>
        <button onClick={() => setMessage(null)} className="text-xs font-semibold px-3 py-1.5 bg-[#ffffff]/50 hover:bg-[#ffffff] rounded-lg transition-colors">
          Dismiss
        </button>
      </div>
    );
  };

  const renderEmptyState = (title: string, description: string, icon: any, actionLabel?: string) => {
    const Icon = icon;
    return (
      <div className="bg-[#ffffff] border border-[#d4d4dc] rounded-2xl p-12 flex flex-col items-center text-center shadow-sm">
        <div className="w-16 h-16 bg-[#f7f7f9] rounded-2xl flex items-center justify-center mb-4 border border-[#d4d4dc]">
          <Icon className="w-8 h-8 text-[#6b6b80]" />
        </div>
        <h3 className="text-lg font-bold text-[#1a1a2e] mb-2">{title}</h3>
        <p className="text-sm text-[#6b6b80] max-w-md mx-auto mb-6">{description}</p>
        {actionLabel && (
          <button className="px-5 py-2.5 bg-[#10b981] hover:bg-teal-700 text-[#ffffff] font-medium text-sm rounded-xl transition-colors shadow-sm">
            {actionLabel}
          </button>
        )}
      </div>
    );
  };

  const filteredInstitutions = institutions.filter((inst: any) => 
    inst.name?.toLowerCase().includes(searchInstitution.toLowerCase()) || 
    inst.code?.toLowerCase().includes(searchInstitution.toLowerCase())
  );

  const activeAdmins = adminsData.admins.filter((a: any) => a.status !== "pending_onboarding");
  const filteredAdmins = activeAdmins.filter((a: any) => 
    a.name?.toLowerCase().includes(searchAdmin.toLowerCase()) || 
    a.institution?.name?.toLowerCase().includes(searchAdmin.toLowerCase()) ||
    a.email?.toLowerCase().includes(searchAdmin.toLowerCase())
  );

  return (
    <AmsShell 
      access={access} 
      user={user} 
      activeTab={activeTab} 
      setActiveTab={setActiveTab}
    >
      <style suppressHydrationWarning>{`
        /* Force light theme colors since Tailwind JIT compiler is ignoring AMS folder */
        .bg-\\[\\#ffffff\\] { background-color: #ffffff !important; }
        .bg-\\[\\#f7f7f9\\] { background-color: #f7f7f9 !important; }
        .bg-\\[\\#e4e4e8\\] { background-color: #e4e4e8 !important; }
        .bg-\\[\\#ecfdf5\\] { background-color: #ecfdf5 !important; }
        .border-\\[\\#d4d4dc\\] { border-color: #e4e4e8 !important; }
        .border-\\[\\#a7f3d0\\] { border-color: #a7f3d0 !important; }
        .text-\\[\\#1a1a2e\\] { color: #1a1a2e !important; }
        .text-\\[\\#6b6b80\\] { color: #6b6b80 !important; }
        .text-\\[\\#10b981\\] { color: #10b981 !important; }
        .bg-indigo-50 { background-color: #eef2ff !important; }
        .text-indigo-600 { color: #4f46e5 !important; }
        .bg-amber-50 { background-color: #fffbeb !important; }
        .text-amber-600 { color: #d97706 !important; }
        .bg-blue-50 { background-color: #eff6ff !important; }
        .text-blue-600 { color: #2563eb !important; }
        .bg-emerald-50 { background-color: #ecfdf5 !important; }
        .text-emerald-600 { color: #059669 !important; }
      `}</style>
      <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300">
        {renderMessage()}

        {/* =========================================================================
                                    DASHBOARDS 
        ========================================================================= */}
        {activeTab === "dashboard" && access.isSuperAdmin && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-[#1a1a2e] tracking-tight">Super Admin Dashboard</h2>
              <p className="text-sm text-[#6b6b80] mt-1">Manage academic administrators and oversee participating institutions.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#ffffff] border border-[#d4d4dc] p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold text-[#6b6b80] uppercase tracking-wider">Institutions</span>
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><Building2 className="w-4 h-4" /></div>
                </div>
                <p className="text-3xl font-bold text-[#1a1a2e]">{metrics ? metrics.institutions : '--'}</p>
                <p className="text-xs text-[#6b6b80] font-medium mt-2">Registered domains</p>
              </div>

              <div className="bg-[#ffffff] border border-[#d4d4dc] p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold text-[#6b6b80] uppercase tracking-wider">Administrators</span>
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><UserCog className="w-4 h-4" /></div>
                </div>
                <p className="text-3xl font-bold text-[#1a1a2e]">{metrics ? metrics.administrators : '--'}</p>
                <p className="text-xs text-[#6b6b80] font-medium mt-2">Active roles</p>
              </div>

              <div className="bg-[#ffffff] border border-[#d4d4dc] p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold text-[#6b6b80] uppercase tracking-wider">Active Cycles</span>
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><BookOpen className="w-4 h-4" /></div>
                </div>
                <p className="text-3xl font-bold text-[#1a1a2e]">{metrics ? metrics.activeCycles : '--'}</p>
                <p className="text-xs text-[#6b6b80] font-medium mt-2">Currently open</p>
              </div>

              <div className="bg-[#ffffff] border border-[#d4d4dc] p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold text-[#6b6b80] uppercase tracking-wider">Projects</span>
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Briefcase className="w-4 h-4" /></div>
                </div>
                <p className="text-3xl font-bold text-[#1a1a2e]">{metrics ? metrics.projects : '--'}</p>
                <p className="text-xs text-[#6b6b80] font-medium mt-2">Allocated projects</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-[#ffffff] border border-[#d4d4dc] rounded-2xl p-6 shadow-sm">
                <h3 className="font-bold text-[#1a1a2e] mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <button onClick={() => setActiveTab('admins')} className="w-full flex items-center justify-between p-4 bg-[#f7f7f9] hover:bg-[#ecfdf5] hover:border-[#a7f3d0] border border-[#d4d4dc] rounded-xl transition-colors group">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-[#ffffff] rounded-lg shadow-sm group-hover:text-[#10b981]"><Plus className="w-4 h-4 text-[#6b6b80] group-hover:text-[#10b981]" /></div>
                      <span className="font-medium text-sm text-[#1a1a2e] group-hover:text-[#10b981]">Invite Academic Administrator</span>
                    </div>
                  </button>
                  <button onClick={() => setActiveTab('institutions')} className="w-full flex items-center justify-between p-4 bg-[#f7f7f9] hover:bg-[#e4e4e8] border border-[#d4d4dc] rounded-xl transition-colors group">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-[#ffffff] rounded-lg shadow-sm"><Building2 className="w-4 h-4 text-[#6b6b80]" /></div>
                      <span className="font-medium text-sm text-[#1a1a2e]">View Registered Institutions</span>
                    </div>
                  </button>
                </div>
              </div>

              <div className="bg-[#ffffff] border border-[#d4d4dc] rounded-2xl p-6 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-[#1a1a2e]">Recent Admin Activity</h3>
                  <button className="text-xs font-medium text-[#10b981] hover:text-[#10b981]">View Audit Log</button>
                </div>
                <div className="space-y-4">
                  <div className="flex gap-3 items-start">
                    <div className="w-2 h-2 mt-1.5 rounded-full bg-[#ecfdf5]0 shrink-0"></div>
                    <div>
                      <p className="text-sm font-medium text-[#1a1a2e]">Admin Invited</p>
                      <p className="text-xs text-[#6b6b80]">You invited admin@kiit.ac.in as Academic Admin</p>
                    </div>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="w-2 h-2 mt-1.5 rounded-full bg-slate-300 shrink-0"></div>
                    <div>
                      <p className="text-sm font-medium text-[#1a1a2e]">Cycle Approved</p>
                      <p className="text-xs text-[#6b6b80]">CS6001 approved by admin@iiit.ac.in</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "dashboard" && !access.isSuperAdmin && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-[#1a1a2e] tracking-tight">Academic Dashboard</h2>
              <p className="text-sm text-[#6b6b80] mt-1">Manage academic projects and allocations for <span className="font-semibold text-[#1a1a2e]">{access.institutionName ?? access.domain}</span>.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-[#ffffff] border border-[#d4d4dc] p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold text-[#6b6b80] uppercase tracking-wider">Eligible Students</span>
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><Users className="w-4 h-4" /></div>
                </div>
                <p className="text-3xl font-bold text-[#1a1a2e]">{adminMetrics?.eligibleStudents ?? "—"}</p>
                <p className="text-xs text-[#6b6b80] font-medium mt-2">Active in current cycle</p>
              </div>

              <div className="bg-[#ffffff] border border-[#d4d4dc] p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold text-[#6b6b80] uppercase tracking-wider">Pending Roster Changes</span>
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Clock className="w-4 h-4" /></div>
                </div>
                <p className="text-3xl font-bold text-[#1a1a2e]">{rosterRequests.filter((r) => r.status === "pending").length}</p>
                <p className="text-xs text-amber-600 font-medium mt-2">Requires your approval</p>
              </div>

              <div className="bg-[#ffffff] border border-[#d4d4dc] p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold text-[#6b6b80] uppercase tracking-wider">Allocated Projects</span>
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><Briefcase className="w-4 h-4" /></div>
                </div>
                <p className="text-3xl font-bold text-[#1a1a2e]">{adminMetrics?.allocatedProjects ?? "—"}</p>
                <p className="text-xs text-emerald-600 font-medium mt-2 flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Active Assignments</p>
              </div>
            </div>

            <div className="bg-[#ffffff] border border-[#d4d4dc] rounded-2xl overflow-hidden shadow-sm">
               <div className="p-6 border-b border-[#d4d4dc] flex items-center justify-between bg-[#f7f7f9]/50">
                  <h3 className="font-bold text-[#1a1a2e]">Action Required</h3>
               </div>
               <div className="p-6">
                 {rosterRequests.filter((r) => r.status === "pending").length > 0 ? (
                   <div className="flex items-center justify-between p-4 bg-amber-50 border border-amber-100 rounded-xl">
                      <div className="flex items-center gap-3">
                         <Clock className="w-5 h-5 text-amber-600" />
                         <div>
                            <p className="text-sm font-semibold text-amber-900">Pending Roster Changes</p>
                            <p className="text-xs text-amber-700">Teams are waiting for your approval to modify their rosters.</p>
                         </div>
                      </div>
                      <button onClick={() => setActiveTab("roster")} className="px-4 py-2 bg-[#ffffff] hover:bg-amber-100 text-amber-800 text-xs font-bold rounded-lg border border-amber-200 shadow-sm transition-colors">
                        Review Now
                      </button>
                   </div>
                 ) : (
                   <p className="text-sm text-[#6b6b80] text-center py-4">No immediate actions required.</p>
                 )}
               </div>
            </div>
          </div>
        )}

        {/* =========================================================================
                                    ROSTER REQUESTS 
        ========================================================================= */}
        {activeTab === "roster" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-[#1a1a2e] tracking-tight">Roster Change Requests</h2>
              <p className="text-sm text-[#6b6b80] mt-1">Review and approve team additions, removals, or replacements after project allocation.</p>
            </div>

            {rosterRequests.length === 0 ? (
              renderEmptyState("No pending requests", "All post-allocation student team requests are up to date. You're all caught up!", CheckCircle)
            ) : (
              <div className="bg-[#ffffff] border border-[#d4d4dc] rounded-2xl overflow-hidden shadow-sm divide-y divide-slate-100">
                {rosterRequests.map((req) => (
                  <div key={req.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-[#f7f7f9]/50 transition-colors">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-bold text-[#1a1a2e] text-lg">{req.teams?.name || "Team"}</span>
                        <span className="px-2.5 py-1 text-xs font-mono rounded-lg bg-[#e4e4e8] text-[#6b6b80] border border-[#d4d4dc]">
                          {req.teams?.project_id_code || "Project ID"}
                        </span>
                        <span className="px-2.5 py-1 text-xs font-bold uppercase rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
                          {req.request_type}
                        </span>
                      </div>
                      <div className="text-sm text-[#6b6b80]">
                        Requested by <span className="font-medium text-[#1a1a2e]">{req.requested_by}</span>
                        <p className="mt-1 bg-[#f7f7f9] p-2 rounded border border-[#d4d4dc] text-[#1a1a2e] italic">"{req.reason}"</p>
                      </div>
                      <div className="text-xs font-medium text-[#6b6b80] flex items-center gap-2">
                        <span>Target: <span className="text-[#1a1a2e]">{req.target_student_id}</span></span>
                        {req.replacement_student_id && (
                          <>
                            <span className="text-slate-300">â†’</span>
                            <span>Replacement: <span className="text-[#1a1a2e]">{req.replacement_student_id}</span></span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {req.status === "pending" ? (
                        <>
                          <button
                            disabled={processingId === req.id}
                            onClick={() => handleApproveRosterChange(req.id, "rejected")}
                            className="px-5 py-2.5 bg-[#ffffff] hover:bg-red-50 text-red-600 border border-[#d4d4dc] hover:border-red-200 text-sm font-semibold rounded-xl transition-all disabled:opacity-50 shadow-sm"
                          >
                            Reject
                          </button>
                          <button
                            disabled={processingId === req.id}
                            onClick={() => handleApproveRosterChange(req.id, "approved")}
                            className="px-5 py-2.5 bg-[#10b981] hover:bg-teal-700 text-[#ffffff] text-sm font-semibold rounded-xl transition-all disabled:opacity-50 shadow-sm"
                          >
                            Approve
                          </button>
                        </>
                      ) : (
                        <span className="px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl bg-[#e4e4e8] text-[#6b6b80] border border-[#d4d4dc]">
                          {req.status}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
                                    CYCLES (ELIGIBILITY IMPORT) 
        ========================================================================= */}
        {activeTab === "cycles" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-[#1a1a2e] tracking-tight">Academic Cycles</h2>
                  <p className="text-sm text-[#6b6b80] mt-1">Manage academic cycles for your institution.</p>
                </div>
                <button onClick={() => { setEditingCycle(null); setCycleForm({ name: "", start_date: "", end_date: "", status: "draft" }); setShowCycleModal(true); }} className="px-4 py-2 bg-[#24cdd1] text-white text-sm font-bold rounded-lg shadow-sm hover:bg-[#1fb3b7] transition-colors flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Create Cycle
                </button>
              </div>

              <div className="bg-[#ffffff] border border-[#d4d4dc] rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-[#d4d4dc] bg-[#f7f7f9]/50 flex justify-between items-center">
                  <h3 className="font-bold text-[#1a1a2e]">All Cycles</h3>
                  <span className="px-2 py-1 bg-[#e4e4e8] text-[#1a1a2e] text-xs font-bold rounded-lg">{academicCycles.length} Total</span>
                </div>
                
                {isLoadingCycles ? (
                  <div className="p-8 text-center text-[#6b6b80] text-sm">Loading cycles...</div>
                ) : academicCycles.length === 0 ? (
                  <div className="p-8 text-center text-[#6b6b80] text-sm">No academic cycles found. Create one to get started.</div>
                ) : (
                  <div className="divide-y divide-[#e4e4e8]">
                    {academicCycles.map((cycle: any) => (
                      <div key={cycle.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#f7f7f9] transition-colors">
                        <div>
                          <p className="text-sm font-bold text-[#1a1a2e]">{cycle.name}</p>
                          <div className="flex items-center gap-2 text-xs text-[#6b6b80] mt-1">
                            <span>Start: {cycle.start_date ? new Date(cycle.start_date).toLocaleDateString() : ''}</span>
                            <span>•</span>
                            <span>End: {cycle.end_date ? new Date(cycle.end_date).toLocaleDateString() : ''}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`px-2.5 py-1 text-xs font-bold uppercase rounded-lg border ${
                            cycle.status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                            cycle.status === "completed" ? "bg-blue-50 text-blue-700 border-blue-200" :
                            cycle.status === "archived" ? "bg-slate-50 text-slate-700 border-slate-200" :
                            "bg-amber-50 text-amber-700 border-amber-200"
                          }`}>
                            {cycle.status}
                          </span>
                          <div className="flex items-center gap-2 ml-2 border-l border-slate-200 pl-3">
                            <button onClick={() => { setEditingCycle(cycle); setCycleForm({ name: cycle.name, start_date: cycle.start_date ? cycle.start_date.split("T")[0] : "", end_date: cycle.end_date ? cycle.end_date.split("T")[0] : "", status: cycle.status }); setShowCycleModal(true); }} className="text-xs font-medium text-indigo-600 hover:text-indigo-800">Edit</button>
                            {(cycle.status === "draft" || cycle.status === "archived") && (
                               <button onClick={() => handleDeleteCycle(cycle.id)} className="text-xs font-medium text-red-600 hover:text-red-800">Delete</button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        {activeTab === "communications" && (
           <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-[#1a1a2e] tracking-tight">Communications</h2>
              <p className="text-sm text-[#6b6b80] mt-1">Oversee bulk email delivery status and automated notifications.</p>
            </div>
            {renderEmptyState("Communications Unavailable", "The email delivery backend is operational, but the reporting interface is not currently connected to the AMS worker queue.", Mail)}
          </div>
        )}
        
        {activeTab === "projects" && (
           <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-[#1a1a2e] tracking-tight">Projects Overview</h2>
              <p className="text-sm text-[#6b6b80] mt-1">Monitor project allocations and team assignments.</p>
            </div>
            {renderEmptyState("Projects View Unavailable", "Use the Exports tab to download the Allocation Master report for a full view of projects.", Briefcase)}
          </div>
        )}

        {activeTab === "reports" && (
           <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-[#1a1a2e] tracking-tight">Shared Reports</h2>
              <p className="text-sm text-[#6b6b80] mt-1">View evaluation analytics securely shared by faculty members.</p>
            </div>
            {renderEmptyState("No Shared Reports", "Faculty members have not shared any evaluation dashboards with Academic Administration yet.", FileSpreadsheet)}
          </div>
        )}

      </div>
    
      {/* CYCLE MODAL */}
      {showCycleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">{editingCycle ? "Edit Cycle" : "Create Cycle"}</h3>
              <button onClick={() => setShowCycleModal(false)} className="text-slate-400 hover:text-slate-600">×</button>
            </div>
            <form onSubmit={handleSaveCycle} className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Cycle Name</label>
                <input required type="text" placeholder="e.g. Fall 2026 Capstone" 
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  value={cycleForm.name} onChange={e => setCycleForm({...cycleForm, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Start Date</label>
                  <input type="date" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    value={cycleForm.start_date} onChange={e => setCycleForm({...cycleForm, start_date: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">End Date</label>
                  <input type="date" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    value={cycleForm.end_date} onChange={e => setCycleForm({...cycleForm, end_date: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                  value={cycleForm.status} onChange={e => setCycleForm({...cycleForm, status: e.target.value})}>
                  <option value="draft">Draft (Setup phase)</option>
                  <option value="active">Active (In progress)</option>
                  <option value="completed">Completed (Evaluations done)</option>
                  <option value="archived">Archived (Historical)</option>
                </select>
              </div>
              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button type="button" onClick={() => setShowCycleModal(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm font-bold text-white bg-[#24cdd1] hover:bg-[#1fb3b7] rounded-lg">Save Cycle</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AmsShell>
  );
}




