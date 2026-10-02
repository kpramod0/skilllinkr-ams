"use client";

import React, { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { ShieldCheck, Eye, EyeOff, Mail, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function AmsLoginPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const supabase = createClient();

    const handleGoogleLogin = async () => {
        if (isLoading) return;
        try {
            setIsLoading(true);
            setError("");

            const siteUrl = typeof window !== 'undefined'
                ? window.location.origin
                : (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.skilllinkr.com');

            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${siteUrl}/auth/callback?intent=ams`,
                    queryParams: { prompt: 'select_account' },
                }
            });
            
            if (error) throw error;
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Failed to initialize Google login");
            setIsLoading(false);
        }
    };

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isLoading) return;
        
        try {
            setIsLoading(true);
            setError("");

            // Append .ams to separate the identity from Main SkillLinkr
            const amsAuthEmail = email.toLowerCase().trim().endsWith(".ams") 
                ? email.toLowerCase().trim() 
                : `${email.toLowerCase().trim()}.ams`;

            const { data, error } = await supabase.auth.signInWithPassword({
                email: amsAuthEmail,
                password,
            });

            if (error) throw error;
            
            window.location.href = "/ams";
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Invalid login credentials");
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex bg-[#F0F0F3] text-slate-900" data-theme="light">
            <style suppressHydrationWarning>{`
                /* Force light theme colors bypassing uncompiled Tailwind arbitrary values */
                .ams-login-bg { background-color: #F0F0F3 !important; }
                .ams-card-bg { background-color: #ffffff !important; }
                .ams-text-dark { color: #1a1a2e !important; }
                .ams-text-muted { color: #6b6b80 !important; }
                .ams-border { border-color: #e4e4e8 !important; }
                .ams-input-bg { background-color: #f7f7f9 !important; }
            `}</style>
            
            {/* Left Panel - Branding */}
            <div className="hidden lg:flex flex-col flex-1 p-12 xl:p-24 relative overflow-hidden bg-gradient-to-br from-emerald-50 to-[#F0F0F3]">
                <div className="relative z-10 max-w-2xl mt-12">
                    <div className="flex items-center gap-2 mb-20">
                        <ShieldCheck className="w-8 h-8 text-[#10b981]" />
                        <span className="text-2xl font-bold ams-text-dark tracking-tight">SkillLinkr <span className="font-normal text-slate-600">AMS</span></span>
                    </div>
                    <div className="space-y-6">
                        <p className="text-xs font-bold tracking-[0.2em] text-[#10b981] uppercase">Welcome Back</p>
                        <h1 className="text-5xl xl:text-6xl font-extrabold ams-text-dark leading-[1.1] tracking-tight">
                            Administrative<br />Management
                        </h1>
                        <p className="text-lg ams-text-muted max-w-md mt-6 leading-relaxed">
                            The centralized administrative platform for universities to oversee academic cycles, configure evaluations, and securely manage assignments.
                        </p>
                    </div>
                </div>
                
                {/* Decorative background elements */}
                <div className="absolute top-0 right-0 -mr-32 -mt-32 w-[500px] h-[500px] rounded-full bg-emerald-100/50 blur-3xl z-0 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 -ml-32 -mb-32 w-[600px] h-[600px] rounded-full bg-cyan-100/30 blur-3xl z-0 pointer-events-none"></div>
            </div>

            {/* Right Panel - Login Form */}
            <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 lg:p-12 ams-login-bg lg:bg-transparent min-h-screen relative z-10">
                {/* Mobile header (only visible on small screens) */}
                <div className="lg:hidden flex items-center gap-2 mb-8">
                    <ShieldCheck className="w-8 h-8 text-[#10b981]" />
                    <span className="text-2xl font-bold ams-text-dark tracking-tight">SkillLinkr <span className="font-normal text-slate-600">AMS</span></span>
                </div>

                <div className="w-full max-w-md p-8 sm:p-10 rounded-3xl ams-card-bg border ams-border shadow-xl">
                    <div className="mb-8">
                        <h2 className="text-[28px] font-bold ams-text-dark mb-3 tracking-tight">Welcome back</h2>
                        <p className="text-[15px] ams-text-muted">
                            Log in to manage operations for your institution.
                        </p>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                            <div className="w-5 h-5 text-red-500 shrink-0 mt-0.5">⚠️</div>
                            <p className="text-sm text-red-700 font-medium">{error}</p>
                        </div>
                    )}

                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleGoogleLogin}
                        className="w-full bg-white border ams-border hover:bg-slate-50 ams-text-dark transition-all h-12 rounded-xl font-semibold shadow-sm flex items-center justify-center gap-3"
                        disabled={isLoading}
                    >
                        <svg className="h-5 w-5" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        Continue with Google
                    </Button>

                    <div className="relative flex items-center py-7">
                        <div className="flex-grow border-t ams-border"></div>
                        <span className="flex-shrink-0 mx-4 text-slate-400 text-[11px] font-bold tracking-widest uppercase">Or continue with email</span>
                        <div className="flex-grow border-t ams-border"></div>
                    </div>

                    <form onSubmit={handleEmailLogin} className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-[13px] font-bold ams-text-dark">Email address</label>
                            <div className="relative">
                                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-400" />
                                <input 
                                    type="email" 
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-11 pr-4 py-3 ams-input-bg border ams-border rounded-xl ams-text-dark focus:outline-none focus:ring-2 focus:ring-[#10b981] focus:bg-white transition-all text-sm font-medium placeholder:text-slate-400 placeholder:font-normal"
                                    placeholder="you@university.edu"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[13px] font-bold ams-text-dark">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-400" />
                                <input 
                                    type={showPassword ? "text" : "password"} 
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-11 pr-11 py-3 ams-input-bg border ams-border rounded-xl ams-text-dark focus:outline-none focus:ring-2 focus:ring-[#10b981] focus:bg-white transition-all text-sm font-medium placeholder:text-slate-400 placeholder:font-normal"
                                    placeholder="Enter your password"
                                />
                                <button 
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-lg focus:outline-none transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                                </button>
                            </div>
                            <div className="flex justify-end pt-1">
                                <Link href="/ams/reset-password" className="text-[13px] font-bold text-[#10b981] hover:text-emerald-700 transition-colors">
                                    Forgot password?
                                </Link>
                            </div>
                        </div>

                        <Button
                            type="submit"
                            className="w-full bg-[#10b981] hover:bg-emerald-600 text-white font-bold transition-all h-12 rounded-xl shadow-[0_4px_14px_0_rgba(16,185,129,0.39)] hover:shadow-[0_6px_20px_rgba(16,185,129,0.23)] hover:-translate-y-[1px] active:translate-y-0"
                            disabled={isLoading}
                        >
                            Log in
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    );
}
