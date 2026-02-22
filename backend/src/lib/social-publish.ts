import crypto from 'crypto';
import { logger } from './logger.js';

interface ContentItem {
  id: string;
  platform: string;
  tweetDraft: string | null;
  linkedinSnippet: string | null;
  blogSlug: string | null;
  blogTitle: string | null;
}

interface PublishResult {
  success: boolean;
  url?: string;
  error?: string;
  manualInstructions?: string;
}

const SITE_URL = process.env.FRONTEND_URL || 'https://humanpages.ai';

export async function publishContent(item: ContentItem): Promise<PublishResult> {
  switch (item.platform) {
    case 'TWITTER':
      return publishTwitter(item);
    case 'LINKEDIN':
      return publishLinkedIn(item);
    case 'BLOG':
      return publishBlog(item);
    default:
      return { success: false, error: `Unknown platform: ${item.platform}` };
  }
}

// ─── Twitter/X (API v2, OAuth 1.0a) ───

async function publishTwitter(item: ContentItem): Promise<PublishResult> {
  const consumerKey = process.env.TWITTER_CONSUMER_KEY;
  const consumerSecret = process.env.TWITTER_CONSUMER_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;

  if (!consumerKey || !consumerSecret || !accessToken || !accessTokenSecret) {
    return {
      success: false,
      manualInstructions: generateTwitterManualInstructions(item.tweetDraft || ''),
    };
  }

  try {
    const url = 'https://api.twitter.com/2/tweets';
    const method = 'POST';
    const body = JSON.stringify({ text: item.tweetDraft });

    const authHeader = buildOAuth1Header({
      method,
      url,
      consumerKey,
      consumerSecret,
      accessToken,
      accessTokenSecret,
    });

    const resp = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body,
      signal: AbortSignal.timeout(15_000),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      logger.error({ status: resp.status, body: errText }, 'Twitter API error');
      return { success: false, error: `Twitter API ${resp.status}: ${errText.slice(0, 200)}` };
    }

    const data: any = await resp.json();
    const tweetId = data.data?.id;
    const tweetUrl = tweetId ? `https://twitter.com/HumanPagesAI/status/${tweetId}` : undefined;

    return { success: true, url: tweetUrl };
  } catch (e: any) {
    logger.error({ err: e }, 'Twitter publish failed');
    return { success: false, error: e.message };
  }
}

// ─── LinkedIn (Marketing API, OAuth 2.0) ───

async function publishLinkedIn(item: ContentItem): Promise<PublishResult> {
  const accessToken = process.env.LINKEDIN_ACCESS_TOKEN;
  const orgUrn = process.env.LINKEDIN_ORG_URN;

  if (!accessToken || !orgUrn) {
    return {
      success: false,
      manualInstructions: generateLinkedInManualInstructions(item.linkedinSnippet || ''),
    };
  }

  try {
    const url = 'https://api.linkedin.com/v2/ugcPosts';
    const body = {
      author: orgUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: item.linkedinSnippet },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      logger.error({ status: resp.status, body: errText }, 'LinkedIn API error');
      return { success: false, error: `LinkedIn API ${resp.status}: ${errText.slice(0, 200)}` };
    }

    const postId = resp.headers.get('x-restli-id');
    return { success: true, url: postId ? `https://www.linkedin.com/feed/update/${postId}` : undefined };
  } catch (e: any) {
    logger.error({ err: e }, 'LinkedIn publish failed');
    return { success: false, error: e.message };
  }
}

// ─── Blog (internal: set PUBLISHED → visible at /blog/{slug}) ───

async function publishBlog(item: ContentItem): Promise<PublishResult> {
  if (!item.blogSlug) {
    return { success: false, error: 'Blog item has no slug' };
  }

  const url = `${SITE_URL}/blog/${item.blogSlug}`;
  return { success: true, url };
}

// ─── Manual instructions fallback ───

function generateTwitterManualInstructions(text: string): string {
  return `To publish this tweet manually:

1. Open https://twitter.com/compose/tweet
2. Paste this text:
---
${text}
---
3. Click "Post"`;
}

function generateLinkedInManualInstructions(text: string): string {
  return `To publish this LinkedIn post manually:

1. Open https://www.linkedin.com/company/humanpages/admin/feed/
2. Click "Start a post"
3. Paste this text:
---
${text}
---
4. Click "Post"`;
}

// ─── OAuth 1.0a signature for Twitter ───

function buildOAuth1Header(params: {
  method: string;
  url: string;
  consumerKey: string;
  consumerSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString('hex');

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: params.consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: params.accessToken,
    oauth_version: '1.0',
  };

  // Build signature base string
  const sortedParams = Object.keys(oauthParams)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(oauthParams[k])}`)
    .join('&');

  const baseString = `${params.method}&${encodeURIComponent(params.url)}&${encodeURIComponent(sortedParams)}`;
  const signingKey = `${encodeURIComponent(params.consumerSecret)}&${encodeURIComponent(params.accessTokenSecret)}`;

  const signature = crypto
    .createHmac('sha1', signingKey)
    .update(baseString)
    .digest('base64');

  oauthParams['oauth_signature'] = signature;

  const headerValue = Object.keys(oauthParams)
    .sort()
    .map((k) => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
    .join(', ');

  return `OAuth ${headerValue}`;
}
