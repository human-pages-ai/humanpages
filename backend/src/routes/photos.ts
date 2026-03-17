import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import {
  processProfileImage,
  uploadProfilePhoto,
  getProfilePhotoSignedUrl,
  deleteProfilePhoto,
  downloadExternalImage,
} from '../lib/storage.js';
import { queueModeration } from '../lib/moderation.js';
import { logger } from '../lib/logger.js';

const router = Router();

/**
 * Validate image file type by magic bytes (file signature), not just MIME type.
 * Prevents upload of disguised files with spoofed Content-Type headers.
 */
function validateImageMagicBytes(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return true;
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return true;
  // WebP: RIFF....WEBP
  if (buffer.length >= 12 &&
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) return true;
  return false;
}

// Multer: memory storage, 2MB limit, images only
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
    }
  },
});

// Rate limit: 5 uploads per hour per user
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: (req: any) => req.userId || 'unknown',
  message: { error: 'Too many uploads. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

// POST /upload — Direct file upload
router.post('/upload', authenticateToken, uploadLimiter, upload.single('photo'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No photo file provided' });
    }

    // Validate file signature (magic bytes) to prevent spoofed Content-Type
    if (!validateImageMagicBytes(req.file.buffer)) {
      return res.status(400).json({ error: 'Invalid image file. File signature does not match an allowed image type.' });
    }

    // Process image: resize to 256x256, convert to WebP
    let processed: Buffer;
    try {
      processed = await processProfileImage(req.file.buffer);
    } catch {
      return res.status(400).json({ error: 'Invalid image file. Please upload a JPEG, PNG, or WebP image.' });
    }

    // Delete old photo from R2 if exists
    const human = await prisma.human.findUnique({
      where: { id: req.userId },
      select: { profilePhotoKey: true },
    });
    if (human?.profilePhotoKey) {
      await deleteProfilePhoto(human.profilePhotoKey);
    }

    // Upload new photo to R2
    const key = await uploadProfilePhoto(req.userId!, processed);

    // Update DB
    await prisma.human.update({
      where: { id: req.userId },
      data: {
        profilePhotoKey: key,
        profilePhotoStatus: 'pending',
      },
    });

    // Queue moderation check
    await queueModeration('profile_photo', req.userId!);

    // Generate signed URL for immediate display
    const signedUrl = await getProfilePhotoSignedUrl(key);

    res.json({ profilePhotoUrl: signedUrl, profilePhotoStatus: 'pending' });
  } catch (error) {
    logger.error({ err: error }, 'Photo upload error');
    res.status(500).json({ error: 'Failed to upload photo' });
  }
});

// POST /import-oauth — Import photo from OAuth provider
const importOAuthSchema = z.object({
  provider: z.enum(['google', 'linkedin']),
});

router.post('/import-oauth', authenticateToken, uploadLimiter, async (req: AuthRequest, res) => {
  try {
    const { provider } = importOAuthSchema.parse(req.body);

    const human = await prisma.human.findUnique({
      where: { id: req.userId },
      select: { oauthPhotoUrl: true, profilePhotoKey: true },
    });

    if (!human?.oauthPhotoUrl) {
      return res.status(400).json({ error: `No ${provider} photo available to import` });
    }

    // Download the OAuth photo
    let rawBuffer: Buffer;
    try {
      rawBuffer = await downloadExternalImage(human.oauthPhotoUrl);
    } catch {
      return res.status(400).json({ error: 'Failed to download photo from provider. Please upload a photo directly.' });
    }

    // Process image
    let processed: Buffer;
    try {
      processed = await processProfileImage(rawBuffer);
    } catch {
      return res.status(400).json({ error: 'Provider photo could not be processed. Please upload a photo directly.' });
    }

    // Delete old photo from R2 if exists
    if (human.profilePhotoKey) {
      await deleteProfilePhoto(human.profilePhotoKey);
    }

    // Upload to R2
    const key = await uploadProfilePhoto(req.userId!, processed);

    // Update DB: set photo key, clear oauthPhotoUrl
    // OAuth photos (Google, LinkedIn) are pre-vetted by the provider — auto-approve
    await prisma.human.update({
      where: { id: req.userId },
      data: {
        profilePhotoKey: key,
        profilePhotoStatus: 'approved',
        oauthPhotoUrl: null,
      },
    });

    // No moderation needed — OAuth provider already vetted the photo

    const signedUrl = await getProfilePhotoSignedUrl(key);
    res.json({ profilePhotoUrl: signedUrl, profilePhotoStatus: 'approved' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
    }
    logger.error({ err: error }, 'OAuth photo import error');
    res.status(500).json({ error: 'Failed to import photo' });
  }
});

// DELETE / — Remove profile photo
router.delete('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const human = await prisma.human.findUnique({
      where: { id: req.userId },
      select: { profilePhotoKey: true },
    });

    if (!human?.profilePhotoKey) {
      return res.status(404).json({ error: 'No profile photo to delete' });
    }

    // Delete from R2
    await deleteProfilePhoto(human.profilePhotoKey);

    // Clear DB fields and dismiss any pending moderation items
    await prisma.$transaction([
      prisma.human.update({
        where: { id: req.userId },
        data: { profilePhotoKey: null, profilePhotoStatus: 'none' },
      }),
      prisma.moderationQueue.updateMany({
        where: {
          contentType: 'profile_photo',
          contentId: req.userId!,
          status: 'pending',
        },
        data: { status: 'approved', errorMessage: 'Photo deleted by user', reviewedAt: new Date() },
      }),
    ]);

    res.json({ message: 'Photo deleted' });
  } catch (error) {
    logger.error({ err: error }, 'Photo delete error');
    res.status(500).json({ error: 'Failed to delete photo' });
  }
});

// Handle multer errors
router.use((err: any, _req: any, res: any, next: any) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 2MB.' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err?.message?.includes('Only JPEG')) {
    return res.status(400).json({ error: 'Only JPEG, PNG, and WebP images are allowed' });
  }
  next(err);
});

export default router;
