import crypto from 'crypto';
import { logger } from './logger.js';
import { getR2ObjectBuffer, getSignedDownloadUrl } from './storage.js';

interface ContentItem {
  id: string;
  platform: string;
  tweetDraft: string | null;
  linkedinSnippet: string | null;
  blogSlug: string | null;
  blogTitle: string | null;
  blogBody: string | null;
  publishedUrl: string | null;
  imageR2Key: string | null;
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
      manualInstructions: generateTwitterManualInstructions(item.tweetDraft || '', !!item.imageR2Key),
    };
  }

  try {
    // Upload image to Twitter if available
    let mediaId: string | undefined;
    if (item.imageR2Key) {
      try {
        const imageBuffer = await getR2ObjectBuffer(item.imageR2Key);
        if (imageBuffer) {
          mediaId = await uploadTwitterMedia(imageBuffer, {
            consumerKey, consumerSecret, accessToken, accessTokenSecret,
          });
        }
      } catch (imgErr) {
        logger.warn({ err: imgErr }, 'Failed to upload image to Twitter, posting without media');
      }
    }

    const url = 'https://api.twitter.com/2/tweets';
    const method = 'POST';
    const tweetBody: any = { text: item.tweetDraft };
    if (mediaId) {
      tweetBody.media = { media_ids: [mediaId] };
    }
    const body = JSON.stringify(tweetBody);

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
      manualInstructions: generateLinkedInManualInstructions(item.linkedinSnippet || '', !!item.imageR2Key),
    };
  }

  try {
    // Resolve image URL for LinkedIn share
    let imageUrl: string | null = null;
    if (item.imageR2Key) {
      try {
        imageUrl = await getSignedDownloadUrl(item.imageR2Key, 86400); // 24h expiry
      } catch (imgErr) {
        logger.warn({ err: imgErr }, 'Failed to resolve image URL for LinkedIn');
      }
    }

    const shareContent: any = {
      shareCommentary: { text: item.linkedinSnippet },
      shareMediaCategory: imageUrl ? 'ARTICLE' : 'NONE',
    };
    if (imageUrl) {
      shareContent.media = [{
        status: 'READY',
        originalUrl: imageUrl,
        title: { text: item.blogTitle || item.linkedinSnippet?.slice(0, 100) || 'Human Pages' },
      }];
    }

    const url = 'https://api.linkedin.com/v2/ugcPosts';
    const body = {
      author: orgUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': shareContent,
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

function generateTwitterManualInstructions(text: string, hasImage: boolean): string {
  const imageNote = hasImage ? '\n4. Don\'t forget to attach the image from the content manager' : '';
  return `To publish this tweet manually:

1. Open https://twitter.com/compose/tweet
2. Paste this text:
---
${text}
---
3. Click "Post"${imageNote}`;
}

function generateLinkedInManualInstructions(text: string, hasImage: boolean): string {
  const imageNote = hasImage ? '\n5. Don\'t forget to attach the image from the content manager' : '';
  return `To publish this LinkedIn post manually:

1. Open https://www.linkedin.com/company/humanpages/admin/feed/
2. Click "Start a post"
3. Paste this text:
---
${text}
---
4. Click "Post"${imageNote}`;
}

// ─── Cross-posting to external blog platforms ───

export interface CrosspostResult {
  success: boolean;
  url?: string;
  externalId?: string;
  error?: string;
  manualInstructions?: string;
}

export async function crosspostToDevTo(
  item: ContentItem,
  tags?: string[],
): Promise<CrosspostResult> {
  const apiKey = process.env.DEVTO_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      manualInstructions: generateDevToManualInstructions(item),
    };
  }

  try {
    const body = {
      article: {
        title: item.blogTitle || item.blogSlug || 'Untitled',
        body_markdown: item.blogBody || '',
        published: true,
        canonical_url: item.publishedUrl || undefined,
        tags: (tags || ['ai', 'hiring', 'web3']).slice(0, 4),
      },
    };

    const resp = await fetch('https://dev.to/api/articles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      logger.error({ status: resp.status, body: errText }, 'Dev.to API error');
      return { success: false, error: `Dev.to API ${resp.status}: ${errText.slice(0, 200)}` };
    }

    const data: any = await resp.json();
    return {
      success: true,
      url: data.url,
      externalId: String(data.id),
    };
  } catch (e: any) {
    logger.error({ err: e }, 'Dev.to crosspost failed');
    return { success: false, error: e.message };
  }
}

export async function crosspostToHashnode(
  item: ContentItem,
): Promise<CrosspostResult> {
  const apiKey = process.env.HASHNODE_API_KEY;
  const publicationId = process.env.HASHNODE_PUBLICATION_ID;

  if (!apiKey || !publicationId) {
    return {
      success: false,
      manualInstructions: generateHashnodeManualInstructions(item),
    };
  }

  try {
    const mutation = `
      mutation PublishPost($input: PublishPostInput!) {
        publishPost(input: $input) {
          post {
            id
            url
          }
        }
      }
    `;

    const variables = {
      input: {
        title: item.blogTitle || item.blogSlug || 'Untitled',
        contentMarkdown: item.blogBody || '',
        publicationId,
        originalArticleURL: item.publishedUrl || undefined,
        tags: [],
      },
    };

    const resp = await fetch('https://gql.hashnode.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': apiKey,
      },
      body: JSON.stringify({ query: mutation, variables }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      logger.error({ status: resp.status, body: errText }, 'Hashnode API error');
      return { success: false, error: `Hashnode API ${resp.status}: ${errText.slice(0, 200)}` };
    }

    const data: any = await resp.json();

    if (data.errors?.length) {
      const errMsg = data.errors.map((e: any) => e.message).join('; ');
      logger.error({ errors: data.errors }, 'Hashnode GraphQL errors');
      return { success: false, error: `Hashnode: ${errMsg.slice(0, 200)}` };
    }

    const post = data.data?.publishPost?.post;
    return {
      success: true,
      url: post?.url,
      externalId: post?.id,
    };
  } catch (e: any) {
    logger.error({ err: e }, 'Hashnode crosspost failed');
    return { success: false, error: e.message };
  }
}

function generateDevToManualInstructions(item: ContentItem): string {
  return `To cross-post this article to Dev.to manually:

1. Open https://dev.to/new
2. Paste the title: ${item.blogTitle || ''}
3. Paste the article body (Markdown)
4. Set canonical URL to: ${item.publishedUrl || ''}
5. Add tags: ai, hiring, web3
6. Click "Publish"`;
}

function generateHashnodeManualInstructions(item: ContentItem): string {
  return `To cross-post this article to Hashnode manually:

1. Open your Hashnode dashboard
2. Click "Write an article"
3. Paste the title: ${item.blogTitle || ''}
4. Paste the article body (Markdown)
5. Set original article URL to: ${item.publishedUrl || ''}
6. Click "Publish"`;
}

// ─── Twitter media upload (v1.1 chunked) ───

async function uploadTwitterMedia(
  imageBuffer: Buffer,
  creds: { consumerKey: string; consumerSecret: string; accessToken: string; accessTokenSecret: string },
): Promise<string> {
  const mediaUploadUrl = 'https://upload.twitter.com/1.1/media/upload.json';

  const authHeader = buildOAuth1Header({
    method: 'POST',
    url: mediaUploadUrl,
    ...creds,
  });

  const formData = new FormData();
  formData.append('media_data', imageBuffer.toString('base64'));

  const resp = await fetch(mediaUploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
    },
    body: formData,
    signal: AbortSignal.timeout(30_000),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Twitter media upload ${resp.status}: ${errText.slice(0, 200)}`);
  }

  const data: any = await resp.json();
  return data.media_id_string;
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
