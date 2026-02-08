import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';
import { getTranslator } from '../i18n/index.js';
import { logger } from './logger.js';

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

export function generateUnsubscribeUrl(humanId: string): string {
  const token = jwt.sign({ userId: humanId, action: 'unsubscribe' }, process.env.JWT_SECRET!, { expiresIn: '365d' });
  return `${FRONTEND_URL}/api/auth/unsubscribe?token=${token}`;
}

interface JobOfferEmailData {
  humanName: string;
  humanEmail: string;
  humanId: string;
  jobTitle: string;
  jobDescription: string;
  priceUsdc: number;
  agentName?: string;
  category?: string;
  language?: string;
}

export async function sendJobOfferEmail(data: JobOfferEmailData): Promise<boolean> {
  // Skip if no email configured
  if (!process.env.SMTP_USER) {
    logger.info({ jobTitle: data.jobTitle }, 'SMTP not configured, skipping email');
    return false;
  }

  const t = getTranslator(data.language || 'en');
  const unsubscribeUrl = generateUnsubscribeUrl(data.humanId);

  try {
    const info = await transporter.sendMail({
      from: `"Humans" <${FROM_EMAIL}>`,
      to: data.humanEmail,
      subject: t('email.jobOffer.subject', { jobTitle: data.jobTitle }),
      text: `
${t('email.jobOffer.greeting', { name: data.humanName })}

${t('email.jobOffer.newOffer')}

${t('email.jobOffer.title')}: ${data.jobTitle}
${data.category ? `${t('email.jobOffer.category')}: ${data.category}` : ''}
${data.agentName ? `${t('email.jobOffer.from')}: ${data.agentName}` : ''}
${t('email.jobOffer.price')}: $${data.priceUsdc} USDC

${t('email.jobOffer.description')}:
${data.jobDescription}

${t('email.jobOffer.loginToView')}:
${FRONTEND_URL}/dashboard

---
${t('email.jobOffer.footer')}

To unsubscribe from email notifications: ${unsubscribeUrl}
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
      <h1 style="margin: 0;">${t('email.common.newJobOffer')}</h1>
    </div>
    <div class="content">
      <p>${t('email.jobOffer.greeting', { name: data.humanName })}</p>
      <p>${t('email.jobOffer.newOffer')}</p>

      <div class="job-card">
        <h2 style="margin-top: 0;">${data.jobTitle}</h2>
        ${data.category ? `<p style="color: #6b7280; margin: 4px 0;"><strong>${t('email.jobOffer.category')}:</strong> ${data.category}</p>` : ''}
        ${data.agentName ? `<p style="color: #6b7280; margin: 4px 0;"><strong>${t('email.jobOffer.from')}:</strong> ${data.agentName}</p>` : ''}
        <p class="price">$${data.priceUsdc} USDC</p>
        <p style="color: #374151;">${data.jobDescription}</p>
      </div>

      <a href="${FRONTEND_URL}/dashboard" class="btn">${t('email.jobOffer.viewOffer')}</a>
    </div>
    <div class="footer">
      <p>${t('email.jobOffer.footer')}</p>
      <p style="margin-top: 12px;"><a href="${unsubscribeUrl}" style="color: #9ca3af; font-size: 12px;">Unsubscribe from email notifications</a></p>
    </div>
  </div>
</body>
</html>
      `.trim(),
    });

    logger.info({ messageId: info.messageId }, 'Job offer email sent');
    return true;
  } catch (error) {
    logger.error({ err: error }, 'Email failed to send');
    return false;
  }
}

export async function sendVerificationEmail(email: string, verifyUrl: string): Promise<boolean> {
  if (!process.env.SMTP_USER) {
    logger.info({ email }, 'SMTP not configured, skipping verification email');
    return false;
  }

  try {
    const info = await transporter.sendMail({
      from: `"Humans" <${FROM_EMAIL}>`,
      to: email,
      subject: 'Verify your email - Human Pages',
      text: `
Welcome to Human Pages!

Please verify your email address by clicking the link below:
${verifyUrl}

This link will expire in 24 hours.

If you did not create an account, please ignore this email.

---
Human Pages - Get hired for real-world tasks
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
    .btn { display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">Verify Your Email</h1>
    </div>
    <div class="content">
      <p>Welcome to Human Pages!</p>
      <p>Please verify your email address by clicking the button below:</p>
      <a href="${verifyUrl}" class="btn">Verify Email</a>
      <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">This link will expire in 24 hours.</p>
      <p style="color: #6b7280; font-size: 14px;">If you did not create an account, please ignore this email.</p>
    </div>
    <div class="footer">
      <p>Human Pages - Get hired for real-world tasks</p>
    </div>
  </div>
</body>
</html>
      `.trim(),
    });

    logger.info({ messageId: info.messageId }, 'Verification email sent');
    return true;
  } catch (error) {
    logger.error({ err: error }, 'Verification email failed to send');
    return false;
  }
}

export async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<boolean> {
  // Skip if no email configured
  if (!process.env.SMTP_USER) {
    logger.info({ email }, 'SMTP not configured, skipping password reset email');
    return false;
  }

  try {
    const info = await transporter.sendMail({
      from: `"Humans" <${FROM_EMAIL}>`,
      to: email,
      subject: 'Reset your password - Human Pages',
      text: `
You requested to reset your password for Human Pages.

Click the link below to reset your password:
${resetUrl}

This link will expire in 1 hour.

If you did not request a password reset, please ignore this email.

---
Human Pages - Decentralized freelancing on blockchain
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
    .btn { display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">Reset Your Password</h1>
    </div>
    <div class="content">
      <p>You requested to reset your password for Human Pages.</p>
      <p>Click the button below to reset your password:</p>
      <a href="${resetUrl}" class="btn">Reset Password</a>
      <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">This link will expire in 1 hour.</p>
      <p style="color: #6b7280; font-size: 14px;">If you did not request a password reset, please ignore this email.</p>
    </div>
    <div class="footer">
      <p>Human Pages - Decentralized freelancing on blockchain</p>
    </div>
  </div>
</body>
</html>
      `.trim(),
    });

    logger.info({ messageId: info.messageId }, 'Password reset email sent');
    return true;
  } catch (error) {
    logger.error({ err: error }, 'Password reset email failed to send');
    return false;
  }
}

// Verify email configuration on startup
export async function verifyEmailConfig(): Promise<boolean> {
  if (!process.env.SMTP_USER) {
    logger.info('SMTP not configured - email notifications disabled');
    return false;
  }

  try {
    await transporter.verify();
    logger.info('SMTP connection verified');
    return true;
  } catch (error) {
    logger.error({ err: error }, 'SMTP verification failed');
    return false;
  }
}
