import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { authenticateAgent, AgentAuthRequest } from '../middleware/agentAuth.js';
import { prisma } from '../lib/prisma.js';
import {
  processProfileImage,
  uploadProfilePhoto,
  getProfilePhotoSignedUrl,
  deleteProfilePhoto,
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

// Rate limit: 5 uploads per hour per agent
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: (req: any) => req.agent?.id || 'unknown',
  message: { error: 'Too many uploads. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

// Rate limit: 20 uploads per day per agent
const dailyUploadLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 20,
  keyGenerator: (req: any) => req.agent?.id || 'unknown',
  message: { error: 'Daily upload limit reached. Try again tomorrow.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

// POST /upload — Agent photo upload
router.post('/upload', authenticateAgent, uploadLimiter, dailyUploadLimiter, upload.single('photo'), async (req: AgentAuthRequest, res) => {
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

    const agentId = req.agent!.id;

    // Delete old photo from R2 if exists
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { profilePhotoKey: true },
    });
    if (agent?.profilePhotoKey) {
      await deleteProfilePhoto(agent.profilePhotoKey);
    }

    // Upload new photo to R2
    const key = await uploadProfilePhoto(agentId, processed);

    // Update DB
    await prisma.agent.update({
      where: { id: agentId },
      data: { profilePhotoKey: key, profilePhotoStatus: 'pending' },
    });

    // Queue moderation check
    await queueModeration('agent_photo', agentId);

    // Generate signed URL for immediate display
    const signedUrl = await getProfilePhotoSignedUrl(key);

    res.json({ profilePhotoUrl: signedUrl, profilePhotoStatus: 'pending' });
  } catch (error) {
    logger.error({ err: error }, 'Agent photo upload error');
    res.status(500).json({ error: 'Failed to upload photo' });
  }
});

// DELETE / — Remove agent profile photo
router.delete('/', authenticateAgent, async (req: AgentAuthRequest, res) => {
  try {
    const agentId = req.agent!.id;

    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { profilePhotoKey: true },
    });

    if (!agent?.profilePhotoKey) {
      return res.status(404).json({ error: 'No profile photo to delete' });
    }

    // Delete from R2
    await deleteProfilePhoto(agent.profilePhotoKey);

    // Clear DB fields and dismiss any pending moderation items
    await prisma.$transaction([
      prisma.agent.update({
        where: { id: agentId },
        data: { profilePhotoKey: null, profilePhotoStatus: 'none' },
      }),
      prisma.moderationQueue.updateMany({
        where: {
          contentType: 'agent_photo',
          contentId: agentId,
          status: 'pending',
        },
        data: { status: 'approved', errorMessage: 'Photo deleted by agent', reviewedAt: new Date() },
      }),
    ]);

    res.json({ message: 'Photo deleted' });
  } catch (error) {
    logger.error({ err: error }, 'Agent photo delete error');
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
