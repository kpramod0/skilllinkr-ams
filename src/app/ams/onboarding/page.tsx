"use client";

import React, { useState, useEffect, useRef } from "react";
import { ShieldCheck, CheckCircle, AlertCircle, Key, User, Building, Briefcase, Phone, Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";

export default function AmsOnboardingPage() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [adminData, setAdminData] = useState<any>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [otpArray, setOtpArray] = useState(["", "", "", "", "", ""]);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [otpSent, setOtpSent] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [updateName, setUpdateName] = useState("");
  const [updatePosition, setUpdatePosition] = useState("");
  const [updateContactNo, setUpdateContactNo] = useState("");
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchOnboardingData();
  }, []);

  const fetchOnboardingData = async () => {
    try {
      const res = await fetch("/api/ams/onboarding/check");
      const data = await res.json();
      if (res.ok && data.status === "pending_onboarding") {
        setUser(data.user);
        setAdminData(data.adminData);
        setUpdateName(data.adminData.name || "");
        setUpdatePosition(data.adminData.position || "");
        setUpdateContactNo(data.adminData.contact_no || "");
          
          // Auto-trigger OTP sending if not already sent
          if (!otpSent && !isSendingOtp) {
            fetch("/api/ams/onboarding/send-otp", { method: "POST" })
              .then(res => res.json())
              .then(otpData => {
                if (otpData.success) {
                  setOtpSent(true);
                  setMessage({ text: otpData.message || "Verification code automatically sent to your email!", type: "success" });
                }
              })
              .catch(err => console.error("Auto-OTP Error:", err));
          }
      } else {
        router.push("/ams");
      }
    } catch (err) {
      console.error(err);
      router.push("/ams");
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    try {
      setIsSendingOtp(true);
      setMessage(null);
      const res = await fetch("/api/ams/onboarding/send-otp", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setOtpSent(true);
        setMessage({ text: data.message || "Verification code sent!", type: "success" });
      } else {
        setMessage({ text: data.error || "Failed to send code", type: "error" });
      }
    } catch (err: any) {
      setMessage({ text: "An error occurred while sending code", type: "error" });
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleCompleteOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpSent) {
      setMessage({ text: "Please request a verification code first.", type: "error" });
      return;
    }
    const finalOtp = otpArray.join("");
    if (finalOtp.length !== 6) {
      setMessage({ text: "Please enter the complete 6-digit code.", type: "error" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ text: "Passwords do not match.", type: "error" });
      return;
    }
    if (newPassword.length < 8) {
      setMessage({ text: "Password must be at least 8 characters.", type: "error" });
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/ams/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword, otp: finalOtp, name: updateName, position: updatePosition, contactNo: updateContactNo }),
      });
      const data = await res.json();

      if (res.ok) {
        setMessage({ text: "Onboarding completed successfully!", type: "success" });
        setTimeout(() => {
          router.push("/ams");
        }, 1500);
      } else {
        setMessage({ text: data.error || "Failed to complete onboarding", type: "error" });
      }
    } catch (err: any) {
      setMessage({ text: "An error occurred", type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return; // Prevent multiple chars
    const newOtp = [...otpArray];
    newOtp[index] = value;
    setOtpArray(newOtp);

    // Auto-focus next input
    if (value !== "" && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && otpArray[index] === "" && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F0F0F3]">
        <div className="w-10 h-10 border-4 border-[#10b981] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F0F0F3] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-2xl bg-[#ffffff] border border-[#d4d4dc] rounded-2xl shadow-xl shadow-slate-200/50 overflow-hidden">
        
        <div className="bg-[#1a1a2e] p-8 text-center border-b-4 border-[#10b981]">
          <div className="w-16 h-16 bg-[#ffffff]/10 text-[#10b981] rounded-2xl flex items-center justify-center mx-auto mb-4 border border-[#ffffff]/20">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-[#ffffff] tracking-tight">Complete Administrator Onboarding</h2>
          <p className="text-[#a1a1aa] text-sm mt-2">Welcome to the Academic Management System</p>
        </div>

        <div className="p-8">
          {message && (
            <div className={`mb-6 p-4 rounded-xl border text-sm flex items-center gap-3 shadow-sm ${
              message.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800"
            }`}>
              {message.type === "success" ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              <span className="font-medium">{message.text}</span>
            </div>
          )}

          <form onSubmit={handleCompleteOnboarding} className="space-y-8">
            <div>
              <h3 className="font-bold text-[#1a1a2e] mb-4 text-lg border-b border-[#d4d4dc] pb-2">1. Verify Your Information</h3>
              <p className="text-sm text-[#6b6b80] mb-4">This information was provisioned by your Super Administrator.</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#6b6b80] uppercase tracking-wider flex items-center gap-2"><User className="w-4 h-4"/> Full Name</label>
                  <input type="text" value={updateName} onChange={e => setUpdateName(e.target.value)} required className="w-full bg-[#ffffff] border border-[#d4d4dc] rounded-xl px-3 py-2.5 text-sm focus:border-[#10b981] focus:ring-1 focus:ring-teal-500 outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#6b6b80] uppercase tracking-wider flex items-center gap-2"><Briefcase className="w-4 h-4"/> Position</label>
                  <input type="text" value={updatePosition} onChange={e => setUpdatePosition(e.target.value)} required className="w-full bg-[#ffffff] border border-[#d4d4dc] rounded-xl px-3 py-2.5 text-sm focus:border-[#10b981] focus:ring-1 focus:ring-teal-500 outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#6b6b80] uppercase tracking-wider flex items-center gap-2"><Phone className="w-4 h-4"/> Contact No</label>
                  <input type="text" value={updateContactNo} onChange={e => setUpdateContactNo(e.target.value)} className="w-full bg-[#ffffff] border border-[#d4d4dc] rounded-xl px-3 py-2.5 text-sm focus:border-[#10b981] focus:ring-1 focus:ring-teal-500 outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#6b6b80] uppercase tracking-wider flex items-center gap-2"><Building className="w-4 h-4"/> Institution (Fixed)</label>
                  <input type="text" value={adminData?.institution?.name || "Assigned by Super Admin"} disabled className="w-full bg-[#f7f7f9] border border-[#d4d4dc] rounded-xl px-3 py-2.5 text-sm text-[#6b6b80] cursor-not-allowed outline-none" />
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-bold text-[#1a1a2e] mb-4 text-lg border-b border-[#d4d4dc] pb-2">2. Secure Your Account</h3>
              <p className="text-sm text-[#6b6b80] mb-4">Please verify your email and replace your temporary password with a strong, permanent password.</p>
              
              <div className="space-y-4">
                <div className="space-y-1.5 relative">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#6b6b80] uppercase tracking-wider">Email Verification Code</label>
                    {!otpSent && (
                      <button 
                        type="button" 
                        onClick={handleSendOtp}
                        disabled={isSendingOtp}
                        className="text-xs font-bold text-[#10b981] hover:text-teal-700 disabled:opacity-50"
                      >
                        {isSendingOtp ? "Sending..." : "Send Code"}
                      </button>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-3 mt-3">
                    {[0, 1, 2, 3, 4, 5].map((index) => (
                      <input
                        key={index}
                        ref={(el) => { otpRefs.current[index] = el; }}
                        type="text"
                        maxLength={1}
                        value={otpArray[index]}
                        onChange={(e) => handleOtpChange(index, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(index, e)}
                        disabled={!otpSent}
                        className="w-12 h-14 text-center text-xl font-bold bg-[#ffffff] border border-[#d4d4dc] rounded-xl focus:border-[#10b981] focus:ring-1 focus:ring-teal-500 outline-none transition-shadow disabled:bg-[#f7f7f9] disabled:text-[#6b6b80] text-[#1a1a2e]"
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5 relative mt-4">
                  <label className="text-xs font-bold text-[#6b6b80] uppercase tracking-wider">New Password</label>
                  <div className="relative">
                    <Key className="w-5 h-5 text-[#8e8e9f] absolute left-4 top-1/2 -translate-y-1/2" />
                    <input 
                      required
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      disabled={!otpSent}
                      className="w-full bg-[#ffffff] border border-[#d4d4dc] rounded-xl pl-12 pr-12 py-3.5 text-[15px] text-[#1a1a2e] placeholder:text-[#a1a1aa] focus:border-[#10b981] focus:ring-1 focus:ring-teal-500 outline-none transition-shadow disabled:bg-[#f7f7f9] disabled:text-[#6b6b80]"
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8e8e9f] hover:text-[#1a1a2e] transition-colors disabled:opacity-50"
                      disabled={!otpSent}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5 relative">
                  <label className="text-xs font-bold text-[#6b6b80] uppercase tracking-wider">Confirm Password</label>
                  <div className="relative">
                    <Key className="w-5 h-5 text-[#8e8e9f] absolute left-4 top-1/2 -translate-y-1/2" />
                    <input 
                      required
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      disabled={!otpSent}
                      className="w-full bg-[#ffffff] border border-[#d4d4dc] rounded-xl pl-12 pr-12 py-3.5 text-[15px] text-[#1a1a2e] placeholder:text-[#a1a1aa] focus:border-[#10b981] focus:ring-1 focus:ring-teal-500 outline-none transition-shadow disabled:bg-[#f7f7f9] disabled:text-[#6b6b80]"
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8e8e9f] hover:text-[#1a1a2e] transition-colors disabled:opacity-50"
                      disabled={!otpSent}
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <button 
              type="submit"
              disabled={isSubmitting || !newPassword || !confirmPassword || otpArray.join("").length !== 6 || !otpSent}
              className="w-full py-3.5 bg-[#10b981] hover:bg-teal-700 text-[#ffffff] text-[15px] font-bold rounded-xl transition-all shadow-sm shadow-teal-500/20 disabled:opacity-50 flex items-center justify-center gap-2 mt-8"
            >
              {isSubmitting ? "Completing..." : "Verify OTP & Update Password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
