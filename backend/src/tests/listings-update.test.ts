import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { Decimal } from '@prisma/client/runtime/library';
import app from '../app.js';
import { prisma } from '../lib/prisma.js';
import { cleanDatabase, createActiveTestAgent, createTestUser, TestAgent, TestUser } from './helpers.js';

// Mock webhook delivery so tests don't make real HTTP calls
vi.mock('../lib/webhook.js', () => ({
  isAllowedUrl: vi.fn().mockResolvedValue(true),
  deliverWebhook: vi.fn().mockResolvedValue(undefined),
}));

// Mock listing covers (no sharp/canvas dependency in tests)
vi.mock('../lib/listingCovers.js', () => ({
  generateListingCover: vi.fn().mockResolvedValue(Buffer.from('fake-svg')),
}));

// Mock storage (no R2 in tests)
vi.mock('../lib/storage.js', () => ({
  processProfileImage: vi.fn(),
  uploadProfilePhoto: vi.fn().mockResolvedValue('test-cover-key'),
  getProfilePhotoSignedUrl: vi.fn().mockResolvedValue('https://cdn.example.com/signed-image.webp'),
  deleteProfilePhoto: vi.fn(),
  downloadExternalImage: vi.fn().mockResolvedValue(Buffer.alloc(1024)), // 1KB fake image
}));

// Mock posthog
vi.mock('../lib/posthog.js', () => ({
  trackServerEvent: vi.fn(),
}));

// Mock moderation
vi.mock('../lib/moderation.js', () => ({
  queueModeration: vi.fn(),
  moderateText: vi.fn().mockResolvedValue({ flagged: false }),
}));

// Mock email
vi.mock('../lib/email.js', () => ({
  sendJobOfferEmail: vi.fn().mockResolvedValue(true),
  sendListingTermsChangedEmail: vi.fn().mockResolvedValue(true),
}));

// Mock sharp (image processing)
vi.mock('sharp', () => {
  const sharpInstance = {
    rotate: vi.fn().mockReturnThis(),
    resize: vi.fn().mockReturnThis(),
    withMetadata: vi.fn().mockReturnThis(),
    webp: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.alloc(512)),
  };
  return { default: vi.fn(() => sharpInstance) };
});

// Mock OpenAI client (for DALL-E generation)
vi.mock('../lib/openai-keys.js', () => ({
  createOpenAIClient: vi.fn(() => ({
    images: {
      generate: vi.fn().mockResolvedValue({
        data: [{ b64_json: Buffer.from('fake-dalle-image').toString('base64') }],
      }),
    },
  })),
}));

import { isAllowedUrl, deliverWebhook } from '../lib/webhook.js';
import { generateListingCover } from '../lib/listingCovers.js';
import { uploadProfilePhoto, getProfilePhotoSignedUrl, deleteProfilePhoto, downloadExternalImage } from '../lib/storage.js';
import { trackServerEvent } from '../lib/posthog.js';
import { queueModeration, moderateText } from '../lib/moderation.js';
import { createOpenAIClient } from '../lib/openai-keys.js';
import { sendListingTermsChangedEmail } from '../lib/email.js';

const mockIsAllowedUrl = vi.mocked(isAllowedUrl);
const mockDeliverWebhook = vi.mocked(deliverWebhook);
const mockGenerateListingCover = vi.mocked(generateListingCover);
const mockTrackServerEvent = vi.mocked(trackServerEvent);
const mockDownloadExternalImage = vi.mocked(downloadExternalImage);
const mockUploadProfilePhoto = vi.mocked(uploadProfilePhoto);
const mockGetProfilePhotoSignedUrl = vi.mocked(getProfilePhotoSignedUrl);
const mockDeleteProfilePhoto = vi.mocked(deleteProfilePhoto);
const mockQueueModeration = vi.mocked(queueModeration);
const mockModerateText = vi.mocked(moderateText);
const mockCreateOpenAIClient = vi.mocked(createOpenAIClient);
const mockSendListingTermsChangedEmail = vi.mocked(sendListingTermsChangedEmail);

// ── Helpers ─────────────────────────────────────────────

function futureDate(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

async function createTestListing(agent: TestAgent, overrides?: Record<string, any>) {
  return prisma.listing.create({
    data: {
      agentId: agent.id,
      title: 'Original Title',
      description: 'Original description for testing updates.',
      category: 'data-labeling',
      budgetUsdc: new Decimal(50),
      budgetFlexible: false,
      requiredSkills: ['python', 'sql'],
      requiredEquipment: [],
      workMode: 'REMOTE',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'OPEN',
      ...overrides,
    },
  });
}

function patchListing(agentApiKey: string, listingId: string, body: Record<string, any>) {
  return request(app)
    .patch(`/api/listings/${listingId}`)
    .set('X-Agent-Key', agentApiKey)
    .send(body);
}

async function createTestApplication(listingId: string, humanId: string, overrides?: Record<string, any>) {
  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  return prisma.listingApplication.create({
    data: {
      listingId,
      humanId,
      pitch: 'I am a great fit for this role.',
      status: 'PENDING',
      listingSnapshot: listing ? {
        title: listing.title,
        description: listing.description,
        budgetUsdc: listing.budgetUsdc.toString(),
        budgetFlexible: listing.budgetFlexible,
        workMode: listing.workMode,
        location: listing.location,
        locationLat: listing.locationLat,
        locationLng: listing.locationLng,
        radiusKm: listing.radiusKm,
      } : undefined,
      ...overrides,
    },
  });
}

// ── Tests ───────────────────────────────────────────────

describe('PATCH /api/listings/:id — Update Listing', () => {
  let agent: TestAgent;

  beforeEach(async () => {
    await cleanDatabase();
    vi.clearAllMocks();
    mockIsAllowedUrl.mockResolvedValue(true);
    mockDeliverWebhook.mockResolvedValue(undefined);
    mockGenerateListingCover.mockResolvedValue(Buffer.from('fake-svg'));
    mockDownloadExternalImage.mockResolvedValue(Buffer.alloc(1024));
    mockUploadProfilePhoto.mockResolvedValue('test-cover-key');
    mockGetProfilePhotoSignedUrl.mockResolvedValue('https://cdn.example.com/signed-image.webp');
    mockModerateText.mockResolvedValue({ flagged: false } as any);
    agent = await createActiveTestAgent({ tier: 'PRO' });
  });

  // ── Happy path ──────────────────────────────────────

  describe('successful updates', () => {
    it('should update a single field (title)', async () => {
      const listing = await createTestListing(agent);

      const res = await patchListing(agent.apiKey, listing.id, {
        title: 'Updated Title',
      });

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(listing.id);
      expect(res.body.status).toBe('OPEN');
      expect(res.body.message).toBe('Listing updated successfully.');
      expect(res.body.updatedFields).toEqual(['title']);

      const dbListing = await prisma.listing.findUnique({ where: { id: listing.id } });
      expect(dbListing!.title).toBe('Updated Title');
      expect(dbListing!.description).toBe('Original description for testing updates.');
    });

    it('should update multiple fields at once', async () => {
      const listing = await createTestListing(agent);
      const newExpiry = futureDate(60);

      const res = await patchListing(agent.apiKey, listing.id, {
        title: 'New Title',
        description: 'New description.',
        budgetUsdc: 100,
        budgetFlexible: true,
        requiredSkills: ['typescript', 'react'],
        workMode: 'HYBRID',
        expiresAt: newExpiry,
        maxApplicants: 50,
      });

      expect(res.status).toBe(200);
      expect(res.body.updatedFields).toHaveLength(8);

      const dbListing = await prisma.listing.findUnique({ where: { id: listing.id } });
      expect(dbListing!.title).toBe('New Title');
      expect(dbListing!.description).toBe('New description.');
      expect(dbListing!.budgetUsdc.toNumber()).toBe(100);
      expect(dbListing!.budgetFlexible).toBe(true);
      expect(dbListing!.requiredSkills).toEqual(['typescript', 'react']);
      expect(dbListing!.workMode).toBe('HYBRID');
      expect(dbListing!.maxApplicants).toBe(50);
    });

    it('should clear nullable fields by passing null', async () => {
      const listing = await createTestListing(agent, {
        category: 'testing',
        location: 'NYC',
        locationLat: 40.7,
        locationLng: -74.0,
        radiusKm: 10,
        workMode: 'ONSITE',
        maxApplicants: 5,
      });

      const res = await patchListing(agent.apiKey, listing.id, {
        category: null,
        location: null,
        locationLat: null,
        locationLng: null,
        radiusKm: null,
        workMode: null,
        maxApplicants: null,
      });

      expect(res.status).toBe(200);

      const dbListing = await prisma.listing.findUnique({ where: { id: listing.id } });
      expect(dbListing!.category).toBeNull();
      expect(dbListing!.location).toBeNull();
      expect(dbListing!.locationLat).toBeNull();
      expect(dbListing!.locationLng).toBeNull();
      expect(dbListing!.radiusKm).toBeNull();
      expect(dbListing!.workMode).toBeNull();
      expect(dbListing!.maxApplicants).toBeNull();
    });

    it('should update callback URL and secret', async () => {
      const listing = await createTestListing(agent);

      const res = await patchListing(agent.apiKey, listing.id, {
        callbackUrl: 'https://webhook.example.com/events',
        callbackSecret: 'a-very-secure-secret-key-at-least-16',
      });

      expect(res.status).toBe(200);

      const dbListing = await prisma.listing.findUnique({ where: { id: listing.id } });
      expect(dbListing!.callbackUrl).toBe('https://webhook.example.com/events');
      expect(dbListing!.callbackSecret).toBe('a-very-secure-secret-key-at-least-16');
    });

    it('should clear callback URL by passing null', async () => {
      const listing = await createTestListing(agent, {
        callbackUrl: 'https://webhook.example.com/events',
        callbackSecret: 'a-very-secure-secret-key-at-least-16',
      });

      const res = await patchListing(agent.apiKey, listing.id, {
        callbackUrl: null,
        callbackSecret: null,
      });

      expect(res.status).toBe(200);

      const dbListing = await prisma.listing.findUnique({ where: { id: listing.id } });
      expect(dbListing!.callbackUrl).toBeNull();
      expect(dbListing!.callbackSecret).toBeNull();
    });

    it('should not modify fields that were not sent', async () => {
      const listing = await createTestListing(agent, {
        category: 'keep-me',
        location: 'Tel Aviv',
        requiredSkills: ['go', 'rust'],
      });

      const res = await patchListing(agent.apiKey, listing.id, {
        title: 'Only title changed',
      });

      expect(res.status).toBe(200);

      const dbListing = await prisma.listing.findUnique({ where: { id: listing.id } });
      expect(dbListing!.title).toBe('Only title changed');
      expect(dbListing!.category).toBe('keep-me');
      expect(dbListing!.location).toBe('Tel Aviv');
      expect(dbListing!.requiredSkills).toEqual(['go', 'rust']);
      expect(dbListing!.description).toBe('Original description for testing updates.');
    });
  });

  // ── Image update via URL ────────────────────────────

  describe('image update via imageUrl', () => {
    it('should download, process, and upload image from URL', async () => {
      const listing = await createTestListing(agent);

      const res = await patchListing(agent.apiKey, listing.id, {
        imageUrl: 'https://images.example.com/cover.jpg',
      });

      expect(res.status).toBe(200);
      expect(res.body.imageUrl).toBe('https://cdn.example.com/signed-image.webp');
      expect(res.body.imageStatus).toBe('pending');
      expect(res.body.imageMethod).toBe('url');
      expect(res.body.updatedFields).toContain('imageUrl');

      // Verify download + upload pipeline was called
      expect(mockDownloadExternalImage).toHaveBeenCalledWith('https://images.example.com/cover.jpg');
      expect(mockUploadProfilePhoto).toHaveBeenCalled();
      expect(mockQueueModeration).toHaveBeenCalledWith('listing_image', listing.id);
    });

    it('should delete old image before uploading new one', async () => {
      const listing = await createTestListing(agent, { imageKey: 'old-cover-key' });

      const res = await patchListing(agent.apiKey, listing.id, {
        imageUrl: 'https://images.example.com/new.jpg',
      });

      expect(res.status).toBe(200);
      expect(mockDeleteProfilePhoto).toHaveBeenCalledWith('old-cover-key');
    });

    it('should not try to delete image if listing has no existing image', async () => {
      const listing = await createTestListing(agent, { imageKey: null });

      const res = await patchListing(agent.apiKey, listing.id, {
        imageUrl: 'https://images.example.com/first.jpg',
      });

      expect(res.status).toBe(200);
      expect(mockDeleteProfilePhoto).not.toHaveBeenCalled();
    });

    it('should set imageStatus to pending for moderation', async () => {
      const listing = await createTestListing(agent);

      const res = await patchListing(agent.apiKey, listing.id, {
        imageUrl: 'https://images.example.com/cover.jpg',
      });

      expect(res.status).toBe(200);

      const dbListing = await prisma.listing.findUnique({ where: { id: listing.id } });
      expect(dbListing!.imageStatus).toBe('pending');
    });

    it('should return 400 when image download fails', async () => {
      mockDownloadExternalImage.mockRejectedValueOnce(new Error('Failed to download image: HTTP 404'));
      const listing = await createTestListing(agent);

      const res = await patchListing(agent.apiKey, listing.id, {
        imageUrl: 'https://images.example.com/nonexistent.jpg',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Image download failed');
      expect(res.body.message).toContain('HTTP 404');
    });

    it('should return 400 when image URL is not HTTPS', async () => {
      mockDownloadExternalImage.mockRejectedValueOnce(new Error('Only HTTPS URLs are allowed'));
      const listing = await createTestListing(agent);

      const res = await patchListing(agent.apiKey, listing.id, {
        imageUrl: 'https://redirect-to-http.example.com/cover.jpg',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Image download failed');
    });

    it('should update details AND image in a single request', async () => {
      const listing = await createTestListing(agent);

      const res = await patchListing(agent.apiKey, listing.id, {
        title: 'Updated with image',
        budgetUsdc: 75,
        imageUrl: 'https://images.example.com/combined.jpg',
      });

      expect(res.status).toBe(200);
      expect(res.body.updatedFields).toContain('title');
      expect(res.body.updatedFields).toContain('budgetUsdc');
      expect(res.body.updatedFields).toContain('imageUrl');
      expect(res.body.imageMethod).toBe('url');

      const dbListing = await prisma.listing.findUnique({ where: { id: listing.id } });
      expect(dbListing!.title).toBe('Updated with image');
      expect(dbListing!.budgetUsdc.toNumber()).toBe(75);
    });

    it('should skip SVG regeneration when imageUrl is provided even if title changes', async () => {
      const listing = await createTestListing(agent);

      await patchListing(agent.apiKey, listing.id, {
        title: 'New title with explicit image',
        imageUrl: 'https://images.example.com/explicit.jpg',
      });

      // imageUrl takes precedence — SVG auto-regen should NOT happen
      expect(mockGenerateListingCover).not.toHaveBeenCalled();
      expect(mockDownloadExternalImage).toHaveBeenCalled();
    });
  });

  // ── Image generation via DALL-E ─────────────────────

  describe('image update via generateImage', () => {
    it('should generate a DALL-E image and upload it', async () => {
      const listing = await createTestListing(agent);

      const res = await patchListing(agent.apiKey, listing.id, {
        generateImage: true,
      });

      expect(res.status).toBe(200);
      expect(res.body.imageUrl).toBe('https://cdn.example.com/signed-image.webp');
      expect(res.body.imageStatus).toBe('pending');
      expect(res.body.imageMethod).toBe('dalle');

      // Verify DALL-E pipeline was invoked
      expect(mockCreateOpenAIClient).toHaveBeenCalled();
      expect(mockUploadProfilePhoto).toHaveBeenCalled();
      expect(mockQueueModeration).toHaveBeenCalledWith('listing_image', listing.id);
    });

    it('should moderate text before generating image', async () => {
      const listing = await createTestListing(agent);

      await patchListing(agent.apiKey, listing.id, { generateImage: true });

      expect(mockModerateText).toHaveBeenCalledWith(
        expect.stringContaining('Original Title'),
      );
    });

    it('should reject generation when text is flagged by moderation', async () => {
      mockModerateText.mockResolvedValueOnce({ flagged: true } as any);
      const listing = await createTestListing(agent);

      const res = await patchListing(agent.apiKey, listing.id, {
        generateImage: true,
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Content flagged');
    });

    it('should delete old image before uploading generated one', async () => {
      const listing = await createTestListing(agent, { imageKey: 'old-dalle-key' });

      await patchListing(agent.apiKey, listing.id, { generateImage: true });

      expect(mockDeleteProfilePhoto).toHaveBeenCalledWith('old-dalle-key');
    });

    it('should skip SVG regeneration when generateImage is provided', async () => {
      const listing = await createTestListing(agent);

      await patchListing(agent.apiKey, listing.id, {
        title: 'New title with DALL-E',
        generateImage: true,
      });

      expect(mockGenerateListingCover).not.toHaveBeenCalled();
    });
  });

  // ── Image options mutual exclusivity ────────────────

  describe('image option validation', () => {
    it('should reject both imageUrl and generateImage together (400)', async () => {
      const listing = await createTestListing(agent);

      const res = await patchListing(agent.apiKey, listing.id, {
        imageUrl: 'https://images.example.com/cover.jpg',
        generateImage: true,
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Cannot use both');
    });

    it('should reject non-URL imageUrl (400)', async () => {
      const listing = await createTestListing(agent);

      const res = await patchListing(agent.apiKey, listing.id, {
        imageUrl: 'not-a-valid-url',
      });

      expect(res.status).toBe(400);
    });
  });

  // ── Cover image auto-regeneration ───────────────────

  describe('SVG cover auto-regeneration', () => {
    it('should regenerate SVG cover when title changes (no explicit image)', async () => {
      const listing = await createTestListing(agent);

      await patchListing(agent.apiKey, listing.id, { title: 'Brand New Title' });

      expect(mockGenerateListingCover).toHaveBeenCalledWith('Brand New Title', 'data-labeling');
    });

    it('should regenerate SVG cover when category changes', async () => {
      const listing = await createTestListing(agent);

      await patchListing(agent.apiKey, listing.id, { category: 'design' });

      expect(mockGenerateListingCover).toHaveBeenCalledWith('Original Title', 'design');
    });

    it('should NOT regenerate cover when only budget changes', async () => {
      const listing = await createTestListing(agent);

      await patchListing(agent.apiKey, listing.id, { budgetUsdc: 200 });

      expect(mockGenerateListingCover).not.toHaveBeenCalled();
    });
  });

  // ── Webhook delivery ────────────────────────────────

  describe('webhook delivery', () => {
    it('should fire listing.updated webhook when listing has callbackUrl', async () => {
      const listing = await createTestListing(agent, {
        callbackUrl: 'https://webhook.example.com/cb',
        callbackSecret: 'secret-at-least-16-chars',
      });

      await patchListing(agent.apiKey, listing.id, { title: 'Webhook Test' });

      expect(mockDeliverWebhook).toHaveBeenCalledTimes(1);
      const [url, payload, secret] = mockDeliverWebhook.mock.calls[0];
      expect(url).toBe('https://webhook.example.com/cb');
      expect(secret).toBe('secret-at-least-16-chars');
      expect(payload).toMatchObject({
        event: 'listing.updated',
        listingId: listing.id,
        status: 'OPEN',
        data: expect.objectContaining({
          title: 'Webhook Test',
          updatedFields: ['title'],
        }),
      });
    });

    it('should NOT fire webhook when listing has no callbackUrl', async () => {
      const listing = await createTestListing(agent);

      await patchListing(agent.apiKey, listing.id, { title: 'No Webhook' });

      expect(mockDeliverWebhook).not.toHaveBeenCalled();
    });

    it('should include imageUrl in updatedFields when image is updated', async () => {
      const listing = await createTestListing(agent, {
        callbackUrl: 'https://webhook.example.com/cb',
        callbackSecret: 'secret-at-least-16-chars',
      });

      await patchListing(agent.apiKey, listing.id, {
        imageUrl: 'https://images.example.com/webhook-test.jpg',
      });

      expect(mockDeliverWebhook).toHaveBeenCalledTimes(1);
      const [, payload] = mockDeliverWebhook.mock.calls[0];
      expect(payload.data.updatedFields).toContain('imageUrl');
    });
  });

  // ── Analytics tracking ──────────────────────────────

  describe('analytics tracking', () => {
    it('should fire listing_updated posthog event', async () => {
      const listing = await createTestListing(agent);

      await patchListing(agent.apiKey, listing.id, {
        title: 'Tracked',
        budgetUsdc: 99,
      });

      expect(mockTrackServerEvent).toHaveBeenCalledWith(
        agent.id,
        'listing_updated',
        expect.objectContaining({
          listingId: listing.id,
          updatedFields: ['title', 'budgetUsdc'],
        }),
        expect.anything(), // req
      );
    });
  });

  // ── Authentication & authorization ──────────────────

  describe('authentication and authorization', () => {
    it('should reject request without API key (401)', async () => {
      const listing = await createTestListing(agent);

      const res = await request(app)
        .patch(`/api/listings/${listing.id}`)
        .send({ title: 'Nope' });

      expect(res.status).toBe(401);
    });

    it('should reject request with invalid API key (401)', async () => {
      const listing = await createTestListing(agent);

      const res = await request(app)
        .patch(`/api/listings/${listing.id}`)
        .set('X-Agent-Key', 'hp_invalid_key_that_does_not_exist')
        .send({ title: 'Nope' });

      expect(res.status).toBe(401);
    });

    it('should reject PENDING agent (403)', async () => {
      const pendingAgent = await createActiveTestAgent({ status: 'PENDING' });
      const listing = await createTestListing(agent);

      const res = await patchListing(pendingAgent.apiKey, listing.id, { title: 'Nope' });

      expect(res.status).toBe(403);
    });

    it('should reject SUSPENDED agent (403)', async () => {
      const suspendedAgent = await createActiveTestAgent({ status: 'SUSPENDED' });
      const listing = await createTestListing(agent);

      const res = await patchListing(suspendedAgent.apiKey, listing.id, { title: 'Nope' });

      expect(res.status).toBe(403);
    });

    it('should reject another agent updating a listing they do not own (403)', async () => {
      const otherAgent = await createActiveTestAgent({ name: 'Other Agent' });
      const listing = await createTestListing(agent);

      const res = await patchListing(otherAgent.apiKey, listing.id, { title: 'Hijack' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Not authorized');
      expect(res.body.message).toContain('your own listings');
    });
  });

  // ── Listing state guards ────────────────────────────

  describe('listing status guards', () => {
    it('should reject update on CANCELLED listing (409)', async () => {
      const listing = await createTestListing(agent, { status: 'CANCELLED' });

      const res = await patchListing(agent.apiKey, listing.id, { title: 'Revive?' });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Listing not editable');
      expect(res.body.message).toContain('CANCELLED');
    });

    it('should reject update on EXPIRED listing (409)', async () => {
      const listing = await createTestListing(agent, { status: 'EXPIRED' });

      const res = await patchListing(agent.apiKey, listing.id, { title: 'Extend?' });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('EXPIRED');
    });

    it('should reject update on CLOSED listing (409)', async () => {
      const listing = await createTestListing(agent, { status: 'CLOSED' });

      const res = await patchListing(agent.apiKey, listing.id, { title: 'Reopen?' });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('CLOSED');
    });

    it('should reject image update on CANCELLED listing (409)', async () => {
      const listing = await createTestListing(agent, { status: 'CANCELLED' });

      const res = await patchListing(agent.apiKey, listing.id, {
        imageUrl: 'https://images.example.com/cover.jpg',
      });

      expect(res.status).toBe(409);
    });
  });

  // ── Not found ───────────────────────────────────────

  describe('not found', () => {
    it('should return 404 for non-existent listing ID', async () => {
      const res = await patchListing(agent.apiKey, 'nonexistent-id-12345', {
        title: 'Ghost',
      });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Listing not found');
    });
  });

  // ── Validation errors ───────────────────────────────

  describe('validation', () => {
    it('should reject empty body (400)', async () => {
      const listing = await createTestListing(agent);

      const res = await patchListing(agent.apiKey, listing.id, {});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('At least one field');
    });

    it('should reject unknown fields via strict mode (400)', async () => {
      const listing = await createTestListing(agent);

      const res = await patchListing(agent.apiKey, listing.id, {
        title: 'Valid',
        hackerField: 'should fail',
      });

      expect(res.status).toBe(400);
    });

    it('should reject title that is too long (400)', async () => {
      const listing = await createTestListing(agent);

      const res = await patchListing(agent.apiKey, listing.id, {
        title: 'x'.repeat(201),
      });

      expect(res.status).toBe(400);
    });

    it('should reject empty string title (400)', async () => {
      const listing = await createTestListing(agent);

      const res = await patchListing(agent.apiKey, listing.id, {
        title: '',
      });

      expect(res.status).toBe(400);
    });

    it('should reject budget below $5 (400)', async () => {
      const listing = await createTestListing(agent);

      const res = await patchListing(agent.apiKey, listing.id, {
        budgetUsdc: 1,
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Minimum budget is $5');
    });

    it('should reject expiresAt in the past (400)', async () => {
      const listing = await createTestListing(agent);

      const res = await patchListing(agent.apiKey, listing.id, {
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      });

      expect(res.status).toBe(400);
    });

    it('should reject expiresAt more than 90 days out (400)', async () => {
      const listing = await createTestListing(agent);

      const res = await patchListing(agent.apiKey, listing.id, {
        expiresAt: futureDate(91),
      });

      expect(res.status).toBe(400);
    });

    it('should reject invalid workMode (400)', async () => {
      const listing = await createTestListing(agent);

      const res = await patchListing(agent.apiKey, listing.id, {
        workMode: 'INVALID_MODE',
      });

      expect(res.status).toBe(400);
    });

    it('should reject more than 30 required skills (400)', async () => {
      const listing = await createTestListing(agent);

      const res = await patchListing(agent.apiKey, listing.id, {
        requiredSkills: Array.from({ length: 31 }, (_, i) => `skill-${i}`),
      });

      expect(res.status).toBe(400);
    });

    it('should reject maxApplicants over 10000 (400)', async () => {
      const listing = await createTestListing(agent);

      const res = await patchListing(agent.apiKey, listing.id, {
        maxApplicants: 10001,
      });

      expect(res.status).toBe(400);
    });

    it('should reject callbackSecret shorter than 16 chars (400)', async () => {
      const listing = await createTestListing(agent);

      const res = await patchListing(agent.apiKey, listing.id, {
        callbackSecret: 'short',
      });

      expect(res.status).toBe(400);
    });

    it('should reject non-URL callbackUrl (400)', async () => {
      const listing = await createTestListing(agent);

      const res = await patchListing(agent.apiKey, listing.id, {
        callbackUrl: 'not-a-url',
      });

      expect(res.status).toBe(400);
    });
  });

  // ── SSRF protection ─────────────────────────────────

  describe('SSRF protection', () => {
    it('should reject private/internal callback URLs (400)', async () => {
      mockIsAllowedUrl.mockResolvedValueOnce(false);
      const listing = await createTestListing(agent);

      const res = await patchListing(agent.apiKey, listing.id, {
        callbackUrl: 'http://169.254.169.254/latest/meta-data',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid callback URL');
      expect(mockIsAllowedUrl).toHaveBeenCalledWith('http://169.254.169.254/latest/meta-data');
    });

    it('should skip SSRF check when callbackUrl is null (clearing)', async () => {
      const listing = await createTestListing(agent, {
        callbackUrl: 'https://example.com/cb',
        callbackSecret: 'secret-at-least-16-chars',
      });

      const res = await patchListing(agent.apiKey, listing.id, {
        callbackUrl: null,
      });

      expect(res.status).toBe(200);
      // isAllowedUrl should NOT be called when clearing
      expect(mockIsAllowedUrl).not.toHaveBeenCalled();
    });
  });

  // ── Idempotency ─────────────────────────────────────

  describe('idempotency', () => {
    it('should succeed when updating with same values', async () => {
      const listing = await createTestListing(agent);

      const res = await patchListing(agent.apiKey, listing.id, {
        title: 'Original Title',
      });

      expect(res.status).toBe(200);

      const dbListing = await prisma.listing.findUnique({ where: { id: listing.id } });
      expect(dbListing!.title).toBe('Original Title');
    });
  });

  // ── Boundary values ─────────────────────────────────

  describe('boundary values', () => {
    it('should accept minimum budget of exactly $5', async () => {
      const listing = await createTestListing(agent);

      const res = await patchListing(agent.apiKey, listing.id, { budgetUsdc: 5 });

      expect(res.status).toBe(200);

      const dbListing = await prisma.listing.findUnique({ where: { id: listing.id } });
      expect(dbListing!.budgetUsdc.toNumber()).toBe(5);
    });

    it('should accept exactly 30 required skills', async () => {
      const listing = await createTestListing(agent);
      const skills = Array.from({ length: 30 }, (_, i) => `skill-${i}`);

      const res = await patchListing(agent.apiKey, listing.id, { requiredSkills: skills });

      expect(res.status).toBe(200);

      const dbListing = await prisma.listing.findUnique({ where: { id: listing.id } });
      expect(dbListing!.requiredSkills).toHaveLength(30);
    });

    it('should accept maxApplicants of exactly 10000', async () => {
      const listing = await createTestListing(agent);

      const res = await patchListing(agent.apiKey, listing.id, { maxApplicants: 10000 });

      expect(res.status).toBe(200);
    });

    it('should accept expiresAt exactly 89 days from now', async () => {
      const listing = await createTestListing(agent);

      const res = await patchListing(agent.apiKey, listing.id, {
        expiresAt: futureDate(89),
      });

      expect(res.status).toBe(200);
    });

    it('should accept title of exactly 200 chars', async () => {
      const listing = await createTestListing(agent);

      const res = await patchListing(agent.apiKey, listing.id, {
        title: 'x'.repeat(200),
      });

      expect(res.status).toBe(200);
    });

    it('should accept description of exactly 5000 chars', async () => {
      const listing = await createTestListing(agent);

      const res = await patchListing(agent.apiKey, listing.id, {
        description: 'y'.repeat(5000),
      });

      expect(res.status).toBe(200);
    });
  });

  // ── Reconfirm flow (material term changes) ──────────

  describe('reconfirm flow', () => {
    let human: TestUser;

    beforeEach(async () => {
      human = await createTestUser();
      await prisma.human.update({
        where: { id: human.id },
        data: { emailVerified: true, emailNotifications: true },
      });
    });

    it('should set PENDING apps to PENDING_RECONFIRM when budget changes', async () => {
      const listing = await createTestListing(agent);
      const app = await createTestApplication(listing.id, human.id);

      const res = await patchListing(agent.apiKey, listing.id, { budgetUsdc: 100 });

      expect(res.status).toBe(200);
      expect(res.body.applicantsNeedReconfirm).toBe(1);
      expect(res.body.message).toContain('must reconfirm');

      const dbApp = await prisma.listingApplication.findUnique({ where: { id: app.id } });
      expect(dbApp!.status).toBe('PENDING_RECONFIRM');
    });

    it('should set PENDING apps to PENDING_RECONFIRM when title changes', async () => {
      const listing = await createTestListing(agent);
      await createTestApplication(listing.id, human.id);

      const res = await patchListing(agent.apiKey, listing.id, { title: 'Changed Title' });

      expect(res.body.applicantsNeedReconfirm).toBe(1);
    });

    it('should set PENDING apps to PENDING_RECONFIRM when description changes', async () => {
      const listing = await createTestListing(agent);
      await createTestApplication(listing.id, human.id);

      const res = await patchListing(agent.apiKey, listing.id, { description: 'Different job now' });

      expect(res.body.applicantsNeedReconfirm).toBe(1);
    });

    it('should set PENDING apps to PENDING_RECONFIRM when workMode changes', async () => {
      const listing = await createTestListing(agent);
      await createTestApplication(listing.id, human.id);

      const res = await patchListing(agent.apiKey, listing.id, { workMode: 'ONSITE' });

      expect(res.body.applicantsNeedReconfirm).toBe(1);
    });

    it('should set PENDING apps to PENDING_RECONFIRM when location changes', async () => {
      const listing = await createTestListing(agent);
      await createTestApplication(listing.id, human.id);

      const res = await patchListing(agent.apiKey, listing.id, { location: 'Mars' });

      expect(res.body.applicantsNeedReconfirm).toBe(1);
    });

    it('should NOT trigger reconfirm for non-material changes (requiredSkills)', async () => {
      const listing = await createTestListing(agent);
      const app = await createTestApplication(listing.id, human.id);

      const res = await patchListing(agent.apiKey, listing.id, {
        requiredSkills: ['new-skill'],
      });

      expect(res.status).toBe(200);
      expect(res.body.applicantsNeedReconfirm).toBeUndefined();

      const dbApp = await prisma.listingApplication.findUnique({ where: { id: app.id } });
      expect(dbApp!.status).toBe('PENDING');
    });

    it('should NOT trigger reconfirm for non-material changes (category, maxApplicants)', async () => {
      const listing = await createTestListing(agent);
      const app = await createTestApplication(listing.id, human.id);

      const res = await patchListing(agent.apiKey, listing.id, {
        category: 'new-cat',
        maxApplicants: 999,
      });

      expect(res.body.applicantsNeedReconfirm).toBeUndefined();

      const dbApp = await prisma.listingApplication.findUnique({ where: { id: app.id } });
      expect(dbApp!.status).toBe('PENDING');
    });

    it('should NOT trigger reconfirm for non-material changes (expiresAt)', async () => {
      const listing = await createTestListing(agent);
      const app = await createTestApplication(listing.id, human.id);

      const res = await patchListing(agent.apiKey, listing.id, {
        expiresAt: futureDate(60),
      });

      expect(res.body.applicantsNeedReconfirm).toBeUndefined();

      const dbApp = await prisma.listingApplication.findUnique({ where: { id: app.id } });
      expect(dbApp!.status).toBe('PENDING');
    });

    it('should NOT trigger reconfirm when there are no PENDING applications', async () => {
      const listing = await createTestListing(agent);
      // Create an OFFERED application (not PENDING)
      await createTestApplication(listing.id, human.id, { status: 'OFFERED' });

      const res = await patchListing(agent.apiKey, listing.id, { budgetUsdc: 100 });

      expect(res.status).toBe(200);
      expect(res.body.applicantsNeedReconfirm).toBeUndefined();
    });

    it('should handle multiple applicants needing reconfirm', async () => {
      const listing = await createTestListing(agent);
      const human2 = await createTestUser({ email: 'human2@example.com' });
      await prisma.human.update({ where: { id: human2.id }, data: { emailVerified: true, emailNotifications: true } });

      await createTestApplication(listing.id, human.id);
      await createTestApplication(listing.id, human2.id);

      const res = await patchListing(agent.apiKey, listing.id, { budgetUsdc: 200 });

      expect(res.body.applicantsNeedReconfirm).toBe(2);

      const apps = await prisma.listingApplication.findMany({
        where: { listingId: listing.id },
      });
      expect(apps.every(a => a.status === 'PENDING_RECONFIRM')).toBe(true);
    });

    it('should send email notifications to applicants with emailNotifications enabled', async () => {
      const listing = await createTestListing(agent);
      await createTestApplication(listing.id, human.id);

      await patchListing(agent.apiKey, listing.id, { budgetUsdc: 100 });

      expect(mockSendListingTermsChangedEmail).toHaveBeenCalledTimes(1);
      expect(mockSendListingTermsChangedEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          humanId: human.id,
          listingTitle: 'Original Title',
          changedFields: ['budgetUsdc'],
          compareUrl: expect.stringContaining('/compare'),
        }),
      );
    });

    it('should NOT send email to applicants with emailNotifications disabled', async () => {
      await prisma.human.update({ where: { id: human.id }, data: { emailNotifications: false } });
      const listing = await createTestListing(agent);
      await createTestApplication(listing.id, human.id);

      await patchListing(agent.apiKey, listing.id, { budgetUsdc: 100 });

      expect(mockSendListingTermsChangedEmail).not.toHaveBeenCalled();
    });

    it('should include reconfirmCount in webhook payload', async () => {
      const listing = await createTestListing(agent, {
        callbackUrl: 'https://webhook.example.com/cb',
        callbackSecret: 'secret-at-least-16-chars',
      });
      await createTestApplication(listing.id, human.id);

      await patchListing(agent.apiKey, listing.id, { title: 'Changed' });

      expect(mockDeliverWebhook).toHaveBeenCalledTimes(1);
      const [, payload] = mockDeliverWebhook.mock.calls[0];
      expect(payload.data.applicantsNeedReconfirm).toBe(1);
    });

    it('should block agent from making offer on PENDING_RECONFIRM application', async () => {
      const listing = await createTestListing(agent);
      const application = await createTestApplication(listing.id, human.id);

      // Trigger reconfirm
      await patchListing(agent.apiKey, listing.id, { budgetUsdc: 200 });

      // Try to make offer — the make-offer endpoint checks `application.status !== 'PENDING'`
      // so PENDING_RECONFIRM should be rejected
      const res = await request(app)
        .post(`/api/listings/${listing.id}/applications/${application.id}/offer`)
        .set('X-Agent-Key', agent.apiKey)
        .send({ confirm: true });

      expect(res.status).toBe(400);
    });
  });

  // ── Compare endpoint ────────────────────────────────

  describe('GET /api/listings/:id/compare', () => {
    let human: TestUser;

    beforeEach(async () => {
      human = await createTestUser();
      await prisma.human.update({
        where: { id: human.id },
        data: { emailVerified: true },
      });
    });

    it('should return diff of original vs current listing terms', async () => {
      const listing = await createTestListing(agent);
      await createTestApplication(listing.id, human.id);

      // Update budget (material change)
      await patchListing(agent.apiKey, listing.id, { budgetUsdc: 200 });

      const res = await request(app)
        .get(`/api/listings/${listing.id}/compare`)
        .set('Authorization', `Bearer ${human.token}`);

      expect(res.status).toBe(200);
      expect(res.body.hasChanges).toBe(true);
      expect(res.body.changes.budgetUsdc).toBeDefined();
      expect(res.body.changes.budgetUsdc.original).toBe('50');
      expect(res.body.changes.budgetUsdc.current).toBe('200');
      expect(res.body.original).toBeDefined();
      expect(res.body.current).toBeDefined();
    });

    it('should return empty changes when listing has not changed', async () => {
      const listing = await createTestListing(agent);
      await createTestApplication(listing.id, human.id);

      const res = await request(app)
        .get(`/api/listings/${listing.id}/compare`)
        .set('Authorization', `Bearer ${human.token}`);

      expect(res.status).toBe(200);
      expect(res.body.hasChanges).toBe(false);
      expect(Object.keys(res.body.changes)).toHaveLength(0);
    });

    it('should return 404 if human has not applied', async () => {
      const listing = await createTestListing(agent);

      const res = await request(app)
        .get(`/api/listings/${listing.id}/compare`)
        .set('Authorization', `Bearer ${human.token}`);

      expect(res.status).toBe(404);
    });

    it('should require authentication', async () => {
      const listing = await createTestListing(agent);

      const res = await request(app)
        .get(`/api/listings/${listing.id}/compare`);

      expect(res.status).toBe(401);
    });
  });

  // ── Reconfirm endpoint ──────────────────────────────

  describe('POST /api/listings/:id/reconfirm', () => {
    let human: TestUser;

    beforeEach(async () => {
      human = await createTestUser();
      await prisma.human.update({
        where: { id: human.id },
        data: { emailVerified: true },
      });
    });

    it('should reconfirm PENDING_RECONFIRM application back to PENDING', async () => {
      const listing = await createTestListing(agent);
      const application = await createTestApplication(listing.id, human.id);

      // Trigger reconfirm
      await patchListing(agent.apiKey, listing.id, { budgetUsdc: 200 });

      const res = await request(app)
        .post(`/api/listings/${listing.id}/reconfirm`)
        .set('Authorization', `Bearer ${human.token}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('PENDING');
      expect(res.body.message).toContain('reconfirmed');

      const dbApp = await prisma.listingApplication.findUnique({ where: { id: application.id } });
      expect(dbApp!.status).toBe('PENDING');
    });

    it('should update the snapshot to current listing terms on reconfirm', async () => {
      const listing = await createTestListing(agent);
      await createTestApplication(listing.id, human.id);

      // Change budget
      await patchListing(agent.apiKey, listing.id, { budgetUsdc: 200 });

      // Reconfirm
      await request(app)
        .post(`/api/listings/${listing.id}/reconfirm`)
        .set('Authorization', `Bearer ${human.token}`);

      // Verify snapshot was updated to new terms
      const dbApp = await prisma.listingApplication.findFirst({
        where: { listingId: listing.id, humanId: human.id },
      });
      const snapshot = dbApp!.listingSnapshot as any;
      expect(snapshot.budgetUsdc).toBe('200');
    });

    it('should return 404 if no PENDING_RECONFIRM application exists', async () => {
      const listing = await createTestListing(agent);
      // Application is PENDING (not PENDING_RECONFIRM)
      await createTestApplication(listing.id, human.id);

      const res = await request(app)
        .post(`/api/listings/${listing.id}/reconfirm`)
        .set('Authorization', `Bearer ${human.token}`);

      expect(res.status).toBe(404);
    });

    it('should return 400 if listing is no longer OPEN', async () => {
      const listing = await createTestListing(agent);
      await createTestApplication(listing.id, human.id, { status: 'PENDING_RECONFIRM' });

      // Cancel the listing
      await prisma.listing.update({ where: { id: listing.id }, data: { status: 'CANCELLED' } });

      const res = await request(app)
        .post(`/api/listings/${listing.id}/reconfirm`)
        .set('Authorization', `Bearer ${human.token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('no longer open');
    });

    it('should require authentication', async () => {
      const listing = await createTestListing(agent);

      const res = await request(app)
        .post(`/api/listings/${listing.id}/reconfirm`);

      expect(res.status).toBe(401);
    });
  });
});
