import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import nodemailer from "nodemailer";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // 1. Generate Supabase Recovery Link (which yields a valid 6-digit email_otp)
    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email
    });

    if (linkErr || !linkData.properties?.email_otp) {
      console.error("Generate link error:", linkErr);
      return NextResponse.json({ error: "Failed to generate recovery token" }, { status: 500 });
    }

    const otp = linkData.properties.email_otp;
    const realEmail = email;

    // 2. SEND OTP via Brevo
    const apiKey = process.env.BREVO_API_KEY || process.env.BREVO_SMTP_PASS;
    const smtpAuthUser = process.env.BREVO_SMTP_USER;
    const senderEmail = process.env.BREVO_SENDER_EMAIL || "no-reply@skilllinkr.com";

    if (!apiKey || !smtpAuthUser) {
      console.log( + "" + [LOCAL DEV MODE] No Brevo config found. Password reset code for  is:  + "" + );
      return NextResponse.json({ success: true, message: 'Local Dev Mode: Verification code generated.' });
    }

    const transporter = nodemailer.createTransport({
      host: "smtp-relay.brevo.com",
      port: 587,
      secure: false,
      auth: {
        user: smtpAuthUser,
        pass: apiKey,
      },
    });

    const info = await transporter.sendMail({
      from: "SkillLinkr" < + "$" + {senderEmail}>,
      to: realEmail,
      subject: "SkillLinkr - Password Reset Verification Code",
      html:  + "" + 
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px;">
              <h2 style="color: #24cdd1; text-align: center;">Reset Your Password</h2>
              <p style="font-size: 16px; color: #333;">Please use the following verification code to reset your SkillLinkr administrator password:</p>
              <div style="background-color: #f7f7f9; padding: 15px; text-align: center; border-radius: 8px; margin: 20px 0;">
                  <h1 style="margin: 0; font-size: 32px; letter-spacing: 5px; color: #0f172a;"> + "$" + {otp}</h1>
              </div>
              <p style="font-size: 14px; color: #666;">This code will expire in 10 minutes.</p>
          </div>
         + "" + 
    });
    
    if (!info.messageId) {
      throw new Error("Failed to send email via SMTP");
    }

    return NextResponse.json({ success: true, message: 'Verification code sent to your email.' });
  } catch (err: any) {
    console.error("Send reset OTP error:", err);
    return NextResponse.json({ error: err.message || "Failed to send verification code" }, { status: 500 });
  }
}