const nodemailer = require("nodemailer");
const aws = require("@aws-sdk/client-ses");

/**
 * Email Service — Sends templated email notifications via AWS SES.
 *
 * Uses the same AWS SES transport as Zinterview-backend.
 * Falls back to console logging if AWS SES is not configured.
 */

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const accessKeyId = process.env.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_KEY;
  const region = process.env.AWS_SES_REGION || process.env.AWS_REGION || "ap-southeast-1";

  if (!accessKeyId || !secretAccessKey) {
    console.warn("[EmailService] AWS credentials not found — emails will be logged to console");
    return null;
  }

  try {
    const ses = new aws.SES({
      region,
      credentials: { accessKeyId, secretAccessKey },
    });

    transporter = nodemailer.createTransport({ SES: { ses, aws } });
    return transporter;
  } catch (err) {
    console.error("[EmailService] Failed to create SES transport:", err.message);
    return null;
  }
}

// ── Email Templates ──────────────────────────────────────────────

const TEMPLATES = {
  APPLICATION_SUBMITTED: {
    subject: "Application Submitted — {title}",
    html: `<div style="font-family:'Inter',system-ui,sans-serif;max-width:560px;margin:0 auto;padding:32px 0">
      <div style="background:linear-gradient(135deg,#7C3AED,#3B82F6);padding:28px 24px;border-radius:16px 16px 0 0;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700">Application Submitted ✓</h1>
      </div>
      <div style="background:#fff;padding:28px 24px;border:1px solid #E5E7EB;border-top:none;border-radius:0 0 16px 16px">
        <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 12px">Hi <strong>{name}</strong>,</p>
        <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px">Your application for <strong style="color:#7C3AED">{title}</strong> at <strong>{orgName}</strong> has been submitted successfully.</p>
        <div style="background:#F8FAFC;border-radius:12px;padding:16px;margin:0 0 20px">
          <table style="width:100%;font-size:13px;color:#6B7280"><tr>
            <td style="padding:4px 0"><strong>Fitness Score:</strong></td><td style="text-align:right;color:#7C3AED;font-weight:600">{score}%</td>
          </tr><tr>
            <td style="padding:4px 0"><strong>Status:</strong></td><td style="text-align:right;color:#10B981;font-weight:600">{status}</td>
          </tr></table>
        </div>
        <a href="{dashboardUrl}" style="display:block;text-align:center;background:linear-gradient(135deg,#7C3AED,#3B82F6);color:#fff;padding:14px 24px;border-radius:12px;text-decoration:none;font-size:15px;font-weight:600">View Application</a>
        <p style="color:#9CA3AF;font-size:12px;text-align:center;margin:16px 0 0">Mockmate AI — Find your dream job</p>
      </div>
    </div>`,
  },

  APPLICATION_APPROVED: {
    subject: "You're Approved! — {title}",
    html: `<div style="font-family:'Inter',system-ui,sans-serif;max-width:560px;margin:0 auto;padding:32px 0">
      <div style="background:linear-gradient(135deg,#10B981,#059669);padding:28px 24px;border-radius:16px 16px 0 0;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700">Application Approved! 🎉</h1>
      </div>
      <div style="background:#fff;padding:28px 24px;border:1px solid #E5E7EB;border-top:none;border-radius:0 0 16px 16px">
        <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 12px">Hi <strong>{name}</strong>,</p>
        <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px">Great news! Your application for <strong style="color:#10B981">{title}</strong> at <strong>{orgName}</strong> has been approved. You can now proceed with your AI-powered interview.</p>
        <a href="{dashboardUrl}" style="display:block;text-align:center;background:linear-gradient(135deg,#10B981,#059669);color:#fff;padding:14px 24px;border-radius:12px;text-decoration:none;font-size:15px;font-weight:600">Start Interview →</a>
        <p style="color:#9CA3AF;font-size:12px;text-align:center;margin:16px 0 0">Mockmate AI — Find your dream job</p>
      </div>
    </div>`,
  },

  APPLICATION_REJECTED: {
    subject: "Application Update — {title}",
    html: `<div style="font-family:'Inter',system-ui,sans-serif;max-width:560px;margin:0 auto;padding:32px 0">
      <div style="background:linear-gradient(135deg,#6B7280,#374151);padding:28px 24px;border-radius:16px 16px 0 0;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700">Application Update</h1>
      </div>
      <div style="background:#fff;padding:28px 24px;border:1px solid #E5E7EB;border-top:none;border-radius:0 0 16px 16px">
        <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 12px">Hi <strong>{name}</strong>,</p>
        <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 12px">Thank you for your interest in <strong>{title}</strong> at <strong>{orgName}</strong>.</p>
        <p style="color:#6B7280;font-size:14px;line-height:1.7;margin:0 0 20px">After careful review, the team has decided to move forward with other candidates at this time. We encourage you to keep exploring other openings on Mockmate.</p>
        <a href="{dashboardUrl}" style="display:block;text-align:center;background:linear-gradient(135deg,#3B82F6,#6366F1);color:#fff;padding:14px 24px;border-radius:12px;text-decoration:none;font-size:15px;font-weight:600">Explore More Jobs</a>
        <p style="color:#9CA3AF;font-size:12px;text-align:center;margin:16px 0 0">Mockmate AI — Find your dream job</p>
      </div>
    </div>`,
  },

  INTERVIEW_SCHEDULED: {
    subject: "Interview Scheduled — {title}",
    html: `<div style="font-family:'Inter',system-ui,sans-serif;max-width:560px;margin:0 auto;padding:32px 0">
      <div style="background:linear-gradient(135deg,#3B82F6,#6366F1);padding:28px 24px;border-radius:16px 16px 0 0;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700">Interview Scheduled 📅</h1>
      </div>
      <div style="background:#fff;padding:28px 24px;border:1px solid #E5E7EB;border-top:none;border-radius:0 0 16px 16px">
        <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 12px">Hi <strong>{name}</strong>,</p>
        <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px">Your interview for <strong style="color:#3B82F6">{title}</strong> is scheduled for:</p>
        <div style="background:#EFF6FF;border-radius:12px;padding:16px;margin:0 0 20px;text-align:center">
          <p style="margin:0;font-size:18px;font-weight:700;color:#1E40AF">{scheduledAt}</p>
        </div>
        <a href="{dashboardUrl}" style="display:block;text-align:center;background:linear-gradient(135deg,#3B82F6,#6366F1);color:#fff;padding:14px 24px;border-radius:12px;text-decoration:none;font-size:15px;font-weight:600">View Details</a>
        <p style="color:#9CA3AF;font-size:12px;text-align:center;margin:16px 0 0">Mockmate AI — Find your dream job</p>
      </div>
    </div>`,
  },

  INTERVIEW_REMINDER: {
    subject: "⏰ Interview Starting Soon — {title}",
    html: `<div style="font-family:'Inter',system-ui,sans-serif;max-width:560px;margin:0 auto;padding:32px 0">
      <div style="background:linear-gradient(135deg,#F59E0B,#EF4444);padding:28px 24px;border-radius:16px 16px 0 0;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700">Interview Starting Soon ⏰</h1>
      </div>
      <div style="background:#fff;padding:28px 24px;border:1px solid #E5E7EB;border-top:none;border-radius:0 0 16px 16px">
        <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 12px">Hi <strong>{name}</strong>,</p>
        <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px">Your interview for <strong style="color:#F59E0B">{title}</strong> is starting soon! Make sure you have a stable internet connection and a quiet environment.</p>
        <a href="{interviewUrl}" style="display:block;text-align:center;background:linear-gradient(135deg,#F59E0B,#EF4444);color:#fff;padding:14px 24px;border-radius:12px;text-decoration:none;font-size:15px;font-weight:600">Join Interview Now →</a>
        <p style="color:#9CA3AF;font-size:12px;text-align:center;margin:16px 0 0">Mockmate AI — Find your dream job</p>
      </div>
    </div>`,
  },
};

// ── Template Interpolation ───────────────────────────────────────

function fillTemplate(template, vars) {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value || "");
  }
  return result;
}

// ── Send Email ───────────────────────────────────────────────────

async function sendEmail(to, templateKey, variables = {}) {
  const template = TEMPLATES[templateKey];
  if (!template) {
    console.warn(`[EmailService] Unknown template: ${templateKey}`);
    return;
  }

  const subject = fillTemplate(template.subject, variables);
  const html = fillTemplate(template.html, variables);
  const transport = getTransporter();

  if (!transport) {
    console.log(`[EmailService] (Console) To: ${to} | Subject: ${subject}`);
    return;
  }

  try {
    await transport.sendMail({
      from: process.env.SES_FROM_EMAIL || "Mockmate AI <no-reply@mockmate.ai>",
      to,
      subject,
      html,
    });
    console.log(`[EmailService] Sent: ${templateKey} to ${to}`);
  } catch (error) {
    console.error("[EmailService] Error:", error.message);
  }
}

module.exports = { sendEmail, TEMPLATES };
