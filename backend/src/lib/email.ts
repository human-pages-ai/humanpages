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

export function generateReportUrl(humanId: string, agentId: string, jobId?: string): string {
  const payload: any = { humanId, agentId, action: 'report' };
  if (jobId) payload.jobId = jobId;
  const token = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '90d' });
  return `${FRONTEND_URL}/report?token=${token}`;
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
  jobId?: string;
  agentId?: string;
}

export async function sendJobOfferEmail(data: JobOfferEmailData): Promise<boolean> {
  if (!process.env.RESEND_API_KEY && !process.env.SES_SMTP_USER) {
    logger.info({ jobTitle: data.jobTitle }, 'No email provider configured, skipping email');
    return false;
  }

  const t = getTranslator(data.language || 'en');
  const unsubscribeUrl = generateUnsubscribeUrl(data.humanId);
  const reportUrl = data.agentId ? generateReportUrl(data.humanId, data.agentId, data.jobId) : null;

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

${reportUrl ? `Report this agent: ${reportUrl}` : ''}
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
      ${reportUrl ? `<p style="margin-top: 8px;"><a href="${reportUrl}" style="color: #9ca3af; font-size: 12px; text-decoration: underline;">Report this agent</a></p>` : ''}
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

export async function sendJobOfferUpdatedEmail(data: JobOfferEmailData): Promise<boolean> {
  if (!process.env.RESEND_API_KEY && !process.env.SES_SMTP_USER) {
    logger.info({ jobTitle: data.jobTitle }, 'No email provider configured, skipping email');
    return false;
  }

  const t = getTranslator(data.language || 'en');
  const unsubscribeUrl = generateUnsubscribeUrl(data.humanId);

  const textContent = `
${t('email.jobOffer.greeting', { name: data.humanName })}

An offer has been updated:

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
    .header { background-color: #F59E0B; padding: 24px; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; color: #ffffff; font-size: 20px; }
    .content { background-color: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; }
    .content p { color: #374151; }
    .job-card { background-color: #ffffff; padding: 20px; border-radius: 8px; margin: 16px 0; border: 1px solid #e5e7eb; }
    .job-card h2 { margin-top: 0; color: #111827; }
    .job-card .meta { color: #6b7280; margin: 4px 0; }
    .job-card .desc { color: #374151; }
    .price { font-size: 28px; font-weight: bold; color: #059669; margin: 8px 0; }
    .updated-badge { display: inline-block; background-color: #FEF3C7; color: #92400E; font-size: 12px; padding: 2px 8px; border-radius: 4px; font-weight: 600; margin-left: 8px; }
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
      <h1>Updated Offer</h1>
    </div>
    <div class="content">
      <p>${t('email.jobOffer.greeting', { name: data.humanName })}</p>
      <p>An existing offer has been updated by ${data.agentName || 'an agent'}. Please review the updated details:</p>

      <div class="job-card">
        <h2>${data.jobTitle} <span class="updated-badge">Updated</span></h2>
        ${data.category ? `<p class="meta"><strong>${t('email.jobOffer.category')}:</strong> ${data.category}</p>` : ''}
        ${data.agentName ? `<p class="meta"><strong>${t('email.jobOffer.from')}:</strong> ${data.agentName}</p>` : ''}
        <p class="price">$${data.priceUsdc} USDC</p>
        <p class="desc">${data.jobDescription}</p>
      </div>

      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${jobUrl}" style="height:44px;v-text-anchor:middle;width:200px;" arcsize="14%" fillcolor="#F59E0B">
        <w:anchorlock/>
        <center style="color:#ffffff;font-family:sans-serif;font-size:14px;font-weight:bold;">${t('email.jobOffer.viewOffer')}</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-->
      <a href="${jobUrl}" style="display:inline-block;background-color:#F59E0B;color:#ffffff;padding:14px 28px;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;margin-top:16px;text-align:center;mso-hide:all;">${t('email.jobOffer.viewOffer')}</a>
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
    subject: `Updated offer from ${data.agentName || 'an agent'}: ${data.jobTitle}`,
    text: textContent,
    html: htmlContent,
  });
}

interface JobMessageEmailData {
  humanName: string;
  humanEmail: string;
  humanId: string;
  agentName: string;
  messageContent: string;
  jobTitle: string;
  jobDetailUrl: string;
  language?: string;
}

export async function sendJobMessageEmail(data: JobMessageEmailData): Promise<boolean> {
  if (!process.env.RESEND_API_KEY && !process.env.SES_SMTP_USER) {
    logger.info({ jobTitle: data.jobTitle }, 'No email provider configured, skipping message email');
    return false;
  }

  const t = getTranslator(data.language || 'en');
  const unsubscribeUrl = generateUnsubscribeUrl(data.humanId);

  // Truncate long messages for email preview
  const preview = data.messageContent.length > 300
    ? data.messageContent.slice(0, 300) + '...'
    : data.messageContent;

  const textContent = `
${t('email.jobOffer.greeting', { name: data.humanName })}

${data.agentName} sent you a message on "${data.jobTitle}":

"${preview}"

View the conversation and reply:
${data.jobDetailUrl}

---
${t('email.jobOffer.footer')}

To unsubscribe from email notifications: ${unsubscribeUrl}
  `.trim();

  const escapedPreview = preview.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const escapedAgent = data.agentName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

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
    .message-card { background-color: #ffffff; padding: 20px; border-radius: 8px; margin: 16px 0; border: 1px solid #e5e7eb; border-left: 4px solid #4F46E5; }
    .message-card .sender { color: #4F46E5; font-weight: 600; margin-bottom: 8px; }
    .message-card .text { color: #374151; white-space: pre-wrap; }
    .footer { text-align: center; padding: 20px; }
    .footer p { color: #6b7280; font-size: 14px; }
    @media (prefers-color-scheme: dark) {
      body { background-color: #1a1a2e !important; color: #e5e7eb !important; }
      .content { background-color: #1e1e3a !important; border-color: #374151 !important; }
      .content p { color: #d1d5db !important; }
      .message-card { background-color: #2a2a4a !important; border-color: #4b5563 !important; }
      .message-card .sender { color: #818cf8 !important; }
      .message-card .text { color: #d1d5db !important; }
      .footer p { color: #9ca3af !important; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>New message on "${data.jobTitle}"</h1>
    </div>
    <div class="content">
      <p>${t('email.jobOffer.greeting', { name: data.humanName })}</p>
      <p>${escapedAgent} sent you a message:</p>

      <div class="message-card">
        <p class="sender">${escapedAgent}</p>
        <p class="text">${escapedPreview}</p>
      </div>

      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${data.jobDetailUrl}" style="height:44px;v-text-anchor:middle;width:200px;" arcsize="14%" fillcolor="#4F46E5">
        <w:anchorlock/>
        <center style="color:#ffffff;font-family:sans-serif;font-size:14px;font-weight:bold;">View &amp; Reply</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-->
      <a href="${data.jobDetailUrl}" style="display:inline-block;background-color:#4F46E5;color:#ffffff;padding:14px 28px;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;margin-top:16px;text-align:center;mso-hide:all;">View &amp; Reply</a>
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
    subject: `New message from ${data.agentName} on "${data.jobTitle}"`,
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

// ===== DIGEST EMAIL =====

interface DigestEmailData {
  humanName: string;
  humanEmail: string;
  humanId: string;
  language?: string;
  notifications: Array<{
    type: string;
    payload: any;
    createdAt: Date;
  }>;
}

export async function sendDigestEmail(data: DigestEmailData): Promise<boolean> {
  if (!process.env.RESEND_API_KEY && !process.env.SES_SMTP_USER) return false;

  const t = getTranslator(data.language || 'en');
  const unsubscribeUrl = generateUnsubscribeUrl(data.humanId);
  const count = data.notifications.length;

  const jobOffers = data.notifications.filter(n => n.type === 'job_offer');
  const messages = data.notifications.filter(n => n.type === 'job_message');

  let textItems = '';
  for (const n of data.notifications) {
    if (n.type === 'job_offer') {
      textItems += `- New offer: ${n.payload.jobTitle} ($${n.payload.priceUsdc} USDC) from ${n.payload.agentName || 'an agent'}\n`;
    } else if (n.type === 'job_message') {
      textItems += `- Message from ${n.payload.agentName} on "${n.payload.jobTitle}"\n`;
    }
  }

  const textContent = `
${t('email.jobOffer.greeting', { name: data.humanName })}

You have ${count} new notification${count !== 1 ? 's' : ''}:

${textItems}
View your dashboard: ${FRONTEND_URL}/dashboard

---
${t('email.jobOffer.footer')}

To unsubscribe: ${unsubscribeUrl}
  `.trim();

  let htmlCards = '';
  for (const n of data.notifications) {
    if (n.type === 'job_offer') {
      htmlCards += `
        <div style="background:#fff;padding:16px;border-radius:8px;margin:8px 0;border:1px solid #e5e7eb;">
          <strong>${n.payload.jobTitle}</strong>
          ${n.payload.agentName ? `<br><span style="color:#6b7280;">From: ${n.payload.agentName}</span>` : ''}
          <br><span style="color:#059669;font-weight:bold;font-size:18px;">$${n.payload.priceUsdc} USDC</span>
        </div>`;
    } else if (n.type === 'job_message') {
      htmlCards += `
        <div style="background:#fff;padding:16px;border-radius:8px;margin:8px 0;border:1px solid #e5e7eb;border-left:4px solid #4F46E5;">
          <strong>Message from ${n.payload.agentName}</strong>
          <br><span style="color:#6b7280;">On: ${n.payload.jobTitle}</span>
        </div>`;
    }
  }

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #ffffff; color: #1f2937; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #4F46E5; padding: 24px; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; color: #ffffff; font-size: 20px; }
    .content { background-color: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; }
    .footer { text-align: center; padding: 20px; }
    .footer p { color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>You have ${count} new notification${count !== 1 ? 's' : ''}</h1>
    </div>
    <div class="content">
      <p>${t('email.jobOffer.greeting', { name: data.humanName })}</p>
      ${jobOffers.length > 0 ? `<p><strong>${jobOffers.length} new job offer${jobOffers.length !== 1 ? 's' : ''}</strong></p>` : ''}
      ${messages.length > 0 ? `<p><strong>${messages.length} new message${messages.length !== 1 ? 's' : ''}</strong></p>` : ''}
      ${htmlCards}
      <a href="${FRONTEND_URL}/dashboard" style="display:inline-block;background-color:#4F46E5;color:#ffffff;padding:14px 28px;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;margin-top:16px;">View Dashboard</a>
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
    subject: `${count} new notification${count !== 1 ? 's' : ''} - Human Pages`,
    text: textContent,
    html: htmlContent,
  });
}

// ===== SEND OR QUEUE NOTIFICATION =====

// Lazy import prisma to avoid circular dependency issues
let _prisma: any = null;
async function getPrisma() {
  if (!_prisma) {
    const mod = await import('./prisma.js');
    _prisma = mod.prisma;
  }
  return _prisma;
}

// Per-recipient throttle: max 10 emails/hour in REALTIME mode
const recentEmailCounts = new Map<string, { count: number; resetAt: number }>();
const MAX_REALTIME_PER_HOUR = 10;
const AUTO_SWITCH_THRESHOLD = 5;

export async function sendOrQueueNotification(
  humanId: string,
  type: 'job_offer' | 'job_message',
  payload: any,
  sendFn: () => Promise<boolean>
): Promise<boolean> {
  const prisma = await getPrisma();

  const human = await prisma.human.findUnique({
    where: { id: humanId },
    select: { emailDigestMode: true },
  });

  if (!human) return false;

  const mode = human.emailDigestMode || 'REALTIME';

  if (mode === 'HOURLY' || mode === 'DAILY') {
    // Queue for digest
    await prisma.pendingNotification.create({
      data: { humanId, type, payload },
    });
    return true;
  }

  // REALTIME mode — check throttle
  const now = Date.now();
  let tracker = recentEmailCounts.get(humanId);
  if (!tracker || now > tracker.resetAt) {
    tracker = { count: 0, resetAt: now + 60 * 60 * 1000 };
    recentEmailCounts.set(humanId, tracker);
  }

  tracker.count++;

  // Auto-switch to HOURLY if too many in one hour
  if (tracker.count > AUTO_SWITCH_THRESHOLD) {
    await prisma.human.update({
      where: { id: humanId },
      data: { emailDigestMode: 'HOURLY' },
    });
    // Queue this notification
    await prisma.pendingNotification.create({
      data: { humanId, type, payload },
    });
    logger.info({ humanId, count: tracker.count }, 'Auto-switched to HOURLY digest due to high email volume');
    return true;
  }

  if (tracker.count > MAX_REALTIME_PER_HOUR) {
    // Queue instead of sending
    await prisma.pendingNotification.create({
      data: { humanId, type, payload },
    });
    return true;
  }

  // Send immediately
  return sendFn();
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
