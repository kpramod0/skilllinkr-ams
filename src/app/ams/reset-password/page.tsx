"use client";

import React, { useState, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { ShieldCheck, Mail, Lock, Eye, EyeOff, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function AmsResetPasswordPage() {
    const [step, setStep] = useState<1 | 2>(1);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    
    const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

    const supabase = createClient();

    // STEP 1: Check admin eligibility and send OTP
    const handleRequestOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isLoading) return;
        
        try {
            setIsLoading(true);
            setError("");
            
            const res = await fetch("/api/ams/auth/check-admin-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });
            
            const data = await res.json();
            
            if (!res.ok || !data.isAuthorized) {
                throw new Error(data.error || "You are not registered. Contact the Authority of SkillLinkr.");
            }

            const sendRes = await fetch("/api/ams/auth/reset-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email })
            });
            const sendData = await sendRes.json();
            if (!sendRes.ok) throw new Error(sendData.error || "Failed to send OTP");
            
            setStep(2);
        } catch (err: any) {
            console.error(err);
            setError(err.message || "An error occurred.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleOtpChange = (index: number, value: string) => {
        if (!/^[0-9a-zA-Z]*$/.test(value)) return; // Allow alphanumeric just in case
        
        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        // Auto focus next input
        if (value !== '' && index < 5) {
            otpRefs.current[index + 1]?.focus();
        }
    };

    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && otp[index] === '' && index > 0) {
            otpRefs.current[index - 1]?.focus();
        }
    };

    // STEP 2: Verify OTP and Set Password
    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isLoading) return;
        
        const tokenStr = otp.join('');
        if (tokenStr.length !== 6) {
            setError("Please enter the complete 6-digit verification code.");
            return;
        }

        if (newPassword !== confirmPassword) {
            setError("New passwords do not match.");
            return;
        }

        if (newPassword.length < 8) {
            setError("Password must be at least 8 characters long.");
            return;
        }
        
        try {
            setIsLoading(true);
            setError("");
            setSuccessMessage("");

            // Only verify OTP if we don't have a session yet
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                const { error: verifyError } = await supabase.auth.verifyOtp({
                    email,
                    token: tokenStr,
                    type: 'recovery'
                });
                if (verifyError) throw verifyError;
            }

            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword
            });
            if (updateError) throw updateError;
            
            setSuccessMessage("Password reset successfully! Redirecting...");
            
            setTimeout(() => {
                window.location.href = "/ams/login";
            }, 2000);
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Invalid verification code or failed to update password.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex bg-[#F0F0F3] text-slate-900" data-theme="light">
            <style suppressHydrationWarning>{`
                .ams-login-bg { background-color: #F0F0F3 !important; }
                .ams-card-bg { background-color: #ffffff !important; }
                .ams-text-dark { color: #1a1a2e !important; }
                .ams-text-muted { color: #6b6b80 !important; }
                .ams-border { border-color: #e4e4e8 !important; }
                .ams-input-bg { background-color: #f7f7f9 !important; }
            `}</style>
            
            <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 lg:p-12 ams-login-bg relative z-10">
                <div className="w-full max-w-[460px] p-8 sm:p-10 rounded-3xl ams-card-bg border ams-border shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                    {step === 1 && (
                        <>
                            <Link href="/ams/login" className="inline-flex items-center text-[13px] font-semibold text-slate-500 hover:text-slate-800 transition-colors mb-6">
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Back to Login
                            </Link>

                            <div className="mb-8">
                                <h2 className="text-[28px] font-bold ams-text-dark mb-3 tracking-tight">Forgot Password</h2>
                                <p className="text-[15px] ams-text-muted">
                                    Enter your registered admin email address to receive a verification code.
                                </p>
                            </div>

                            {error && (
                                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                                    <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                                    <p className="text-sm text-red-700 font-medium">{error}</p>
                                </div>
                            )}

                            <form onSubmit={handleRequestOtp} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[14px] font-medium ams-text-dark">Email address</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-800" />
                                        <input 
                                            type="email" 
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="w-full pl-10 pr-4 py-3 ams-input-bg border ams-border rounded-xl ams-text-dark focus:outline-none focus:ring-2 focus:ring-[#28c5cd] focus:bg-white transition-all text-sm placeholder:text-slate-400 placeholder:font-normal"
                                            placeholder="admin@university.edu"
                                        />
                                    </div>
                                </div>
                                <Button
                                    type="submit"
                                    className="w-full bg-[#24cdd1] hover:bg-[#1dbbc0] text-[#0f2d30] font-bold transition-all h-12 rounded-xl text-[15px]"
                                    disabled={isLoading}
                                >
                                    {isLoading ? "Checking..." : "Send Verification Code"}
                                </Button>
                            </form>
                        </>
                    )}

                    {step === 2 && (
                        <>
                            <div className="mb-8">
                                <h2 className="text-[28px] font-bold ams-text-dark mb-3 tracking-tight">Set new password</h2>
                                <p className="text-[15px] ams-text-muted">
                                    Enter the verification code sent to {email}
                                </p>
                            </div>

                            {error && (
                                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                                    <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                                    <p className="text-sm text-red-700 font-medium">{error}</p>
                                </div>
                            )}

                            {successMessage && (
                                <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
                                    <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                                    <p className="text-sm text-emerald-700 font-medium">{successMessage}</p>
                                </div>
                            )}

                            <form onSubmit={handleResetPassword} className="space-y-6">
                                {/* Verification Code */}
                                <div className="space-y-2">
                                    <label className="text-[14px] font-medium ams-text-dark">Verification Code</label>
                                    <div className="flex justify-between gap-2 max-w-full">
                                        {otp.map((digit, i) => (
                                            <input 
                                                key={i}
                                                type="text"
                                                maxLength={1}
                                                value={digit}
                                                onChange={(e) => handleOtpChange(i, e.target.value)}
                                                onKeyDown={(e) => handleOtpKeyDown(i, e)}
                                                ref={(el: any) => otpRefs.current[i] = el}
                                                className="w-full aspect-square text-center text-[22px] font-bold ams-input-bg border ams-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#28c5cd] focus:bg-white transition-all ams-text-dark max-w-[56px]"
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* New Password */}
                                <div className="space-y-2">
                                    <label className="text-[14px] font-medium ams-text-dark">New Password</label>
                                    <div className="relative">
                                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-800" />
                                        <input 
                                            type={showPassword ? "text" : "password"} 
                                            required
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            className="w-full pl-10 pr-11 py-3 ams-input-bg border ams-border rounded-xl ams-text-dark focus:outline-none focus:ring-2 focus:ring-[#28c5cd] focus:bg-white transition-all text-sm placeholder:text-slate-400 placeholder:font-normal"
                                            placeholder="Enter new password"
                                        />
                                        <button 
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-800 hover:text-slate-600 rounded-lg focus:outline-none transition-colors"
                                        >
                                            {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                                        </button>
                                    </div>
                                </div>

                                {/* Confirm Password */}
                                <div className="space-y-2">
                                    <label className="text-[14px] font-medium ams-text-dark">Confirm Password</label>
                                    <div className="relative">
                                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-800" />
                                        <input 
                                            type={showConfirmPassword ? "text" : "password"} 
                                            required
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="w-full pl-10 pr-11 py-3 ams-input-bg border ams-border rounded-xl ams-text-dark focus:outline-none focus:ring-2 focus:ring-[#28c5cd] focus:bg-white transition-all text-sm placeholder:text-slate-400 placeholder:font-normal"
                                            placeholder="Confirm new password"
                                        />
                                        <button 
                                            type="button"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                            className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-800 hover:text-slate-600 rounded-lg focus:outline-none transition-colors"
                                        >
                                            {showConfirmPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                                        </button>
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    className="w-full bg-[#24cdd1] hover:bg-[#1dbbc0] text-[#0f2d30] font-bold transition-all h-12 rounded-xl text-[15px] flex items-center justify-center gap-2"
                                    disabled={isLoading}
                                >
                                    {isLoading ? "Processing..." : "Reset password"}
                                    {!isLoading && <ArrowRight className="w-[18px] h-[18px]" />}
                                </Button>
                            </form>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
