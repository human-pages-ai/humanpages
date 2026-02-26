import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { getSignedDownloadUrl } from '../lib/storage.js';

const router = Router();

// GET /api/blog/posts — paginated list of PUBLISHED BLOG items (no auth)
router.get('/posts', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));

    const where = {
      platform: 'BLOG' as const,
      status: 'PUBLISHED' as const,
    };

    const [rawPosts, total] = await Promise.all([
      prisma.contentItem.findMany({
        where,
        select: {
          id: true,
          blogTitle: true,
          blogSlug: true,
          blogExcerpt: true,
          blogReadingTime: true,
          isFeatured: true,
          publishedAt: true,
          createdAt: true,
          blogThumbR2Key: true,
        },
        orderBy: [{ isFeatured: 'desc' }, { publishedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.contentItem.count({ where }),
    ]);

    // Resolve thumb R2 keys to signed URLs (don't expose raw keys publicly)
    const posts = await Promise.all(
      rawPosts.map(async ({ blogThumbR2Key, ...post }) => ({
        ...post,
        blogThumbUrl: blogThumbR2Key ? await getSignedDownloadUrl(blogThumbR2Key) : null,
      })),
    );

    res.json({
      posts,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error({ err: error }, 'Blog posts list error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/blog/posts/:slug — single article by slug (no auth)
router.get('/posts/:slug', async (req, res) => {
  try {
    const rawPost = await prisma.contentItem.findFirst({
      where: {
        blogSlug: req.params.slug,
        platform: 'BLOG',
        status: 'PUBLISHED',
      },
      select: {
        id: true,
        blogTitle: true,
        blogSlug: true,
        blogBody: true,
        blogExcerpt: true,
        blogReadingTime: true,
        isFeatured: true,
        metaDescription: true,
        sourceTitle: true,
        sourceUrl: true,
        publishedAt: true,
        createdAt: true,
        blogImageR2Key: true,
      },
    });

    if (!rawPost) {
      return res.status(404).json({ error: 'Blog post not found' });
    }

    // Resolve image R2 key to signed URL (don't expose raw key publicly)
    const { blogImageR2Key, ...post } = rawPost;
    const blogImageUrl = blogImageR2Key ? await getSignedDownloadUrl(blogImageR2Key) : null;

    res.json({ ...post, blogImageUrl });
  } catch (error) {
    logger.error({ err: error }, 'Blog post detail error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
