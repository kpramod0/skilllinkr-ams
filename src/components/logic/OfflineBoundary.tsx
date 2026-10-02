"use client";

import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function OfflineBoundary() {
    const [isOffline, setIsOffline] = useState(false);
    const [isChecking, setIsChecking] = useState(false);
    const router = useRouter();

    useEffect(() => {
        // Initial check
        if (typeof window !== 'undefined') {
            setIsOffline(!navigator.onLine);
        }

        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const checkTrueNetwork = async () => {
        if (!navigator.onLine) return false;
        try {
            // Fetch a lightweight resource to confirm real connectivity
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 5000);
            
            const response = await fetch('/api/health?_=' + Date.now(), {
                method: 'GET',
                signal: controller.signal,
                cache: 'no-store'
            });
            clearTimeout(id);
            return response.ok;
        } catch (e) {
            return false;
        }
    };

    const handleRetry = async () => {
        setIsChecking(true);
        const online = await checkTrueNetwork();
        
        if (online) {
            // Network restored
            setIsOffline(false);
            setIsChecking(false);
            
            // Reload the current route context
            router.refresh();
        } else {
            // Still offline
            setTimeout(() => {
                setIsChecking(false);
            }, 800);
        }
    };

    if (!isOffline) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black text-white p-6 overflow-hidden">
            {/* Background particles/glow */}
            <div 
                className="absolute inset-0 pointer-events-none"
                style={{
                    backgroundImage: `
                        radial-gradient(circle at 15% 50%, rgba(0, 255, 204, 0.08) 0%, transparent 50%),
                        radial-gradient(circle at 85% 30%, rgba(0, 255, 204, 0.05) 0%, transparent 50%)
                    `
                }}
            />

            <div className="relative z-10 flex flex-col items-center max-w-sm w-full text-center">
                {/* Illustration */}
                <div className="relative w-64 h-64 mb-6 flex items-center justify-center">
                    <svg className="w-full h-full drop-shadow-[0_0_20px_rgba(0,255,204,0.4)]" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <linearGradient id="cloudGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#00D2FF" />
                            <stop offset="100%" stopColor="#22E58C" />
                            </linearGradient>
                        </defs>
                        
                        {/* Cloud Body */}
                        <path d="M50 110 C 30 110, 20 90, 30 70 C 40 50, 60 50, 70 50 C 80 30, 110 20, 130 40 C 150 40, 170 50, 170 70 C 180 90, 170 110, 150 110 Z" 
                                stroke="url(#cloudGrad)" strokeWidth="6" fill="rgba(0,0,0,0.8)" />
                                
                        {/* Sad Eyes */}
                        <path d="M70 75 Q 80 65, 90 75" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" fill="none" />
                        <path d="M110 75 Q 120 65, 130 75" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" fill="none" />
                        <circle cx="80" cy="82" r="6" fill="#ffffff" />
                        <circle cx="120" cy="82" r="6" fill="#ffffff" />
                        <circle cx="82" cy="80" r="2" fill="#000000" />
                        <circle cx="122" cy="80" r="2" fill="#000000" />
                        
                        {/* Tears */}
                        <path d="M75 95 L 70 100" stroke="#00FFCC" strokeWidth="3" strokeLinecap="round" />
                        <path d="M85 97 L 80 102" stroke="#00FFCC" strokeWidth="3" strokeLinecap="round" />
                        <path d="M115 97 L 120 102" stroke="#00FFCC" strokeWidth="3" strokeLinecap="round" />
                        <path d="M125 95 L 130 100" stroke="#00FFCC" strokeWidth="3" strokeLinecap="round" />
                        
                        {/* Sad Mouth */}
                        <path d="M95 90 Q 100 85, 105 90" stroke="#00D2FF" strokeWidth="4" strokeLinecap="round" fill="none" />
                        
                        {/* Broken Link */}
                        <path d="M60 150 C 50 160, 70 180, 80 170 L 95 155 C 105 145, 95 130, 85 140" 
                                stroke="#00D2FF" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                                
                        <path d="M140 150 C 150 160, 130 180, 120 170 L 105 155 C 95 145, 105 130, 115 140" 
                                stroke="#22E58C" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                                
                        {/* Breaking sparks */}
                        <line x1="100" y1="125" x2="100" y2="135" stroke="#22E58C" strokeWidth="3" strokeLinecap="round" />
                        <line x1="90" y1="130" x2="85" y2="135" stroke="#00D2FF" strokeWidth="3" strokeLinecap="round" />
                        <line x1="110" y1="130" x2="115" y2="135" stroke="#22E58C" strokeWidth="3" strokeLinecap="round" />
                        <line x1="100" y1="175" x2="100" y2="165" stroke="#22E58C" strokeWidth="3" strokeLinecap="round" />
                        
                        {/* Background shadow below broken link */}
                        <ellipse cx="100" cy="185" rx="30" ry="4" fill="rgba(255,255,255,0.1)" />
                    </svg>
                </div>

                <h1 className="text-3xl font-bold mb-4 leading-tight">
                    No internet <span className="text-[#00FFCC]">connection</span>
                </h1>
                
                <p className="text-gray-400 mb-10 text-[15px] leading-relaxed max-w-[320px]">
                    Looks like <strong className="text-[#00FFCC] font-semibold">SkillLinkr</strong> lost the link.<br />
                    Check your connection and try again.
                </p>

                <button 
                    onClick={handleRetry}
                    disabled={isChecking}
                    className="w-full max-w-[300px] py-4 px-8 rounded-xl font-bold text-black flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100 shadow-[0_4px_20px_rgba(0,255,204,0.3)]"
                    style={{ background: 'linear-gradient(90deg, #22E58C 0%, #00D2FF 100%)' }}
                >
                    <RefreshCw className={`w-5 h-5 ${isChecking ? 'animate-spin' : ''}`} strokeWidth={2.5} />
                    <span>{isChecking ? 'Checking connection...' : 'Try again'}</span>
                </button>
            </div>
        </div>
    );
}
