import nodemailer from 'nodemailer';

// Configure transporter based on environment
// In production, use a real SMTP service (SendGrid, SES, Resend, etc.)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM_EMAIL = process.env.FROM_EMAIL || 'notifications@humans.page';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

interface JobOfferEmailData {
  humanName: string;
  humanEmail: string;
  jobTitle: string;
  jobDescription: string;
  priceUsdc: number;
  agentName?: string;
  category?: string;
}

export async function sendJobOfferEmail(data: JobOfferEmailData): Promise<boolean> {
  // Skip if no email configured
  if (!process.env.SMTP_USER) {
    console.log('[Email] SMTP not configured, skipping email:', data.jobTitle);
    return false;
  }

  try {
    const info = await transporter.sendMail({
      from: `"Humans" <${FROM_EMAIL}>`,
      to: data.humanEmail,
      subject: `New job offer: ${data.jobTitle}`,
      text: `
Hi ${data.humanName},

You have a new job offer on Humans!

Title: ${data.jobTitle}
${data.category ? `Category: ${data.category}` : ''}
${data.agentName ? `From: ${data.agentName}` : ''}
Price: $${data.priceUsdc} USDC

Description:
${data.jobDescription}

Log in to accept or reject this offer:
${FRONTEND_URL}/dashboard

---
Humans - The AI-to-Human Marketplace
      `.trim(),
      html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #4F46E5; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .job-card { background: white; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #e5e7eb; }
    .price { font-size: 24px; font-weight: bold; color: #059669; }
    .btn { display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">New Job Offer</h1>
    </div>
    <div class="content">
      <p>Hi ${data.humanName},</p>
      <p>You have a new job offer on Humans!</p>

      <div class="job-card">
        <h2 style="margin-top: 0;">${data.jobTitle}</h2>
        ${data.category ? `<p style="color: #6b7280; margin: 4px 0;"><strong>Category:</strong> ${data.category}</p>` : ''}
        ${data.agentName ? `<p style="color: #6b7280; margin: 4px 0;"><strong>From:</strong> ${data.agentName}</p>` : ''}
        <p class="price">$${data.priceUsdc} USDC</p>
        <p style="color: #374151;">${data.jobDescription}</p>
      </div>

      <a href="${FRONTEND_URL}/dashboard" class="btn">View Offer</a>
    </div>
    <div class="footer">
      <p>Humans - The AI-to-Human Marketplace</p>
    </div>
  </div>
</body>
</html>
      `.trim(),
    });

    console.log('[Email] Sent job offer notification:', info.messageId);
    return true;
  } catch (error) {
    console.error('[Email] Failed to send:', error);
    return false;
  }
}

// Verify email configuration on startup
export async function verifyEmailConfig(): Promise<boolean> {
  if (!process.env.SMTP_USER) {
    console.log('[Email] SMTP not configured - email notifications disabled');
    return false;
  }

  try {
    await transporter.verify();
    console.log('[Email] SMTP connection verified');
    return true;
  } catch (error) {
    console.error('[Email] SMTP verification failed:', error);
    return false;
  }
}
