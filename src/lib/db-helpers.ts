
import { supabaseAdmin } from './supabase-admin';
export type UserProfile = any;

import crypto from 'crypto';

// Secure helper for OTP hashing (prevents plain-text OTPs in DB)
function hashOTP(otp: string): string {
    return crypto.createHash('sha256').update(otp).digest('hex');
}

// Use Database for OTP storage to support serverless (AWS Amplify)
export const otps = {
    // ---------------------------------------------------------
    // PASSWORD RESET FLOW
    // ---------------------------------------------------------
    setReset: async (email: string, otp: string) => {
        const otp_hash = hashOTP(otp);
        const { error } = await supabaseAdmin
            .from('password_reset_otps')
            .upsert({
                email: email.toLowerCase().trim(),
                otp_hash,
                attempts: 0,
                expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
            }, { onConflict: 'email' });

        if (error) console.error("[DB] Failed to save password reset record", error);
    },
    getReset: async (email: string) => {
        const { data, error } = await supabaseAdmin
            .from('password_reset_otps')
            .select('email, otp_hash, attempts, created_at, expires_at')
            .eq('email', email.toLowerCase().trim())
            .single();

        if (error || !data) return null;
        if (new Date() > new Date(data.expires_at)) {
            await supabaseAdmin.from('password_reset_otps').delete().eq('email', email.toLowerCase().trim());
            return null;
        }
        return data;
    },
    incrementResetAttempt: async (email: string) => {
        const normEmail = email.toLowerCase().trim();
        try {
            const { error } = await supabaseAdmin.rpc('increment_reset_otp_attempts', { target_email: normEmail });
            if (!error) return;
        } catch {
            // Fall through to direct SQL update
        }

        // Direct SQL fallback if RPC is unavailable
        const { data } = await supabaseAdmin
            .from('password_reset_otps')
            .select('attempts')
            .eq('email', normEmail)
            .single();
        if (data) {
            const nextAttempts = (data.attempts || 0) + 1;
            await supabaseAdmin
                .from('password_reset_otps')
                .update({ attempts: nextAttempts })
                .eq('email', normEmail);
        }
    },
    deleteReset: async (email: string) => {
        await supabaseAdmin.from('password_reset_otps').delete().eq('email', email.toLowerCase().trim());
    },

    // Database-backed, concurrency-safe atomic consume operation
    consumeReset: async (email: string, otp: string) => {
        const normEmail = email.toLowerCase().trim();
        const otp_hash = hashOTP(otp);
        const nowIso = new Date().toISOString();

        // 1. Try DB RPC consume_password_reset_otp first if available
        try {
            const { data, error } = await supabaseAdmin.rpc('consume_password_reset_otp', {
                p_email: normEmail,
                p_otp_hash: otp_hash
            });
            if (!error && data && data.length > 0) {
                const res = data[0];
                return {
                    success: res.consumed === true,
                    errorCode: res.error_code || (res.consumed ? 'SUCCESS' : 'INVALID')
                };
            }
        } catch {
            // Fall back to direct atomic SQL query
        }

        // 2. Direct atomic query: DELETE WHERE email AND otp_hash AND expires_at > NOW() AND attempts < 5 RETURNING *
        const { data: deletedRows, error: deleteErr } = await supabaseAdmin
            .from('password_reset_otps')
            .delete()
            .eq('email', normEmail)
            .eq('otp_hash', otp_hash)
            .gte('expires_at', nowIso)
            .lt('attempts', 5)
            .select('email, created_at, expires_at');

        if (!deleteErr && deletedRows && deletedRows.length === 1) {
            // Atomic winner! Exactly one request successfully consumed the reset code.
            return { success: true, errorCode: 'SUCCESS' };
        }

        // Inspect why atomic deletion failed:
        const current = await otps.getReset(normEmail);
        if (!current) {
            return { success: false, errorCode: 'INVALID_OR_CONSUMED' };
        }
        if (current.attempts >= 5) {
            await otps.deleteReset(normEmail);
            return { success: false, errorCode: 'TOO_MANY_ATTEMPTS' };
        }
        // Wrong OTP code: increment attempt counter safely
        await otps.incrementResetAttempt(normEmail);
        return { success: false, errorCode: 'INVALID_CODE' };
    },

    // Export verify utility for use in routes
    verifyHash: (otp: string, hash: string) => hashOTP(otp) === hash
};

export const verified = {
    add: (email: string) => { /* verified users logic if needed */ },
    has: (email: string) => false,
};

// Convert flat DB row → nested UserProfile
export function rowToProfile(row: any): UserProfile {
    // Collect photos from all possible field names found in the database
    let photos: string[] = [];
    
    if (Array.isArray(row.photos)) {
        photos = [...row.photos];
    } else if (typeof row.photos === 'string' && row.photos.startsWith('[')) {
        try { photos = JSON.parse(row.photos); } catch { }
    }

    // Comprehensive fallbacks for various column names used in different parts of the schema
    const fallbacks = [
        row.profile_photo_url,
        row.photo_url,
        row.avatar_url,
        row.profile_photo,
        row.photo,
        row.image_url,
        row.profile_image,
        // Also check inside row if it's already semi-parsed
        row.visuals?.photos?.[0],
        row.user?.photos?.[0]
    ];

    fallbacks.forEach(url => {
        if (url && typeof url === 'string' && url.length > 5 && !photos.includes(url)) {
            photos.push(url);
        }
    });

    // Ensure we don't have duplicates or empty strings
    photos = photos.filter(p => p && typeof p === 'string' && p.length > 5);

    // Check if it's already nested (unlikely but safe)
    if (row.visuals?.photos && Array.isArray(row.visuals.photos)) {
        row.visuals.photos.forEach((p: string) => {
            if (p && !photos.includes(p)) photos.push(p);
        });
    }

    let parsedPrefs: any = {};
    let rawCollegeFilter = row.college_filter || 'same';
    
    if (typeof rawCollegeFilter === 'string' && rawCollegeFilter.startsWith('{')) {
        try {
            parsedPrefs = JSON.parse(rawCollegeFilter);
            rawCollegeFilter = parsedPrefs.collegeFilter || 'same';
        } catch(e) {}
    }

    return {
        id: row.id,
        personal: {
            firstName: (row.first_name || '').trim(),
            middleName: row.middle_name ? row.middle_name.trim() : undefined,
            lastName: (row.last_name || '').trim(),
            gender: row.gender || 'Other',
            age: row.age || 18,
            branch: row.branch || undefined,
            college: row.college || undefined,
            collegeFull: row.college_full || undefined,
            city: row.city || undefined,
            state: row.state || undefined,
            emailDomain: row.email_domain || undefined,
            role: row.role || undefined,
        },
        professionalDetails: {
            year: row.year || '1st',
            domains: Array.isArray(row.domains) ? row.domains : [],
            skills: Array.isArray(row.skills) ? row.skills.map((s: any) => {
                if (typeof s === 'string') {
                    try {
                        const parsed = JSON.parse(s);
                        if (parsed && typeof parsed === 'object' && parsed.name) {
                            return { name: parsed.name, level: parseInt(parsed.level) || 1 };
                        }
                    } catch (e) {
                        return { name: s, level: 1 };
                    }
                    return { name: s, level: 1 };
                }
                return s;
            }) : [],
            openTo: Array.isArray(row.open_to) ? row.open_to : [],
            languages: Array.isArray(row.languages) ? row.languages : [],
        },
        visuals: {
            photos: photos,
            github: row.github || undefined,
            linkedin: row.linkedin || undefined,
            bio: row.bio || undefined,
        },
        portfolio: Array.isArray(row.portfolio) ? row.portfolio.map((p: any) => ({
            projectTitle: p.projectTitle || '',
            projectDescription: p.projectDescription || undefined,
            projectLink: p.projectLink || undefined,
            projectScreenshot: p.projectScreenshot || undefined,
            githubRepoLink: p.githubRepoLink || undefined,
            topContributions: Array.isArray(p.topContributions) ? p.topContributions : [],
        })) : [],
        preferences: {
            ...parsedPrefs,
            interestedIn: Array.isArray(row.interested_in) && row.interested_in.length > 0 ? row.interested_in : (parsedPrefs.interestedIn || []),
            interestedDomains: Array.isArray(row.interested_domains) && row.interested_domains.length > 0 ? row.interested_domains : (parsedPrefs.interestedDomains || []),
            collegeFilter: rawCollegeFilter,
        },
        swapPreferences: typeof row.swap_preferences === 'string' 
            ? JSON.parse(row.swap_preferences) 
            : (row.swap_preferences || { swapModeEnabled: false, requests: [] }),
        onboardingCompleted: !!row.onboarding_completed,
        lastActive: row.last_active || undefined,
        achievements: Array.isArray(row.achievements) ? row.achievements : [],
    };
}

// Convert nested UserProfile → flat DB row for insert/update
export function profileToRow(profile: UserProfile) {
    return {
        id: profile.id,
        first_name: profile.personal.firstName,
        middle_name: profile.personal.middleName || null,
        last_name: profile.personal.lastName,
        gender: profile.personal.gender,
        age: profile.personal.age,
        branch: profile.personal.branch || null,
        college: profile.personal.college || null,
        college_full: profile.personal.collegeFull || null,
        city: profile.personal.city || null,
        state: profile.personal.state || null,
        email_domain: profile.personal.emailDomain || null,

        // Professional Details
        year: profile.professionalDetails.year,
        domains: profile.professionalDetails.domains,
        skills: profile.professionalDetails.skills || [],
        open_to: profile.professionalDetails.openTo || [],
        languages: profile.professionalDetails.languages,

        // Visuals
        photos: profile.visuals.photos,
        github: profile.visuals.github || null,
        linkedin: profile.visuals.linkedin || null,
        bio: profile.visuals.bio || null,

        // Preferences (kept from original, not in diff but not explicitly removed)
        interested_in: profile.preferences.interestedIn,
        interested_domains: profile.preferences.interestedDomains || [],
        college_filter: JSON.stringify(profile.preferences),
        swap_preferences: profile.swapPreferences || { swapModeEnabled: false, requests: [] },

        // Portfolio
        portfolio: (profile.portfolio || []).map((p: any) => ({
            projectTitle: p.projectTitle || '',
            projectDescription: p.projectDescription || null,
            projectLink: p.projectLink || null,
            projectScreenshot: p.projectScreenshot || null,
            githubRepoLink: p.githubRepoLink || null,
            topContributions: p.topContributions || [],
        })),

        onboarding_completed: profile.onboardingCompleted, // Kept from original
        last_active: profile.lastActive || null, // Kept from original
    };
}

