import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

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

    const [posts, total] = await Promise.all([
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
        },
        orderBy: [{ isFeatured: 'desc' }, { publishedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.contentItem.count({ where }),
    ]);

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
    const post = await prisma.contentItem.findFirst({
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
      },
    });

    if (!post) {
      return res.status(404).json({ error: 'Blog post not found' });
    }

    res.json(post);
  } catch (error) {
    logger.error({ err: error }, 'Blog post detail error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
