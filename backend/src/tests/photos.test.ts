import request from 'supertest';
import path from 'path';
import sharp from 'sharp';
import app from '../app.js';
import { prisma } from './setup.js';
import { cleanDatabase, createTestUser, type TestUser } from './helpers.js';

// Mock storage module — avoid real R2 calls
vi.mock('../lib/storage.js', async () => {
  const actual = await vi.importActual('../lib/storage.js') as any;
  return {
    ...actual,
    isStorageConfigured: () => true,
    processProfileImage: vi.fn().mockResolvedValue(Buffer.alloc(50)), // Return small fake WebP buffer
    uploadProfilePhoto: vi.fn().mockResolvedValue('photos/test-user/fake-uuid.webp'),
    getProfilePhotoSignedUrl: vi.fn().mockResolvedValue('https://r2.example.com/signed-url'),
    deleteProfilePhoto: vi.fn().mockResolvedValue(undefined),
    downloadExternalImage: vi.fn().mockResolvedValue(Buffer.alloc(100)),
  };
});

// Mock moderation — no real OpenAI calls
vi.mock('../lib/moderation.js', async () => {
  const actual = await vi.importActual('../lib/moderation.js') as any;
  return {
    ...actual,
    isModerationEnabled: () => false,
    queueModeration: vi.fn().mockResolvedValue(undefined),
  };
});

const { uploadProfilePhoto, deleteProfilePhoto } = await import('../lib/storage.js');
const { queueModeration } = await import('../lib/moderation.js');

function authRequest(token: string) {
  return {
    post: (url: string) => request(app).post(url).set('Authorization', `Bearer ${token}`),
    delete: (url: string) => request(app).delete(url).set('Authorization', `Bearer ${token}`),
    get: (url: string) => request(app).get(url).set('Authorization', `Bearer ${token}`),
  };
}

/**
 * Generate a minimal valid JPEG buffer for upload testing.
 */
async function createTestImage(format: 'jpeg' | 'png' | 'webp' = 'jpeg', width = 100, height = 100): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 128, g: 128, b: 128 },
    },
  })[format]().toBuffer();
}

describe('Photo Upload Routes', () => {
  let user: TestUser;

  beforeEach(async () => {
    await cleanDatabase();
    vi.clearAllMocks();
    user = await createTestUser();
  });

  describe('POST /api/photos/upload', () => {
    it('should upload a valid JPEG image', async () => {
      const image = await createTestImage('jpeg');

      const res = await authRequest(user.token)
        .post('/api/photos/upload')
        .attach('photo', image, { filename: 'photo.jpg', contentType: 'image/jpeg' });

      expect(res.status).toBe(200);
      expect(res.body.profilePhotoUrl).toBe('https://r2.example.com/signed-url');
      expect(res.body.profilePhotoStatus).toBe('pending');

      // Verify DB was updated
      const human = await prisma.human.findUnique({ where: { id: user.id } });
      expect(human!.profilePhotoKey).toBe('photos/test-user/fake-uuid.webp');
      expect(human!.profilePhotoStatus).toBe('pending');
      expect(human!.featuredConsent).toBe(true);

      // Verify moderation was queued
      expect(queueModeration).toHaveBeenCalledWith('profile_photo', user.id);
    });

    it('should upload a valid PNG image', async () => {
      const image = await createTestImage('png');

      const res = await authRequest(user.token)
        .post('/api/photos/upload')
        .attach('photo', image, { filename: 'photo.png', contentType: 'image/png' });

      expect(res.status).toBe(200);
      expect(res.body.profilePhotoUrl).toBeTruthy();
    });

    it('should upload a valid WebP image', async () => {
      const image = await createTestImage('webp');

      const res = await authRequest(user.token)
        .post('/api/photos/upload')
        .attach('photo', image, { filename: 'photo.webp', contentType: 'image/webp' });

      expect(res.status).toBe(200);
    });

    it('should reject non-image files', async () => {
      const res = await authRequest(user.token)
        .post('/api/photos/upload')
        .attach('photo', Buffer.from('not an image'), { filename: 'file.txt', contentType: 'text/plain' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/JPEG|PNG|WebP/i);
    });

    it('should reject oversized files', async () => {
      // Create a buffer > 2MB
      const largeBuffer = Buffer.alloc(2.1 * 1024 * 1024);

      const res = await authRequest(user.token)
        .post('/api/photos/upload')
        .attach('photo', largeBuffer, { filename: 'big.jpg', contentType: 'image/jpeg' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/too large|2MB/i);
    });

    it('should reject requests without a file', async () => {
      const res = await authRequest(user.token)
        .post('/api/photos/upload');

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/no photo/i);
    });

    it('should reject unauthenticated requests', async () => {
      const image = await createTestImage('jpeg');

      const res = await request(app)
        .post('/api/photos/upload')
        .attach('photo', image, { filename: 'photo.jpg', contentType: 'image/jpeg' });

      expect(res.status).toBe(401);
    });

    it('should delete old photo before uploading new one', async () => {
      // Set an existing photo key
      await prisma.human.update({
        where: { id: user.id },
        data: { profilePhotoKey: 'photos/old-key.webp', profilePhotoStatus: 'approved' },
      });

      const image = await createTestImage('jpeg');
      await authRequest(user.token)
        .post('/api/photos/upload')
        .attach('photo', image, { filename: 'photo.jpg', contentType: 'image/jpeg' });

      expect(deleteProfilePhoto).toHaveBeenCalledWith('photos/old-key.webp');
      expect(uploadProfilePhoto).toHaveBeenCalled();
    });
  });

  describe('POST /api/photos/import-oauth', () => {
    it('should import a Google OAuth photo', async () => {
      // Set oauthPhotoUrl in DB
      await prisma.human.update({
        where: { id: user.id },
        data: { oauthPhotoUrl: 'https://lh3.googleusercontent.com/photo.jpg' },
      });

      const res = await authRequest(user.token)
        .post('/api/photos/import-oauth')
        .send({ provider: 'google' });

      expect(res.status).toBe(200);
      expect(res.body.profilePhotoStatus).toBe('approved');

      // Verify oauthPhotoUrl was cleared and photo auto-approved
      const human = await prisma.human.findUnique({ where: { id: user.id } });
      expect(human!.oauthPhotoUrl).toBeNull();
      expect(human!.profilePhotoStatus).toBe('approved');
      expect(human!.featuredConsent).toBe(true);
    });

    it('should reject if no oauth photo URL exists', async () => {
      const res = await authRequest(user.token)
        .post('/api/photos/import-oauth')
        .send({ provider: 'google' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/no.*photo/i);
    });

    it('should reject invalid provider', async () => {
      const res = await authRequest(user.token)
        .post('/api/photos/import-oauth')
        .send({ provider: 'facebook' });

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/photos', () => {
    it('should delete an existing photo', async () => {
      await prisma.human.update({
        where: { id: user.id },
        data: { profilePhotoKey: 'photos/key.webp', profilePhotoStatus: 'approved' },
      });

      const res = await authRequest(user.token)
        .delete('/api/photos');

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/deleted/i);

      // Verify DB cleared
      const human = await prisma.human.findUnique({ where: { id: user.id } });
      expect(human!.profilePhotoKey).toBeNull();
      expect(human!.profilePhotoStatus).toBe('none');

      // Verify R2 delete called
      expect(deleteProfilePhoto).toHaveBeenCalledWith('photos/key.webp');
    });

    it('should return 404 if no photo exists', async () => {
      const res = await authRequest(user.token)
        .delete('/api/photos');

      expect(res.status).toBe(404);
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app).delete('/api/photos');
      expect(res.status).toBe(401);
    });
  });
});

describe('Photo Fields in Profile Responses', () => {
  let user: TestUser;

  beforeEach(async () => {
    await cleanDatabase();
    vi.clearAllMocks();
    user = await createTestUser();
  });

  it('GET /me should include profilePhotoUrl and not expose R2 key', async () => {
    await prisma.human.update({
      where: { id: user.id },
      data: { profilePhotoKey: 'photos/key.webp', profilePhotoStatus: 'approved' },
    });

    const res = await authRequest(user.token).get('/api/humans/me');

    expect(res.status).toBe(200);
    expect(res.body.profilePhotoUrl).toBe('https://r2.example.com/signed-url');
    expect(res.body.profilePhotoKey).toBeUndefined();
    expect(res.body.oauthPhotoUrl).toBeUndefined();
  });

  it('GET /me should not include photo URL for rejected photos', async () => {
    await prisma.human.update({
      where: { id: user.id },
      data: { profilePhotoKey: 'photos/key.webp', profilePhotoStatus: 'rejected' },
    });

    const res = await authRequest(user.token).get('/api/humans/me');

    expect(res.status).toBe(200);
    expect(res.body.profilePhotoUrl).toBeUndefined();
    expect(res.body.profilePhotoKey).toBeUndefined();
  });

  it('public profile should include photo URL for approved photos', async () => {
    await prisma.human.update({
      where: { id: user.id },
      data: {
        profilePhotoKey: 'photos/key.webp',
        profilePhotoStatus: 'approved',
        emailVerified: true,
      },
    });

    const res = await request(app).get(`/api/humans/${user.id}`);

    expect(res.status).toBe(200);
    expect(res.body.profilePhotoUrl).toBe('https://r2.example.com/signed-url');
    expect(res.body.profilePhotoKey).toBeUndefined();
  });
});
