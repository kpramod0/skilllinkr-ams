import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { otps } from "@/lib/db-helpers";
import nodemailer from "nodemailer";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user || !user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify they are currently pending onboarding
    const { data: adminRow } = await supabaseAdmin
      .from("academic_admin_assignments")
      .select("id")
      .eq("email", user.email)
      .eq("status", "pending_onboarding")
      .maybeSingle();

    if (!adminRow) {
      return NextResponse.json({ error: "Not pending onboarding" }, { status: 403 });
    }

    // 1. Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Normalize email (strip .ams) so it sends to their real inbox
    const realEmail = user.email.endsWith('.ams') ? user.email.slice(0, -4) : user.email;

    // 2. Store OTP (We can safely reuse the password_reset_otps bucket for this verification)
    await otps.setReset(realEmail, otp);

    // 3. SEND OTP via Brevo
    const apiKey = process.env.BREVO_API_KEY || process.env.BREVO_SMTP_PASS;
    const smtpAuthUser = process.env.BREVO_SMTP_USER;
    const senderEmail = process.env.BREVO_SENDER_EMAIL || "no-reply@skilllinkr.com";

    if (!apiKey || !smtpAuthUser) {
      console.log(`[LOCAL DEV MODE] No Brevo config found. Verification code for ${realEmail} is: ${otp}`);
      return NextResponse.json({ success: true, message: 'Local Dev Mode: Verification code generated. Check server logs.', devOtp: otp });
    }

    const transporter = nodemailer.createTransport({
      host: "smtp-relay.brevo.com",
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: smtpAuthUser, // e.g. a46a18001@smtp-brevo.com
        pass: apiKey, // The xsmtpsib-... password
      },
    });

    const info = await transporter.sendMail({
      from: `"SkillLinkr" <${senderEmail}>`,
      to: realEmail,
      subject: "SkillLinkr - Admin Onboarding Verification Code",
      html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px;">
              <h2 style="color: #10b981; text-align: center;">Verify Your Administrator Account</h2>
              <p style="font-size: 16px; color: #333;">Please use the following verification code to complete your AMS onboarding and set your new password:</p>
              <div style="background-color: #f7f7f9; padding: 15px; text-align: center; border-radius: 8px; margin: 20px 0;">
                  <h1 style="margin: 0; font-size: 32px; letter-spacing: 5px; color: #0f172a;">${otp}</h1>
              </div>
              <p style="font-size: 14px; color: #666;">This code will expire in 10 minutes.</p>
              <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;">
              <p style="font-size: 16px; color: #10b981; text-align: center; font-weight: bold; margin-bottom: 5px;">Welcome to the Academic Management System! 🎓</p>
          </div>
        `
    });
    
    if (!info.messageId) {
      throw new Error("Failed to send email via SMTP");
    }

    return NextResponse.json({ success: true, message: 'Verification code sent to your email.' });
  } catch (err: any) {
    console.error("Send onboarding OTP error:", err);
    return NextResponse.json({ error: err.message || "Failed to send verification code" }, { status: 500 });
  }
}
