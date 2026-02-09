import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import jwt from 'jsonwebtoken';
import { getTranslator } from '../i18n/index.js';
import { logger } from './logger.js';

// Lazy-initialize Resend to avoid crashing when API key is not set (e.g. in tests)
let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

// Lazy-initialize SES SMTP transport via nodemailer
let _sesTransport: Transporter | null = null;
function getSesTransport(): Transporter | null {
  if (!process.env.SES_SMTP_USER || !process.env.SES_SMTP_PASS) {
    return null;
  }
  if (!_sesTransport) {
    _sesTransport = nodemailer.createTransport({
      host: process.env.SES_SMTP_HOST || 'email-smtp.ap-southeast-2.amazonaws.com',
      port: Number(process.env.SES_SMTP_PORT) || 465,
      secure: true,
      auth: {
        user: process.env.SES_SMTP_USER,
        pass: process.env.SES_SMTP_PASS,
      },
    });
  }
  return _sesTransport;
}

const FROM_EMAIL = process.env.FROM_EMAIL || 'hello@humanpages.ai';
const FROM_NAME = process.env.FROM_NAME || 'HumanPages';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

export function generateUnsubscribeUrl(humanId: string): string {
  const token = jwt.sign({ userId: humanId, action: 'unsubscribe' }, process.env.JWT_SECRET!, { expiresIn: '365d' });
  return `${FRONTEND_URL}/api/auth/unsubscribe?token=${token}`;
}

interface SendEmailParams {
  to: string;
  subject: string;
  text: string;
  html: string;
}

async function sendEmail({ to, subject, text, html }: SendEmailParams): Promise<boolean> {
  const from = `${FROM_NAME} <${FROM_EMAIL}>`;

  // Try Resend first
  if (process.env.RESEND_API_KEY) {
    try {
      const { data: response, error } = await getResend().emails.send({
        from,
        to: [to],
        subject,
        text,
        html,
      });

      if (!error) {
        logger.info({ messageId: response?.id, provider: 'resend' }, 'Email sent');
        return true;
      }

      logger.warn({ err: error, provider: 'resend' }, 'Resend failed, attempting SES fallback');
    } catch (error) {
      logger.warn({ err: error, provider: 'resend' }, 'Resend failed, attempting SES fallback');
    }
  }

  // Fallback to SES
  const sesTransport = getSesTransport();
  if (sesTransport) {
    try {
      const info = await sesTransport.sendMail({ from, to, subject, text, html });
      logger.info({ messageId: info.messageId, provider: 'ses' }, 'Email sent');
      return true;
    } catch (error) {
      logger.error({ err: error, provider: 'ses' }, 'SES fallback also failed');
      return false;
    }
  }

  // Neither provider available or both failed
  if (!process.env.RESEND_API_KEY) {
    logger.info('No email provider configured, skipping email');
  }
  return false;
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
  jobDetailUrl?: string;
}

export async function sendJobOfferEmail(data: JobOfferEmailData): Promise<boolean> {
  if (!process.env.RESEND_API_KEY && !process.env.SES_SMTP_USER) {
    logger.info({ jobTitle: data.jobTitle }, 'No email provider configured, skipping email');
    return false;
  }

  const t = getTranslator(data.language || 'en');
  const unsubscribeUrl = generateUnsubscribeUrl(data.humanId);

  const textContent = `
${t('email.jobOffer.greeting', { name: data.humanName })}

${t('email.jobOffer.newOffer')}

${t('email.jobOffer.title')}: ${data.jobTitle}
${data.category ? `${t('email.jobOffer.category')}: ${data.category}` : ''}
${data.agentName ? `${t('email.jobOffer.from')}: ${data.agentName}` : ''}
${t('email.jobOffer.price')}: $${data.priceUsdc} USDC

${t('email.jobOffer.description')}:
${data.jobDescription}

${t('email.jobOffer.loginToView')}:
${data.jobDetailUrl || `${FRONTEND_URL}/dashboard`}

---
${t('email.jobOffer.footer')}


To unsubscribe from email notifications: ${unsubscribeUrl}
  `.trim();

  const jobUrl = data.jobDetailUrl || `${FRONTEND_URL}/dashboard`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <style>
    :root { color-scheme: light dark; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #ffffff; color: #1f2937; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #4F46E5; padding: 24px; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; color: #ffffff; font-size: 20px; }
    .content { background-color: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; }
    .content p { color: #374151; }
    .job-card { background-color: #ffffff; padding: 20px; border-radius: 8px; margin: 16px 0; border: 1px solid #e5e7eb; }
    .job-card h2 { margin-top: 0; color: #111827; }
    .job-card .meta { color: #6b7280; margin: 4px 0; }
    .job-card .desc { color: #374151; }
    .price { font-size: 28px; font-weight: bold; color: #059669; margin: 8px 0; }
    .footer { text-align: center; padding: 20px; }
    .footer p { color: #6b7280; font-size: 14px; }
    @media (prefers-color-scheme: dark) {
      body { background-color: #1a1a2e !important; color: #e5e7eb !important; }
      .content { background-color: #1e1e3a !important; border-color: #374151 !important; }
      .content p { color: #d1d5db !important; }
      .job-card { background-color: #2a2a4a !important; border-color: #4b5563 !important; }
      .job-card h2 { color: #f3f4f6 !important; }
      .job-card .meta { color: #9ca3af !important; }
      .job-card .desc { color: #d1d5db !important; }
      .price { color: #34d399 !important; }
      .footer p { color: #9ca3af !important; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${t('email.common.newJobOffer')}</h1>
    </div>
    <div class="content">
      <p>${t('email.jobOffer.greeting', { name: data.humanName })}</p>
      <p>${t('email.jobOffer.newOffer')}</p>

      <div class="job-card">
        <h2>${data.jobTitle}</h2>
        ${data.category ? `<p class="meta"><strong>${t('email.jobOffer.category')}:</strong> ${data.category}</p>` : ''}
        ${data.agentName ? `<p class="meta"><strong>${t('email.jobOffer.from')}:</strong> ${data.agentName}</p>` : ''}
        <p class="price">$${data.priceUsdc} USDC</p>
        <p class="desc">${data.jobDescription}</p>
      </div>

      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${jobUrl}" style="height:44px;v-text-anchor:middle;width:200px;" arcsize="14%" fillcolor="#4F46E5">
        <w:anchorlock/>
        <center style="color:#ffffff;font-family:sans-serif;font-size:14px;font-weight:bold;">${t('email.jobOffer.viewOffer')}</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-->
      <a href="${jobUrl}" style="display:inline-block;background-color:#4F46E5;color:#ffffff;padding:14px 28px;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;margin-top:16px;text-align:center;mso-hide:all;">${t('email.jobOffer.viewOffer')}</a>
      <!--<![endif]-->
    </div>
    <div class="footer">
      <p>${t('email.jobOffer.footer')}</p>
      <p style="margin-top: 12px;"><a href="${unsubscribeUrl}" style="color: #9ca3af; font-size: 12px; text-decoration: underline;">Unsubscribe from email notifications</a></p>
    </div>
  </div>
</body>
</html>
  `.trim();

  return sendEmail({
    to: data.humanEmail,
    subject: t('email.jobOffer.subject', { jobTitle: data.jobTitle }),
    text: textContent,
    html: htmlContent,
  });
}

export async function sendVerificationEmail(email: string, verifyUrl: string): Promise<boolean> {
  if (!process.env.RESEND_API_KEY && !process.env.SES_SMTP_USER) {
    logger.info({ email }, 'No email provider configured, skipping verification email');
    return false;
  }

  const textContent = `
Welcome to Human Pages!

Please verify your email address by clicking the link below:
${verifyUrl}

This link will expire in 24 hours.

If you did not create an account, please ignore this email.

---
Human Pages - Get hired for real-world tasks
  `.trim();

  const htmlContent = `
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
  `.trim();

  return sendEmail({
    to: email,
    subject: 'Verify your email - Human Pages',
    text: textContent,
    html: htmlContent,
  });
}

export async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<boolean> {
  if (!process.env.RESEND_API_KEY && !process.env.SES_SMTP_USER) {
    logger.info({ email }, 'No email provider configured, skipping password reset email');
    return false;
  }

  const textContent = `
You requested to reset your password for Human Pages.

Click the link below to reset your password:
${resetUrl}

This link will expire in 1 hour.

If you did not request a password reset, please ignore this email.

---
Human Pages - Get hired for real-world tasks
  `.trim();

  const htmlContent = `
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
      <p>Human Pages - Get hired for real-world tasks</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  return sendEmail({
    to: email,
    subject: 'Reset your password - Human Pages',
    text: textContent,
    html: htmlContent,
  });
}

// Verify email configuration on startup
export async function verifyEmailConfig(): Promise<boolean> {
  const hasResend = !!process.env.RESEND_API_KEY;
  const hasSes = !!process.env.SES_SMTP_USER && !!process.env.SES_SMTP_PASS;

  if (hasResend && hasSes) {
    logger.info('Email providers configured: Resend (primary) + SES (fallback)');
  } else if (hasResend) {
    logger.info('Email provider configured: Resend');
  } else if (hasSes) {
    logger.info('Email provider configured: SES only');
  } else {
    logger.info('No email provider configured - email notifications disabled');
    return false;
  }

  return true;
}
