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
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${t('email.common.newJobOffer')}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>
    :root { color-scheme: light dark; }
    @media (prefers-color-scheme: dark) {
      .email-bg { background-color: #1a1a2e !important; }
      .email-card { background-color: #16213e !important; border-color: #2a2a4a !important; }
      .email-heading { color: #f0f0f5 !important; }
      .email-body { color: #c8c8d8 !important; }
      .email-btn { background-color: #6366f1 !important; border-color: #6366f1 !important; }
      .email-muted { color: #8888a8 !important; }
      .email-link { color: #818cf8 !important; }
      .email-divider { border-top-color: #2a2a4a !important; }
      .email-job-card { background-color: #1e2a4a !important; border-color: #2a2a4a !important; }
      .email-job-title { color: #f0f0f5 !important; }
      .email-job-meta { color: #9ca3af !important; }
      .email-job-desc { color: #c8c8d8 !important; }
      .email-price { color: #34d399 !important; }
    }
    [data-ogsc] .email-bg { background-color: #1a1a2e !important; }
    [data-ogsc] .email-card { background-color: #16213e !important; border-color: #2a2a4a !important; }
    [data-ogsc] .email-heading { color: #f0f0f5 !important; }
    [data-ogsc] .email-body { color: #c8c8d8 !important; }
    [data-ogsc] .email-btn { background-color: #6366f1 !important; border-color: #6366f1 !important; }
    [data-ogsc] .email-muted { color: #8888a8 !important; }
    [data-ogsc] .email-link { color: #818cf8 !important; }
    [data-ogsc] .email-divider { border-top-color: #2a2a4a !important; }
    [data-ogsc] .email-job-card { background-color: #1e2a4a !important; border-color: #2a2a4a !important; }
    [data-ogsc] .email-job-title { color: #f0f0f5 !important; }
    [data-ogsc] .email-job-meta { color: #9ca3af !important; }
    [data-ogsc] .email-job-desc { color: #c8c8d8 !important; }
    [data-ogsc] .email-price { color: #34d399 !important; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f0f0f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-bg" style="background-color: #f0f0f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" class="email-card" style="max-width: 520px; width: 100%; background-color: #fefefe; border-radius: 12px; border: 1px solid #e2e2ea; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td align="center" style="padding: 32px 40px 24px;">
              <h1 class="email-heading" style="margin: 0; font-size: 22px; font-weight: 600; color: #1e1e2f; line-height: 1.4;">${t('email.common.newJobOffer')}</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 0 40px;">
              <p class="email-body" style="margin: 0 0 8px; font-size: 15px; line-height: 1.6; color: #44445a;">${t('email.jobOffer.greeting', { name: data.humanName })}</p>
              <p class="email-body" style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #44445a;">${t('email.jobOffer.newOffer')}</p>
            </td>
          </tr>
          <!-- Job Card -->
          <tr>
            <td style="padding: 0 40px 16px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-job-card" style="background-color: #f8f8fc; border-radius: 8px; border: 1px solid #e2e2ea;">
                <tr>
                  <td style="padding: 20px;">
                    <h2 class="email-job-title" style="margin: 0 0 8px; font-size: 18px; font-weight: 600; color: #1e1e2f;">${data.jobTitle}</h2>
                    ${data.category ? `<p class="email-job-meta" style="margin: 4px 0; font-size: 14px; color: #6b7280;"><strong>${t('email.jobOffer.category')}:</strong> ${data.category}</p>` : ''}
                    ${data.agentName ? `<p class="email-job-meta" style="margin: 4px 0; font-size: 14px; color: #6b7280;"><strong>${t('email.jobOffer.from')}:</strong> ${data.agentName}</p>` : ''}
                    <p class="email-price" style="font-size: 28px; font-weight: bold; color: #059669; margin: 12px 0 8px;">$${data.priceUsdc} USDC</p>
                    <p class="email-job-desc" style="margin: 0; font-size: 14px; line-height: 1.5; color: #44445a;">${data.jobDescription}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- CTA Button -->
          <tr>
            <td align="center" style="padding: 8px 40px 24px;">
              <!--[if mso]>
              <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${jobUrl}" style="height:48px;v-text-anchor:middle;width:200px;" arcsize="17%" fill="t">
                <v:fill type="tile" color="#4F46E5" />
                <w:anchorlock/>
                <center style="color:#ffffff;font-family:sans-serif;font-size:15px;font-weight:600;">${t('email.jobOffer.viewOffer')}</center>
              </v:roundrect>
              <![endif]-->
              <!--[if !mso]><!-->
              <a href="${jobUrl}" target="_blank" class="email-btn" style="display: inline-block; background-color: #4F46E5; color: #fefefe; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 36px; border-radius: 8px; line-height: 1.5; mso-hide: all; border: 2px solid #4F46E5;">${t('email.jobOffer.viewOffer')}</a>
              <!--<![endif]-->
            </td>
          </tr>
          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <hr class="email-divider" style="border: none; border-top: 1px solid #e2e2ea; margin: 0;">
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px 32px;">
              <p class="email-muted" style="margin: 0; font-size: 12px; line-height: 1.5; color: #8b8ba0;">${t('email.jobOffer.footer')}</p>
              ${reportUrl ? `<p style="margin: 8px 0 0;"><a href="${reportUrl}" class="email-link" style="color: #8b8ba0; font-size: 12px; text-decoration: underline;">Report this agent</a></p>` : ''}
              <p style="margin: 8px 0 0;"><a href="${unsubscribeUrl}" class="email-link" style="color: #8b8ba0; font-size: 12px; text-decoration: underline;">Unsubscribe from email notifications</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
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
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Updated Offer</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>
    :root { color-scheme: light dark; }
    @media (prefers-color-scheme: dark) {
      .email-bg { background-color: #1a1a2e !important; }
      .email-card { background-color: #16213e !important; border-color: #2a2a4a !important; }
      .email-heading { color: #f0f0f5 !important; }
      .email-body { color: #c8c8d8 !important; }
      .email-btn { background-color: #f59e0b !important; border-color: #f59e0b !important; }
      .email-muted { color: #8888a8 !important; }
      .email-link { color: #818cf8 !important; }
      .email-divider { border-top-color: #2a2a4a !important; }
      .email-job-card { background-color: #1e2a4a !important; border-color: #2a2a4a !important; }
      .email-job-title { color: #f0f0f5 !important; }
      .email-job-meta { color: #9ca3af !important; }
      .email-job-desc { color: #c8c8d8 !important; }
      .email-price { color: #34d399 !important; }
      .email-badge { background-color: #78350f !important; color: #fde68a !important; }
    }
    [data-ogsc] .email-bg { background-color: #1a1a2e !important; }
    [data-ogsc] .email-card { background-color: #16213e !important; border-color: #2a2a4a !important; }
    [data-ogsc] .email-heading { color: #f0f0f5 !important; }
    [data-ogsc] .email-body { color: #c8c8d8 !important; }
    [data-ogsc] .email-btn { background-color: #f59e0b !important; border-color: #f59e0b !important; }
    [data-ogsc] .email-muted { color: #8888a8 !important; }
    [data-ogsc] .email-link { color: #818cf8 !important; }
    [data-ogsc] .email-divider { border-top-color: #2a2a4a !important; }
    [data-ogsc] .email-job-card { background-color: #1e2a4a !important; border-color: #2a2a4a !important; }
    [data-ogsc] .email-job-title { color: #f0f0f5 !important; }
    [data-ogsc] .email-job-meta { color: #9ca3af !important; }
    [data-ogsc] .email-job-desc { color: #c8c8d8 !important; }
    [data-ogsc] .email-price { color: #34d399 !important; }
    [data-ogsc] .email-badge { background-color: #78350f !important; color: #fde68a !important; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f0f0f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-bg" style="background-color: #f0f0f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" class="email-card" style="max-width: 520px; width: 100%; background-color: #fefefe; border-radius: 12px; border: 1px solid #e2e2ea; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td align="center" style="padding: 32px 40px 24px;">
              <h1 class="email-heading" style="margin: 0; font-size: 22px; font-weight: 600; color: #1e1e2f; line-height: 1.4;">Updated Offer</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 0 40px;">
              <p class="email-body" style="margin: 0 0 8px; font-size: 15px; line-height: 1.6; color: #44445a;">${t('email.jobOffer.greeting', { name: data.humanName })}</p>
              <p class="email-body" style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #44445a;">An existing offer has been updated by ${data.agentName || 'an agent'}. Please review the updated details:</p>
            </td>
          </tr>
          <!-- Job Card -->
          <tr>
            <td style="padding: 0 40px 16px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-job-card" style="background-color: #f8f8fc; border-radius: 8px; border: 1px solid #e2e2ea;">
                <tr>
                  <td style="padding: 20px;">
                    <h2 class="email-job-title" style="margin: 0 0 8px; font-size: 18px; font-weight: 600; color: #1e1e2f; display: inline;">${data.jobTitle}</h2>
                    <span class="email-badge" style="display: inline-block; background-color: #FEF3C7; color: #92400E; font-size: 12px; padding: 2px 8px; border-radius: 4px; font-weight: 600; margin-left: 8px; vertical-align: middle;">Updated</span>
                    ${data.category ? `<p class="email-job-meta" style="margin: 8px 0 4px; font-size: 14px; color: #6b7280;"><strong>${t('email.jobOffer.category')}:</strong> ${data.category}</p>` : ''}
                    ${data.agentName ? `<p class="email-job-meta" style="margin: 4px 0; font-size: 14px; color: #6b7280;"><strong>${t('email.jobOffer.from')}:</strong> ${data.agentName}</p>` : ''}
                    <p class="email-price" style="font-size: 28px; font-weight: bold; color: #059669; margin: 12px 0 8px;">$${data.priceUsdc} USDC</p>
                    <p class="email-job-desc" style="margin: 0; font-size: 14px; line-height: 1.5; color: #44445a;">${data.jobDescription}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- CTA Button -->
          <tr>
            <td align="center" style="padding: 8px 40px 24px;">
              <!--[if mso]>
              <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${jobUrl}" style="height:48px;v-text-anchor:middle;width:200px;" arcsize="17%" fill="t">
                <v:fill type="tile" color="#F59E0B" />
                <w:anchorlock/>
                <center style="color:#ffffff;font-family:sans-serif;font-size:15px;font-weight:600;">${t('email.jobOffer.viewOffer')}</center>
              </v:roundrect>
              <![endif]-->
              <!--[if !mso]><!-->
              <a href="${jobUrl}" target="_blank" class="email-btn" style="display: inline-block; background-color: #F59E0B; color: #fefefe; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 36px; border-radius: 8px; line-height: 1.5; mso-hide: all; border: 2px solid #F59E0B;">${t('email.jobOffer.viewOffer')}</a>
              <!--<![endif]-->
            </td>
          </tr>
          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <hr class="email-divider" style="border: none; border-top: 1px solid #e2e2ea; margin: 0;">
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px 32px;">
              <p class="email-muted" style="margin: 0; font-size: 12px; line-height: 1.5; color: #8b8ba0;">${t('email.jobOffer.footer')}</p>
              <p style="margin: 8px 0 0;"><a href="${unsubscribeUrl}" class="email-link" style="color: #8b8ba0; font-size: 12px; text-decoration: underline;">Unsubscribe from email notifications</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
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
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>New message on "${data.jobTitle}"</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>
    :root { color-scheme: light dark; }
    @media (prefers-color-scheme: dark) {
      .email-bg { background-color: #1a1a2e !important; }
      .email-card { background-color: #16213e !important; border-color: #2a2a4a !important; }
      .email-heading { color: #f0f0f5 !important; }
      .email-body { color: #c8c8d8 !important; }
      .email-btn { background-color: #6366f1 !important; border-color: #6366f1 !important; }
      .email-muted { color: #8888a8 !important; }
      .email-link { color: #818cf8 !important; }
      .email-divider { border-top-color: #2a2a4a !important; }
      .email-msg-card { background-color: #1e2a4a !important; border-color: #2a2a4a !important; border-left-color: #6366f1 !important; }
      .email-msg-sender { color: #818cf8 !important; }
      .email-msg-text { color: #c8c8d8 !important; }
    }
    [data-ogsc] .email-bg { background-color: #1a1a2e !important; }
    [data-ogsc] .email-card { background-color: #16213e !important; border-color: #2a2a4a !important; }
    [data-ogsc] .email-heading { color: #f0f0f5 !important; }
    [data-ogsc] .email-body { color: #c8c8d8 !important; }
    [data-ogsc] .email-btn { background-color: #6366f1 !important; border-color: #6366f1 !important; }
    [data-ogsc] .email-muted { color: #8888a8 !important; }
    [data-ogsc] .email-link { color: #818cf8 !important; }
    [data-ogsc] .email-divider { border-top-color: #2a2a4a !important; }
    [data-ogsc] .email-msg-card { background-color: #1e2a4a !important; border-color: #2a2a4a !important; border-left-color: #6366f1 !important; }
    [data-ogsc] .email-msg-sender { color: #818cf8 !important; }
    [data-ogsc] .email-msg-text { color: #c8c8d8 !important; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f0f0f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-bg" style="background-color: #f0f0f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" class="email-card" style="max-width: 520px; width: 100%; background-color: #fefefe; border-radius: 12px; border: 1px solid #e2e2ea; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td align="center" style="padding: 32px 40px 24px;">
              <h1 class="email-heading" style="margin: 0; font-size: 22px; font-weight: 600; color: #1e1e2f; line-height: 1.4;">New message on "${data.jobTitle}"</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 0 40px;">
              <p class="email-body" style="margin: 0 0 8px; font-size: 15px; line-height: 1.6; color: #44445a;">${t('email.jobOffer.greeting', { name: data.humanName })}</p>
              <p class="email-body" style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #44445a;">${escapedAgent} sent you a message:</p>
            </td>
          </tr>
          <!-- Message Card -->
          <tr>
            <td style="padding: 0 40px 16px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-msg-card" style="background-color: #f8f8fc; border-radius: 8px; border: 1px solid #e2e2ea; border-left: 4px solid #4F46E5;">
                <tr>
                  <td style="padding: 20px;">
                    <p class="email-msg-sender" style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #4F46E5;">${escapedAgent}</p>
                    <p class="email-msg-text" style="margin: 0; font-size: 14px; line-height: 1.6; color: #44445a; white-space: pre-wrap;">${escapedPreview}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- CTA Button -->
          <tr>
            <td align="center" style="padding: 8px 40px 24px;">
              <!--[if mso]>
              <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${data.jobDetailUrl}" style="height:48px;v-text-anchor:middle;width:200px;" arcsize="17%" fill="t">
                <v:fill type="tile" color="#4F46E5" />
                <w:anchorlock/>
                <center style="color:#ffffff;font-family:sans-serif;font-size:15px;font-weight:600;">View &amp; Reply</center>
              </v:roundrect>
              <![endif]-->
              <!--[if !mso]><!-->
              <a href="${data.jobDetailUrl}" target="_blank" class="email-btn" style="display: inline-block; background-color: #4F46E5; color: #fefefe; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 36px; border-radius: 8px; line-height: 1.5; mso-hide: all; border: 2px solid #4F46E5;">View &amp; Reply</a>
              <!--<![endif]-->
            </td>
          </tr>
          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <hr class="email-divider" style="border: none; border-top: 1px solid #e2e2ea; margin: 0;">
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px 32px;">
              <p class="email-muted" style="margin: 0; font-size: 12px; line-height: 1.5; color: #8b8ba0;">${t('email.jobOffer.footer')}</p>
              <p style="margin: 8px 0 0;"><a href="${unsubscribeUrl}" class="email-link" style="color: #8b8ba0; font-size: 12px; text-decoration: underline;">Unsubscribe from email notifications</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
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
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Verify your email</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    :root { color-scheme: light dark; }
    @media (prefers-color-scheme: dark) {
      .email-bg { background-color: #1a1a2e !important; }
      .email-card { background-color: #16213e !important; border-color: #2a2a4a !important; }
      .email-heading { color: #f0f0f5 !important; }
      .email-body { color: #c8c8d8 !important; }
      .email-btn { background-color: #6366f1 !important; }
      .email-muted { color: #8888a8 !important; }
      .email-link { color: #818cf8 !important; }
      .email-divider { border-top-color: #2a2a4a !important; }
    }
    /* Gmail dark mode */
    u ~ div .email-bg { background-color: #1a1a2e !important; }
    [data-ogsc] .email-bg { background-color: #1a1a2e !important; }
    [data-ogsc] .email-card { background-color: #16213e !important; border-color: #2a2a4a !important; }
    [data-ogsc] .email-heading { color: #f0f0f5 !important; }
    [data-ogsc] .email-body { color: #c8c8d8 !important; }
    [data-ogsc] .email-btn { background-color: #6366f1 !important; }
    [data-ogsc] .email-muted { color: #8888a8 !important; }
    [data-ogsc] .email-link { color: #818cf8 !important; }
    [data-ogsc] .email-divider { border-top-color: #2a2a4a !important; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f0f0f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-bg" style="background-color: #f0f0f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" class="email-card" style="max-width: 480px; width: 100%; background-color: #fefefe; border-radius: 12px; border: 1px solid #e2e2ea; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td align="center" style="padding: 32px 40px 24px;">
              <h1 class="email-heading" style="margin: 0; font-size: 22px; font-weight: 600; color: #1e1e2f; line-height: 1.4;">Verify your email address</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 0 40px;">
              <p class="email-body" style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #44445a;">Welcome to Human Pages! Please confirm your email address by clicking the button below.</p>
            </td>
          </tr>
          <!-- CTA Button -->
          <tr>
            <td align="center" style="padding: 8px 40px 24px;">
              <!--[if mso]>
              <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="\${verifyUrl}" style="height:48px;v-text-anchor:middle;width:220px;" arcsize="17%" fill="t">
                <v:fill type="tile" color="#4F46E5" />
                <w:anchorlock/>
                <center style="color:#ffffff;font-family:sans-serif;font-size:15px;font-weight:600;">Verify email address</center>
              </v:roundrect>
              <![endif]-->
              <!--[if !mso]><!-->
              <a href="${verifyUrl}" target="_blank" class="email-btn" style="display: inline-block; background-color: #4F46E5; color: #fefefe; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 36px; border-radius: 8px; line-height: 1.5; mso-hide: all; border: 2px solid #4F46E5;">Verify email address</a>
              <!--<![endif]-->
            </td>
          </tr>
          <!-- Fallback URL -->
          <tr>
            <td style="padding: 0 40px 24px;">
              <p class="email-muted" style="margin: 0; font-size: 13px; line-height: 1.5; color: #8b8ba0;">Or copy and paste this link into your browser:</p>
              <p style="margin: 4px 0 0; font-size: 13px; line-height: 1.5; word-break: break-all;"><a href="${verifyUrl}" class="email-link" style="color: #4F46E5; text-decoration: underline;">${verifyUrl}</a></p>
            </td>
          </tr>
          <!-- Expiry notice -->
          <tr>
            <td style="padding: 0 40px 24px;">
              <p class="email-muted" style="margin: 0; font-size: 13px; line-height: 1.5; color: #8b8ba0;">This link will expire in 24 hours.</p>
            </td>
          </tr>
          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <hr class="email-divider" style="border: none; border-top: 1px solid #e2e2ea; margin: 0;">
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px 32px;">
              <p class="email-muted" style="margin: 0; font-size: 12px; line-height: 1.5; color: #8b8ba0;">If you didn't create an account on Human Pages, you can safely ignore this email.</p>
              <p class="email-muted" style="margin: 16px 0 0; font-size: 12px; line-height: 1.5; color: #8b8ba0;">Human Pages — Get hired for real-world tasks</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
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
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Reset your password</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>
    :root { color-scheme: light dark; }
    @media (prefers-color-scheme: dark) {
      .email-bg { background-color: #1a1a2e !important; }
      .email-card { background-color: #16213e !important; border-color: #2a2a4a !important; }
      .email-heading { color: #f0f0f5 !important; }
      .email-body { color: #c8c8d8 !important; }
      .email-btn { background-color: #6366f1 !important; border-color: #6366f1 !important; }
      .email-muted { color: #8888a8 !important; }
      .email-link { color: #818cf8 !important; }
      .email-divider { border-top-color: #2a2a4a !important; }
    }
    [data-ogsc] .email-bg { background-color: #1a1a2e !important; }
    [data-ogsc] .email-card { background-color: #16213e !important; border-color: #2a2a4a !important; }
    [data-ogsc] .email-heading { color: #f0f0f5 !important; }
    [data-ogsc] .email-body { color: #c8c8d8 !important; }
    [data-ogsc] .email-btn { background-color: #6366f1 !important; border-color: #6366f1 !important; }
    [data-ogsc] .email-muted { color: #8888a8 !important; }
    [data-ogsc] .email-link { color: #818cf8 !important; }
    [data-ogsc] .email-divider { border-top-color: #2a2a4a !important; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f0f0f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-bg" style="background-color: #f0f0f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" class="email-card" style="max-width: 480px; width: 100%; background-color: #fefefe; border-radius: 12px; border: 1px solid #e2e2ea; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td align="center" style="padding: 32px 40px 24px;">
              <h1 class="email-heading" style="margin: 0; font-size: 22px; font-weight: 600; color: #1e1e2f; line-height: 1.4;">Reset your password</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 0 40px;">
              <p class="email-body" style="margin: 0 0 8px; font-size: 15px; line-height: 1.6; color: #44445a;">You requested to reset your password for Human Pages.</p>
              <p class="email-body" style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #44445a;">Click the button below to set a new password:</p>
            </td>
          </tr>
          <!-- CTA Button -->
          <tr>
            <td align="center" style="padding: 8px 40px 24px;">
              <!--[if mso]>
              <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="\${resetUrl}" style="height:48px;v-text-anchor:middle;width:220px;" arcsize="17%" fill="t">
                <v:fill type="tile" color="#4F46E5" />
                <w:anchorlock/>
                <center style="color:#ffffff;font-family:sans-serif;font-size:15px;font-weight:600;">Reset password</center>
              </v:roundrect>
              <![endif]-->
              <!--[if !mso]><!-->
              <a href="${resetUrl}" target="_blank" class="email-btn" style="display: inline-block; background-color: #4F46E5; color: #fefefe; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 36px; border-radius: 8px; line-height: 1.5; mso-hide: all; border: 2px solid #4F46E5;">Reset password</a>
              <!--<![endif]-->
            </td>
          </tr>
          <!-- Fallback URL -->
          <tr>
            <td style="padding: 0 40px 24px;">
              <p class="email-muted" style="margin: 0; font-size: 13px; line-height: 1.5; color: #8b8ba0;">Or copy and paste this link into your browser:</p>
              <p style="margin: 4px 0 0; font-size: 13px; line-height: 1.5; word-break: break-all;"><a href="${resetUrl}" class="email-link" style="color: #4F46E5; text-decoration: underline;">${resetUrl}</a></p>
            </td>
          </tr>
          <!-- Expiry notice -->
          <tr>
            <td style="padding: 0 40px 24px;">
              <p class="email-muted" style="margin: 0; font-size: 13px; line-height: 1.5; color: #8b8ba0;">This link will expire in 1 hour.</p>
            </td>
          </tr>
          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <hr class="email-divider" style="border: none; border-top: 1px solid #e2e2ea; margin: 0;">
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px 32px;">
              <p class="email-muted" style="margin: 0; font-size: 12px; line-height: 1.5; color: #8b8ba0;">If you didn't request a password reset, you can safely ignore this email.</p>
              <p class="email-muted" style="margin: 16px 0 0; font-size: 12px; line-height: 1.5; color: #8b8ba0;">Human Pages — Get hired for real-world tasks</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
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

// ===== STREAM NOTIFICATION EMAILS =====

interface StreamFlowStoppedEmailData {
  humanName: string;
  humanEmail: string;
  humanId: string;
  jobTitle: string;
  totalPaid: number;
  language?: string;
}

export async function sendStreamFlowStoppedEmail(data: StreamFlowStoppedEmailData): Promise<boolean> {
  if (!process.env.RESEND_API_KEY && !process.env.SES_SMTP_USER) return false;

  const t = getTranslator(data.language || 'en');
  const unsubscribeUrl = generateUnsubscribeUrl(data.humanId);

  const textContent = `
${t('email.jobOffer.greeting', { name: data.humanName })}

The payment flow for "${data.jobTitle}" was stopped by the agent.

Total received so far: $${data.totalPaid.toFixed(2)} USDC

The stream has been paused. The agent may resume it later.

Stream payments arrive as USDCx (a wrapped version of USDC). You can convert USDCx back to regular USDC anytime at app.superfluid.finance — it takes one quick transaction.

View your dashboard: ${FRONTEND_URL}/dashboard

---
${t('email.jobOffer.footer')}

To unsubscribe: ${unsubscribeUrl}
  `.trim();

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Payment Flow Stopped</title></head>
<body style="margin: 0; padding: 0; background-color: #f0f0f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0f0f5;">
    <tr><td align="center" style="padding: 40px 20px;">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width: 520px; width: 100%; background-color: #fefefe; border-radius: 12px; border: 1px solid #e2e2ea; overflow: hidden;">
        <tr><td align="center" style="padding: 32px 40px 24px;">
          <h1 style="margin: 0; font-size: 22px; font-weight: 600; color: #1e1e2f;">Payment Flow Stopped</h1>
        </td></tr>
        <tr><td style="padding: 0 40px;">
          <p style="margin: 0 0 8px; font-size: 15px; color: #44445a;">${t('email.jobOffer.greeting', { name: data.humanName })}</p>
          <p style="margin: 0 0 16px; font-size: 15px; color: #44445a;">The payment flow for <strong>"${data.jobTitle}"</strong> was stopped.</p>
          <p style="font-size: 28px; font-weight: bold; color: #059669; margin: 12px 0;">$${data.totalPaid.toFixed(2)} USDC received</p>
          <p style="margin: 0 0 16px; font-size: 14px; color: #6b7280;">Stream payments arrive as USDCx (a wrapped version of USDC). You can convert USDCx back to regular USDC anytime at <a href="https://app.superfluid.finance" style="color: #4F46E5;">app.superfluid.finance</a> — it takes one quick transaction.</p>
        </td></tr>
        <tr><td align="center" style="padding: 8px 40px 24px;">
          <a href="${FRONTEND_URL}/dashboard" style="display: inline-block; background-color: #4F46E5; color: #fefefe; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 36px; border-radius: 8px;">View Dashboard</a>
        </td></tr>
        <tr><td style="padding: 24px 40px 32px;">
          <p style="margin: 0; font-size: 12px; color: #8b8ba0;">${t('email.jobOffer.footer')}</p>
          <p style="margin: 8px 0 0;"><a href="${unsubscribeUrl}" style="color: #8b8ba0; font-size: 12px;">Unsubscribe</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
  `.trim();

  return sendEmail({
    to: data.humanEmail,
    subject: `Payment flow stopped: ${data.jobTitle}`,
    text: textContent,
    html: htmlContent,
  });
}

interface StreamStartedEmailData {
  humanName: string;
  humanEmail: string;
  humanId: string;
  jobTitle: string;
  rateUsdc: number;
  interval: string;
  method: string;
  language?: string;
}

export async function sendStreamStartedEmail(data: StreamStartedEmailData): Promise<boolean> {
  if (!process.env.RESEND_API_KEY && !process.env.SES_SMTP_USER) return false;

  const t = getTranslator(data.language || 'en');
  const unsubscribeUrl = generateUnsubscribeUrl(data.humanId);
  const intervalLabel = data.interval.toLowerCase().replace('ly', '');

  const textContent = `
${t('email.jobOffer.greeting', { name: data.humanName })}

An agent started streaming $${data.rateUsdc}/${intervalLabel} to your wallet${data.method === 'SUPERFLUID' ? ' via Superfluid' : ''} for "${data.jobTitle}".

${data.method === 'SUPERFLUID' ? 'Stream payments arrive as USDCx (a wrapped version of USDC). You can convert USDCx back to regular USDC anytime at app.superfluid.finance — it takes one quick transaction.' : ''}

View your dashboard: ${FRONTEND_URL}/dashboard

---
${t('email.jobOffer.footer')}

To unsubscribe: ${unsubscribeUrl}
  `.trim();

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Stream Started</title></head>
<body style="margin: 0; padding: 0; background-color: #f0f0f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0f0f5;">
    <tr><td align="center" style="padding: 40px 20px;">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width: 520px; width: 100%; background-color: #fefefe; border-radius: 12px; border: 1px solid #e2e2ea; overflow: hidden;">
        <tr><td align="center" style="padding: 32px 40px 24px;">
          <h1 style="margin: 0; font-size: 22px; font-weight: 600; color: #1e1e2f;">Stream Payment Started</h1>
        </td></tr>
        <tr><td style="padding: 0 40px;">
          <p style="margin: 0 0 8px; font-size: 15px; color: #44445a;">${t('email.jobOffer.greeting', { name: data.humanName })}</p>
          <p style="margin: 0 0 16px; font-size: 15px; color: #44445a;">An agent started streaming payments for <strong>"${data.jobTitle}"</strong>${data.method === 'SUPERFLUID' ? ' via Superfluid' : ''}.</p>
          <p style="font-size: 28px; font-weight: bold; color: #059669; margin: 12px 0;">$${data.rateUsdc}/${intervalLabel}</p>
          ${data.method === 'SUPERFLUID' ? '<p style="margin: 0 0 16px; font-size: 14px; color: #6b7280;">Stream payments arrive as USDCx (a wrapped version of USDC). You can convert USDCx back to regular USDC anytime at <a href="https://app.superfluid.finance" style="color: #4F46E5;">app.superfluid.finance</a> — it takes one quick transaction.</p>' : ''}
        </td></tr>
        <tr><td align="center" style="padding: 8px 40px 24px;">
          <a href="${FRONTEND_URL}/dashboard" style="display: inline-block; background-color: #059669; color: #fefefe; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 36px; border-radius: 8px;">View Dashboard</a>
        </td></tr>
        <tr><td style="padding: 24px 40px 32px;">
          <p style="margin: 0; font-size: 12px; color: #8b8ba0;">${t('email.jobOffer.footer')}</p>
          <p style="margin: 8px 0 0;"><a href="${unsubscribeUrl}" style="color: #8b8ba0; font-size: 12px;">Unsubscribe</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
  `.trim();

  return sendEmail({
    to: data.humanEmail,
    subject: `Stream started: $${data.rateUsdc}/${intervalLabel} for ${data.jobTitle}`,
    text: textContent,
    html: htmlContent,
  });
}

interface StreamCompletedEmailData {
  humanName: string;
  humanEmail: string;
  humanId: string;
  jobTitle: string;
  totalPaid: number;
  days: number;
  language?: string;
}

export async function sendStreamCompletedEmail(data: StreamCompletedEmailData): Promise<boolean> {
  if (!process.env.RESEND_API_KEY && !process.env.SES_SMTP_USER) return false;

  const t = getTranslator(data.language || 'en');
  const unsubscribeUrl = generateUnsubscribeUrl(data.humanId);

  const textContent = `
${t('email.jobOffer.greeting', { name: data.humanName })}

The stream for "${data.jobTitle}" has ended.

Total received: $${data.totalPaid.toFixed(2)} USDC over ${data.days} day(s).

View your dashboard: ${FRONTEND_URL}/dashboard

---
${t('email.jobOffer.footer')}

To unsubscribe: ${unsubscribeUrl}
  `.trim();

  return sendEmail({
    to: data.humanEmail,
    subject: `Stream completed: ${data.jobTitle} — $${data.totalPaid.toFixed(2)} total`,
    text: textContent,
    html: `<html><body><p>${textContent.replace(/\n/g, '<br>')}</p></body></html>`,
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
              <tr>
                <td style="padding: 0 0 8px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-digest-card" style="background-color: #f8f8fc; border-radius: 8px; border: 1px solid #e2e2ea;">
                    <tr>
                      <td style="padding: 16px;">
                        <strong class="email-job-title" style="color: #1e1e2f;">${n.payload.jobTitle}</strong>
                        ${n.payload.agentName ? `<br><span class="email-job-meta" style="color: #6b7280; font-size: 13px;">From: ${n.payload.agentName}</span>` : ''}
                        <br><span class="email-price" style="color: #059669; font-weight: bold; font-size: 18px;">$${n.payload.priceUsdc} USDC</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>`;
    } else if (n.type === 'job_message') {
      htmlCards += `
              <tr>
                <td style="padding: 0 0 8px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-digest-card" style="background-color: #f8f8fc; border-radius: 8px; border: 1px solid #e2e2ea; border-left: 4px solid #4F46E5;">
                    <tr>
                      <td style="padding: 16px;">
                        <strong class="email-job-title" style="color: #1e1e2f;">Message from ${n.payload.agentName}</strong>
                        <br><span class="email-job-meta" style="color: #6b7280; font-size: 13px;">On: ${n.payload.jobTitle}</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>`;
    }
  }

  const htmlContent = `
<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${count} new notification${count !== 1 ? 's' : ''}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>
    :root { color-scheme: light dark; }
    @media (prefers-color-scheme: dark) {
      .email-bg { background-color: #1a1a2e !important; }
      .email-card { background-color: #16213e !important; border-color: #2a2a4a !important; }
      .email-heading { color: #f0f0f5 !important; }
      .email-body { color: #c8c8d8 !important; }
      .email-btn { background-color: #6366f1 !important; border-color: #6366f1 !important; }
      .email-muted { color: #8888a8 !important; }
      .email-link { color: #818cf8 !important; }
      .email-divider { border-top-color: #2a2a4a !important; }
      .email-digest-card { background-color: #1e2a4a !important; border-color: #2a2a4a !important; }
      .email-job-title { color: #f0f0f5 !important; }
      .email-job-meta { color: #9ca3af !important; }
      .email-price { color: #34d399 !important; }
    }
    [data-ogsc] .email-bg { background-color: #1a1a2e !important; }
    [data-ogsc] .email-card { background-color: #16213e !important; border-color: #2a2a4a !important; }
    [data-ogsc] .email-heading { color: #f0f0f5 !important; }
    [data-ogsc] .email-body { color: #c8c8d8 !important; }
    [data-ogsc] .email-btn { background-color: #6366f1 !important; border-color: #6366f1 !important; }
    [data-ogsc] .email-muted { color: #8888a8 !important; }
    [data-ogsc] .email-link { color: #818cf8 !important; }
    [data-ogsc] .email-divider { border-top-color: #2a2a4a !important; }
    [data-ogsc] .email-digest-card { background-color: #1e2a4a !important; border-color: #2a2a4a !important; }
    [data-ogsc] .email-job-title { color: #f0f0f5 !important; }
    [data-ogsc] .email-job-meta { color: #9ca3af !important; }
    [data-ogsc] .email-price { color: #34d399 !important; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f0f0f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-bg" style="background-color: #f0f0f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" class="email-card" style="max-width: 520px; width: 100%; background-color: #fefefe; border-radius: 12px; border: 1px solid #e2e2ea; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td align="center" style="padding: 32px 40px 24px;">
              <h1 class="email-heading" style="margin: 0; font-size: 22px; font-weight: 600; color: #1e1e2f; line-height: 1.4;">You have ${count} new notification${count !== 1 ? 's' : ''}</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 0 40px;">
              <p class="email-body" style="margin: 0 0 8px; font-size: 15px; line-height: 1.6; color: #44445a;">${t('email.jobOffer.greeting', { name: data.humanName })}</p>
              ${jobOffers.length > 0 ? `<p class="email-body" style="margin: 0 0 4px; font-size: 15px; line-height: 1.6; color: #44445a;"><strong>${jobOffers.length} new job offer${jobOffers.length !== 1 ? 's' : ''}</strong></p>` : ''}
              ${messages.length > 0 ? `<p class="email-body" style="margin: 0 0 4px; font-size: 15px; line-height: 1.6; color: #44445a;"><strong>${messages.length} new message${messages.length !== 1 ? 's' : ''}</strong></p>` : ''}
            </td>
          </tr>
          <!-- Notification Cards -->
          <tr>
            <td style="padding: 12px 40px 16px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${htmlCards}
              </table>
            </td>
          </tr>
          <!-- CTA Button -->
          <tr>
            <td align="center" style="padding: 8px 40px 24px;">
              <!--[if mso]>
              <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${FRONTEND_URL}/dashboard" style="height:48px;v-text-anchor:middle;width:200px;" arcsize="17%" fill="t">
                <v:fill type="tile" color="#4F46E5" />
                <w:anchorlock/>
                <center style="color:#ffffff;font-family:sans-serif;font-size:15px;font-weight:600;">View Dashboard</center>
              </v:roundrect>
              <![endif]-->
              <!--[if !mso]><!-->
              <a href="${FRONTEND_URL}/dashboard" target="_blank" class="email-btn" style="display: inline-block; background-color: #4F46E5; color: #fefefe; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 36px; border-radius: 8px; line-height: 1.5; mso-hide: all; border: 2px solid #4F46E5;">View Dashboard</a>
              <!--<![endif]-->
            </td>
          </tr>
          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <hr class="email-divider" style="border: none; border-top: 1px solid #e2e2ea; margin: 0;">
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px 32px;">
              <p class="email-muted" style="margin: 0; font-size: 12px; line-height: 1.5; color: #8b8ba0;">${t('email.jobOffer.footer')}</p>
              <p style="margin: 8px 0 0;"><a href="${unsubscribeUrl}" class="email-link" style="color: #8b8ba0; font-size: 12px; text-decoration: underline;">Unsubscribe from email notifications</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
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

// ===== PROFILE COMPLETION NUDGE EMAIL =====

interface ProfileNudgeEmailData {
  humanName: string;
  humanEmail: string;
  humanId: string;
  missingFields: string[];
  completionPercent: number;
  language?: string;
}

export async function sendProfileNudgeEmail(data: ProfileNudgeEmailData): Promise<boolean> {
  if (!process.env.RESEND_API_KEY && !process.env.SES_SMTP_USER) return false;

  const unsubscribeUrl = generateUnsubscribeUrl(data.humanId);
  const dashboardUrl = `${FRONTEND_URL}/dashboard?tab=profile`;

  const missingList = data.missingFields.map(f => `- ${f}`).join('\n');
  const missingHtmlList = data.missingFields.map(f =>
    `<li style="padding: 4px 0; color: #44445a;">${f}</li>`
  ).join('');

  const textContent = `
Hi ${data.humanName},

Your profile is ${data.completionPercent}% complete. Finishing it helps agents find you for the right jobs.

To start receiving job offers, you still need:
${missingList}

It only takes a couple of minutes to finish:
${dashboardUrl}

Profiles with complete information get significantly more job offers. Don't miss out!

---
Human Pages — Get hired for real-world tasks

To unsubscribe: ${unsubscribeUrl}
  `.trim();

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Complete your profile</title>
  <style>
    :root { color-scheme: light dark; }
    @media (prefers-color-scheme: dark) {
      .email-bg { background-color: #1a1a2e !important; }
      .email-card { background-color: #16213e !important; border-color: #2a2a4a !important; }
      .email-heading { color: #f0f0f5 !important; }
      .email-body { color: #c8c8d8 !important; }
      .email-btn { background-color: #6366f1 !important; border-color: #6366f1 !important; }
      .email-muted { color: #8888a8 !important; }
      .email-link { color: #818cf8 !important; }
      .email-divider { border-top-color: #2a2a4a !important; }
      .email-checklist { background-color: #1e2a4a !important; border-color: #2a2a4a !important; }
      .email-checklist li { color: #c8c8d8 !important; }
    }
    [data-ogsc] .email-bg { background-color: #1a1a2e !important; }
    [data-ogsc] .email-card { background-color: #16213e !important; border-color: #2a2a4a !important; }
    [data-ogsc] .email-heading { color: #f0f0f5 !important; }
    [data-ogsc] .email-body { color: #c8c8d8 !important; }
    [data-ogsc] .email-btn { background-color: #6366f1 !important; border-color: #6366f1 !important; }
    [data-ogsc] .email-muted { color: #8888a8 !important; }
    [data-ogsc] .email-link { color: #818cf8 !important; }
    [data-ogsc] .email-divider { border-top-color: #2a2a4a !important; }
    [data-ogsc] .email-checklist { background-color: #1e2a4a !important; border-color: #2a2a4a !important; }
    [data-ogsc] .email-checklist li { color: #c8c8d8 !important; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f0f0f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-bg" style="background-color: #f0f0f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" class="email-card" style="max-width: 520px; width: 100%; background-color: #fefefe; border-radius: 12px; border: 1px solid #e2e2ea; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td align="center" style="padding: 32px 40px 24px;">
              <h1 class="email-heading" style="margin: 0; font-size: 22px; font-weight: 600; color: #1e1e2f; line-height: 1.4;">You're ${data.completionPercent}% there</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 0 40px;">
              <p class="email-body" style="margin: 0 0 8px; font-size: 15px; line-height: 1.6; color: #44445a;">Hi ${data.humanName},</p>
              <p class="email-body" style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #44445a;">AI agents are searching for people like you right now. A complete profile makes you much more likely to get hired. Here's what's left:</p>
            </td>
          </tr>
          <!-- Checklist -->
          <tr>
            <td style="padding: 0 40px 16px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-checklist" style="background-color: #f8f8fc; border-radius: 8px; border: 1px solid #e2e2ea;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <ul style="margin: 0; padding: 0 0 0 20px; font-size: 14px; line-height: 1.8;">
                      ${missingHtmlList}
                    </ul>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- CTA Button -->
          <tr>
            <td align="center" style="padding: 8px 40px 24px;">
              <a href="${dashboardUrl}" target="_blank" class="email-btn" style="display: inline-block; background-color: #4F46E5; color: #fefefe; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 36px; border-radius: 8px; line-height: 1.5; border: 2px solid #4F46E5;">Complete My Profile</a>
            </td>
          </tr>
          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <hr class="email-divider" style="border: none; border-top: 1px solid #e2e2ea; margin: 0;">
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px 32px;">
              <p class="email-muted" style="margin: 0; font-size: 12px; line-height: 1.5; color: #8b8ba0;">Human Pages — Get hired for real-world tasks</p>
              <p style="margin: 8px 0 0;"><a href="${unsubscribeUrl}" class="email-link" style="color: #8b8ba0; font-size: 12px; text-decoration: underline;">Unsubscribe from email notifications</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  return sendEmail({
    to: data.humanEmail,
    subject: `Your profile is ${data.completionPercent}% complete — finish it to get more offers`,
    text: textContent,
    html: htmlContent,
  });
}

// ===== LISTING MATCH NOTIFICATION =====

interface ListingMatchEmailData {
  humanName: string;
  humanEmail: string;
  humanId: string;
  listingTitle: string;
  budgetUsdc: number;
  agentName: string;
  listingUrl: string;
  language?: string;
}

export async function sendListingMatchEmail(data: ListingMatchEmailData): Promise<boolean> {
  if (!process.env.RESEND_API_KEY && !process.env.SES_SMTP_USER) return false;

  const t = getTranslator(data.language || 'en');
  const unsubscribeUrl = generateUnsubscribeUrl(data.humanId);

  const textContent = `
${t('email.jobOffer.greeting', { name: data.humanName })}

New listing matching your skills: "${data.listingTitle}"
Budget: $${data.budgetUsdc} USDC
Posted by: ${data.agentName}

Apply now: ${data.listingUrl}

---
${t('email.jobOffer.footer')}

To unsubscribe: ${unsubscribeUrl}
  `.trim();

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>New listing match</title></head>
<body style="margin: 0; padding: 0; background-color: #f0f0f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0f0f5;">
    <tr><td align="center" style="padding: 40px 20px;">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width: 520px; width: 100%; background-color: #fefefe; border-radius: 12px; border: 1px solid #e2e2ea; overflow: hidden;">
        <tr><td align="center" style="padding: 32px 40px 24px;">
          <h1 style="margin: 0; font-size: 22px; font-weight: 600; color: #1e1e2f;">New listing matching your skills</h1>
        </td></tr>
        <tr><td style="padding: 0 40px;">
          <p style="margin: 0 0 8px; font-size: 15px; color: #44445a;">${t('email.jobOffer.greeting', { name: data.humanName })}</p>
          <p style="margin: 0 0 16px; font-size: 15px; color: #44445a;">A new listing was posted that matches your skills:</p>
          <h2 style="margin: 0 0 8px; font-size: 18px; color: #1e1e2f;">${data.listingTitle}</h2>
          <p style="font-size: 28px; font-weight: bold; color: #059669; margin: 12px 0;">$${data.budgetUsdc} USDC</p>
          <p style="margin: 0 0 16px; font-size: 14px; color: #6b7280;">Posted by: ${data.agentName}</p>
        </td></tr>
        <tr><td align="center" style="padding: 8px 40px 24px;">
          <a href="${data.listingUrl}" style="display: inline-block; background-color: #4F46E5; color: #fefefe; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 36px; border-radius: 8px;">View & Apply</a>
        </td></tr>
        <tr><td style="padding: 24px 40px 32px;">
          <p style="margin: 0; font-size: 12px; color: #8b8ba0;">${t('email.jobOffer.footer')}</p>
          <p style="margin: 8px 0 0;"><a href="${unsubscribeUrl}" style="color: #8b8ba0; font-size: 12px;">Unsubscribe</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
  `.trim();

  return sendEmail({
    to: data.humanEmail,
    subject: `New listing: ${data.listingTitle} — $${data.budgetUsdc} USDC`,
    text: textContent,
    html: htmlContent,
  });
}

// ===== STAFF API KEY EMAIL =====

interface StaffApiKeyEmailData {
  staffName: string;
  staffEmail: string;
  apiKey: string;
}

export async function sendStaffApiKeyEmail(data: StaffApiKeyEmailData): Promise<boolean> {
  if (!process.env.RESEND_API_KEY && !process.env.SES_SMTP_USER) {
    logger.info({ email: data.staffEmail }, 'No email provider configured, skipping staff API key email');
    return false;
  }

  const textContent = `
Hi ${data.staffName},

You've been given a Staff API Key for the Human Pages posting queue extension.

Your API Key:
${data.apiKey}

Setup instructions:
1. Install the Human Pages Posting Queue Chrome extension
2. Click the extension icon → Settings (or right-click → Options)
3. Paste the API key above into the "Staff API Key" field
4. Click "Test Connection" to verify it works
5. Click "Save"

Keep this key private — it gives access to the posting queue under your identity.

---
Human Pages — Staff Tools
  `.trim();

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Your Staff API Key</title>
  <style>
    :root { color-scheme: light dark; }
    @media (prefers-color-scheme: dark) {
      .email-bg { background-color: #1a1a2e !important; }
      .email-card { background-color: #16213e !important; border-color: #2a2a4a !important; }
      .email-heading { color: #f0f0f5 !important; }
      .email-body { color: #c8c8d8 !important; }
      .email-muted { color: #8888a8 !important; }
      .email-key-box { background-color: #1e2a4a !important; border-color: #2a2a4a !important; color: #e0e0f0 !important; }
      .email-steps { background-color: #1e2a4a !important; border-color: #2a2a4a !important; }
      .email-steps li { color: #c8c8d8 !important; }
    }
    [data-ogsc] .email-bg { background-color: #1a1a2e !important; }
    [data-ogsc] .email-card { background-color: #16213e !important; border-color: #2a2a4a !important; }
    [data-ogsc] .email-heading { color: #f0f0f5 !important; }
    [data-ogsc] .email-body { color: #c8c8d8 !important; }
    [data-ogsc] .email-muted { color: #8888a8 !important; }
    [data-ogsc] .email-key-box { background-color: #1e2a4a !important; border-color: #2a2a4a !important; color: #e0e0f0 !important; }
    [data-ogsc] .email-steps { background-color: #1e2a4a !important; border-color: #2a2a4a !important; }
    [data-ogsc] .email-steps li { color: #c8c8d8 !important; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f0f0f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-bg" style="background-color: #f0f0f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" class="email-card" style="max-width: 520px; width: 100%; background-color: #fefefe; border-radius: 12px; border: 1px solid #e2e2ea; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td align="center" style="padding: 32px 40px 24px;">
              <h1 class="email-heading" style="margin: 0; font-size: 22px; font-weight: 600; color: #1e1e2f; line-height: 1.4;">Your Staff API Key</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 0 40px;">
              <p class="email-body" style="margin: 0 0 8px; font-size: 15px; line-height: 1.6; color: #44445a;">Hi ${data.staffName},</p>
              <p class="email-body" style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #44445a;">You've been given a Staff API Key for the Human Pages posting queue extension.</p>
            </td>
          </tr>
          <!-- API Key Box -->
          <tr>
            <td style="padding: 0 40px 16px;">
              <div class="email-key-box" style="background-color: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; font-family: 'Courier New', Courier, monospace; font-size: 14px; word-break: break-all; color: #1e293b;">
                ${data.apiKey}
              </div>
            </td>
          </tr>
          <!-- Setup Steps -->
          <tr>
            <td style="padding: 0 40px 16px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-steps" style="background-color: #f8f8fc; border-radius: 8px; border: 1px solid #e2e2ea;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <p style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #374151;">Setup instructions:</p>
                    <ol style="margin: 0; padding: 0 0 0 20px; font-size: 14px; line-height: 2; color: #44445a;">
                      <li>Install the Human Pages Posting Queue Chrome extension</li>
                      <li>Click the extension icon, then Settings (or right-click, then Options)</li>
                      <li>Paste the API key above into the "Staff API Key" field</li>
                      <li>Click "Test Connection" to verify it works</li>
                      <li>Click "Save"</li>
                    </ol>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Warning -->
          <tr>
            <td style="padding: 0 40px 24px;">
              <p class="email-muted" style="margin: 0; font-size: 13px; line-height: 1.5; color: #8b8ba0;">Keep this key private — it gives access to the posting queue under your identity.</p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 0 40px;">
              <hr style="border: none; border-top: 1px solid #e2e2ea; margin: 0;">
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px 32px;">
              <p class="email-muted" style="margin: 0; font-size: 12px; line-height: 1.5; color: #8b8ba0;">Human Pages — Staff Tools</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  return sendEmail({
    to: data.staffEmail,
    subject: 'Your Human Pages Staff API Key',
    text: textContent,
    html: htmlContent,
  });
}

// --- Moderation Delay Notification ---

interface ModerationDelayEmailData {
  humanName: string;
  humanEmail: string;
  humanId: string;
  jobTitle: string;
  jobDetailUrl: string;
  language?: string;
}

export async function sendModerationDelayEmail(data: ModerationDelayEmailData): Promise<boolean> {
  if (!process.env.RESEND_API_KEY && !process.env.SES_SMTP_USER) {
    logger.info({ jobTitle: data.jobTitle }, 'No email provider configured, skipping moderation delay email');
    return false;
  }

  const t = getTranslator(data.language || 'en');
  const unsubscribeUrl = generateUnsubscribeUrl(data.humanId);

  const textContent = `
Hi ${data.humanName},

A job offer for "${data.jobTitle}" was recently sent to you and is currently being reviewed by our content safety system.

This usually takes just a moment, but it's taking a little longer than usual right now. Your offer should be ready shortly — no action needed on your end.

You can check the status anytime:
${data.jobDetailUrl}

Thanks for your patience!

---
Human Pages — Get hired for real-world tasks

To unsubscribe from email notifications: ${unsubscribeUrl}
  `.trim();

  const htmlContent = `
<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Your job offer is being reviewed</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>
    :root { color-scheme: light dark; }
    @media (prefers-color-scheme: dark) {
      .email-bg { background-color: #1a1a2e !important; }
      .email-card { background-color: #16213e !important; border-color: #2a2a4a !important; }
      .email-heading { color: #f0f0f5 !important; }
      .email-body { color: #c8c8d8 !important; }
      .email-btn { background-color: #6366f1 !important; border-color: #6366f1 !important; }
      .email-muted { color: #8888a8 !important; }
      .email-link { color: #818cf8 !important; }
      .email-divider { border-top-color: #2a2a4a !important; }
    }
    u ~ div .email-bg { background-color: #1a1a2e !important; }
    [data-ogsc] .email-bg { background-color: #1a1a2e !important; }
    [data-ogsc] .email-card { background-color: #16213e !important; border-color: #2a2a4a !important; }
    [data-ogsc] .email-heading { color: #f0f0f5 !important; }
    [data-ogsc] .email-body { color: #c8c8d8 !important; }
    [data-ogsc] .email-btn { background-color: #6366f1 !important; border-color: #6366f1 !important; }
    [data-ogsc] .email-muted { color: #8888a8 !important; }
    [data-ogsc] .email-link { color: #818cf8 !important; }
    [data-ogsc] .email-divider { border-top-color: #2a2a4a !important; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f0f0f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-bg" style="background-color: #f0f0f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" class="email-card" style="max-width: 480px; width: 100%; background-color: #fefefe; border-radius: 12px; border: 1px solid #e2e2ea; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td align="center" style="padding: 32px 40px 24px;">
              <h1 class="email-heading" style="margin: 0; font-size: 22px; font-weight: 600; color: #1e1e2f; line-height: 1.4;">Your job offer is being reviewed</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 0 40px;">
              <p class="email-body" style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #44445a;">Hi ${data.humanName},</p>
              <p class="email-body" style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #44445a;">A job offer for <strong>"${data.jobTitle}"</strong> was sent to you and is currently being reviewed by our content safety system.</p>
              <p class="email-body" style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #44445a;">This usually takes just a moment, but it's taking a little longer than usual right now. Your offer should be ready shortly — no action needed on your end.</p>
            </td>
          </tr>
          <!-- CTA Button -->
          <tr>
            <td align="center" style="padding: 8px 40px 24px;">
              <!--[if mso]>
              <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${data.jobDetailUrl}" style="height:48px;v-text-anchor:middle;width:220px;" arcsize="17%" fill="t">
                <v:fill type="tile" color="#4F46E5" />
                <w:anchorlock/>
                <center style="color:#ffffff;font-family:sans-serif;font-size:15px;font-weight:600;">Check status</center>
              </v:roundrect>
              <![endif]-->
              <!--[if !mso]><!-->
              <a href="${data.jobDetailUrl}" target="_blank" class="email-btn" style="display: inline-block; background-color: #4F46E5; color: #fefefe; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 36px; border-radius: 8px; line-height: 1.5; mso-hide: all; border: 2px solid #4F46E5;">Check status</a>
              <!--<![endif]-->
            </td>
          </tr>
          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <hr class="email-divider" style="border: none; border-top: 1px solid #e2e2ea; margin: 0;">
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px 32px;">
              <p class="email-muted" style="margin: 0; font-size: 12px; line-height: 1.5; color: #8b8ba0;">Human Pages — Get hired for real-world tasks</p>
              <p class="email-muted" style="margin: 8px 0 0; font-size: 12px; line-height: 1.5; color: #8b8ba0;"><a href="${unsubscribeUrl}" class="email-link" style="color: #8b8ba0; text-decoration: underline;">Unsubscribe</a> from email notifications</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  return sendEmail({
    to: data.humanEmail,
    subject: `${data.humanName}, your job offer is being reviewed`,
    text: textContent,
    html: htmlContent,
  });
}

// ===== STAFF PAYMENT OWED NOTIFICATION =====

interface PaymentOwedEmailData {
  staffName: string;
  staffEmail: string;
  hoursWorked: number;
  earnedAmount: number;
  totalPaid: number;
  owedAmount: number;
}

export async function sendPaymentOwedEmail(data: PaymentOwedEmailData): Promise<boolean> {
  if (!process.env.RESEND_API_KEY && !process.env.SES_SMTP_USER) {
    logger.info('No email provider configured, skipping payment owed email');
    return false;
  }

  const textContent = `
Staff Payment Alert

Staff: ${data.staffName} (${data.staffEmail})
Hours worked this month: ${data.hoursWorked.toFixed(1)}h
Earned: $${data.earnedAmount.toFixed(2)}
Total paid: $${data.totalPaid.toFixed(2)}
Remaining owed: $${data.owedAmount.toFixed(2)}

---
Human Pages — Internal Staff Notification
  `.trim();

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Staff Payment Alert</title></head>
<body style="margin:0;padding:0;background:#f0f0f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f0f5;">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#fefefe;border-radius:12px;border:1px solid #e2e2ea;">
        <tr><td style="padding:32px 40px 24px;">
          <h1 style="margin:0;font-size:20px;font-weight:600;color:#1e1e2f;">Staff Payment Alert</h1>
        </td></tr>
        <tr><td style="padding:0 40px 24px;">
          <table width="100%" cellpadding="8" cellspacing="0" style="font-size:14px;color:#44445a;border-collapse:collapse;">
            <tr><td style="border-bottom:1px solid #eee;"><strong>Staff</strong></td><td style="border-bottom:1px solid #eee;">${data.staffName} (${data.staffEmail})</td></tr>
            <tr><td style="border-bottom:1px solid #eee;"><strong>Hours this month</strong></td><td style="border-bottom:1px solid #eee;">${data.hoursWorked.toFixed(1)}h</td></tr>
            <tr><td style="border-bottom:1px solid #eee;"><strong>Earned</strong></td><td style="border-bottom:1px solid #eee;">$${data.earnedAmount.toFixed(2)}</td></tr>
            <tr><td style="border-bottom:1px solid #eee;"><strong>Total paid</strong></td><td style="border-bottom:1px solid #eee;">$${data.totalPaid.toFixed(2)}</td></tr>
            <tr><td><strong style="color:#dc2626;">Remaining owed</strong></td><td><strong style="color:#dc2626;">$${data.owedAmount.toFixed(2)}</strong></td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:0 40px;"><hr style="border:none;border-top:1px solid #e2e2ea;margin:0;"></td></tr>
        <tr><td style="padding:24px 40px 32px;">
          <p style="margin:0;font-size:12px;color:#8b8ba0;">Human Pages — Internal Staff Notification</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
  `.trim();

  return sendEmail({
    to: 'hello@humanpages.ai',
    subject: `Payment owed: $${data.owedAmount.toFixed(2)} to ${data.staffName}`,
    text: textContent,
    html: htmlContent,
  });
}

// Featured invite email — asks a human to opt in to homepage featuring
interface FeaturedInviteEmailData {
  to: string;
  name: string;
  humanId: string;
}

export async function sendFeaturedInviteEmail(data: FeaturedInviteEmailData): Promise<boolean> {
  const dashboardUrl = `${FRONTEND_URL}/dashboard`;
  const unsubscribeUrl = generateUnsubscribeUrl(data.humanId);

  const textContent = `Hi ${data.name},

Your profile on Human Pages is looking great! We'd love to feature you on our homepage to showcase the community to new visitors and AI agents.

What gets shown: your profile photo, name, skills, and location — all info that's already public on your profile.

If you'd like to be featured, just toggle "Feature me on the homepage" in your dashboard privacy settings:
${dashboardUrl}

You can opt out at any time from the same settings page.

Thanks for being part of the community!

— The Human Pages Team

Unsubscribe: ${unsubscribeUrl}`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px;">
    <div style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;padding:32px;">
      <h1 style="font-size:20px;color:#1e293b;margin:0 0 16px;">We'd love to feature you!</h1>
      <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 12px;">
        Hi ${data.name},
      </p>
      <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 12px;">
        Your profile on Human Pages is looking great! We'd love to feature you on our
        <strong>homepage</strong> to showcase the community to new visitors and AI agents.
      </p>
      <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 20px;">
        <strong>What gets shown:</strong> your profile photo, name, skills, and location — all info that's already public on your profile. You can opt out at any time.
      </p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${dashboardUrl}" style="display:inline-block;padding:12px 28px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">
          Go to Dashboard
        </a>
      </div>
      <p style="color:#94a3b8;font-size:13px;line-height:1.5;margin:16px 0 0;">
        Toggle <strong>"Feature me on the homepage"</strong> in your Privacy settings.
      </p>
    </div>
    <p style="color:#94a3b8;font-size:11px;text-align:center;margin:20px 0 0;">
      <a href="${unsubscribeUrl}" style="color:#94a3b8;">Unsubscribe</a>
    </p>
  </div>
</body>
</html>`;

  return sendEmail({
    to: data.to,
    subject: 'We\'d love to feature you on our homepage!',
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
