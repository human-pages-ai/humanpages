import { prisma } from './setup.js';
import { cleanDatabase, createTestUser, type TestUser } from './helpers.js';

// Use vi.hoisted so mock functions survive vi.resetModules()
const { mockCreate, mockGetR2ObjectBuffer } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockGetR2ObjectBuffer: vi.fn().mockResolvedValue(Buffer.alloc(100)),
}));

vi.mock('openai', () => ({
  default: class {
    moderations = { create: mockCreate };
  },
}));

// Mock storage for the worker
vi.mock('../lib/storage.js', () => ({
  isStorageConfigured: () => true,
  getR2ObjectBuffer: mockGetR2ObjectBuffer,
  getProfilePhotoSignedUrl: vi.fn().mockResolvedValue('https://example.com/signed'),
}));

describe('Moderation Service', () => {
  beforeEach(async () => {
    await cleanDatabase();
    vi.clearAllMocks();
  });

  describe('queueModeration', () => {
    it('should create a pending queue entry when moderation is enabled', async () => {
      // Set OPENAI_API_KEY to enable moderation
      const origKey = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = 'test-key';

      try {
        const { queueModeration } = await import('../lib/moderation.js');
        const user = await createTestUser();

        await queueModeration('profile_photo', user.id);

        const entry = await prisma.moderationQueue.findFirst({
          where: { contentType: 'profile_photo', contentId: user.id },
        });
        expect(entry).not.toBeNull();
        expect(entry!.status).toBe('pending');
      } finally {
        process.env.OPENAI_API_KEY = origKey;
      }
    });

    it('should auto-approve profile photo when moderation is disabled', async () => {
      const origKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      try {
        // Re-import to pick up env change
        vi.resetModules();
        const { queueModeration } = await import('../lib/moderation.js');
        const user = await createTestUser();

        // Set photo key first
        await prisma.human.update({
          where: { id: user.id },
          data: { profilePhotoKey: 'photos/key.webp', profilePhotoStatus: 'pending' },
        });

        await queueModeration('profile_photo', user.id);

        const human = await prisma.human.findUnique({ where: { id: user.id } });
        expect(human!.profilePhotoStatus).toBe('approved');
      } finally {
        process.env.OPENAI_API_KEY = origKey;
      }
    });

    it('should auto-approve job when moderation is disabled', async () => {
      const origKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      try {
        vi.resetModules();
        const { queueModeration } = await import('../lib/moderation.js');
        const user = await createTestUser();

        // Create a job with an agent
        const agent = await prisma.agent.create({
          data: {
            name: 'Test Agent',
            apiKeyHash: 'hash',
            apiKeyPrefix: 'hp_test',
            verificationToken: 'token',
          },
        });

        const job = await prisma.job.create({
          data: {
            humanId: user.id,
            agentId: 'agent-ext-id',
            registeredAgentId: agent.id,
            title: 'Test Job',
            description: 'Test',
            priceUsdc: 10,
            moderationStatus: 'pending',
          },
        });

        await queueModeration('job_posting', job.id);

        const updated = await prisma.job.findUnique({ where: { id: job.id } });
        expect(updated!.moderationStatus).toBe('approved');
      } finally {
        process.env.OPENAI_API_KEY = origKey;
      }
    });
  });

  describe('moderateText', () => {
    it('should return unflagged result for clean text', async () => {
      process.env.OPENAI_API_KEY = 'test-key';
      mockCreate.mockResolvedValueOnce({
        results: [{
          flagged: false,
          categories: { sexual: false, hate: false, violence: false },
          category_scores: { sexual: 0.01, hate: 0.001, violence: 0.002 },
        }],
      });

      vi.resetModules();
      const { moderateText } = await import('../lib/moderation.js');
      const result = await moderateText('Hello, this is a normal message');

      expect(result.flagged).toBe(false);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ input: 'Hello, this is a normal message' }),
      );
    });

    it('should return flagged result for harmful content', async () => {
      process.env.OPENAI_API_KEY = 'test-key';
      mockCreate.mockResolvedValueOnce({
        results: [{
          flagged: true,
          categories: { sexual: true, hate: false },
          category_scores: { sexual: 0.95, hate: 0.01 },
        }],
      });

      vi.resetModules();
      const { moderateText } = await import('../lib/moderation.js');
      const result = await moderateText('inappropriate content');

      expect(result.flagged).toBe(true);
      expect(result.categories).toHaveProperty('sexual', true);
    });

    it('should return unflagged for empty text', async () => {
      process.env.OPENAI_API_KEY = 'test-key';
      vi.resetModules();
      const { moderateText } = await import('../lib/moderation.js');
      const result = await moderateText('');

      expect(result.flagged).toBe(false);
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });
});

describe('Moderation Worker', () => {
  beforeEach(async () => {
    await cleanDatabase();
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-key';
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  it('should process pending profile_photo items and approve clean ones', async () => {
    mockCreate.mockResolvedValueOnce({
      results: [{
        flagged: false,
        categories: {},
        category_scores: {},
      }],
    });

    const user = await createTestUser();
    await prisma.human.update({
      where: { id: user.id },
      data: { profilePhotoKey: 'photos/key.webp', profilePhotoStatus: 'pending' },
    });

    await prisma.moderationQueue.create({
      data: { contentType: 'profile_photo', contentId: user.id },
    });

    // Import and manually trigger the worker's processing function
    vi.resetModules();
    // We need to access the private processModerationQueue function
    // Instead, we test through the public API by checking state changes
    const mod = await import('../lib/moderation-worker.js');

    // Start worker, wait a tick, then stop
    mod.startModerationWorker();
    await new Promise(r => setTimeout(r, 12_000)); // Wait for one poll cycle
    mod.stopModerationWorker();

    const entry = await prisma.moderationQueue.findFirst({
      where: { contentType: 'profile_photo', contentId: user.id },
    });
    expect(entry!.status).toBe('approved');

    const human = await prisma.human.findUnique({ where: { id: user.id } });
    expect(human!.profilePhotoStatus).toBe('approved');
  }, 15_000);

  it('should reject flagged profile photos', async () => {
    mockCreate.mockResolvedValueOnce({
      results: [{
        flagged: true,
        categories: { sexual: true },
        category_scores: { sexual: 0.99 },
      }],
    });

    const user = await createTestUser();
    await prisma.human.update({
      where: { id: user.id },
      data: { profilePhotoKey: 'photos/key.webp', profilePhotoStatus: 'pending' },
    });

    await prisma.moderationQueue.create({
      data: { contentType: 'profile_photo', contentId: user.id },
    });

    vi.resetModules();
    const mod = await import('../lib/moderation-worker.js');
    mod.startModerationWorker();
    await new Promise(r => setTimeout(r, 12_000));
    mod.stopModerationWorker();

    const entry = await prisma.moderationQueue.findFirst({
      where: { contentType: 'profile_photo', contentId: user.id },
    });
    expect(entry!.status).toBe('rejected');

    const human = await prisma.human.findUnique({ where: { id: user.id } });
    expect(human!.profilePhotoStatus).toBe('rejected');
  }, 15_000);

  it('should handle deleted source records gracefully', async () => {
    // Create a queue entry for a user that no longer exists
    await prisma.moderationQueue.create({
      data: { contentType: 'profile_photo', contentId: 'nonexistent-id' },
    });

    vi.resetModules();
    const mod = await import('../lib/moderation-worker.js');
    mod.startModerationWorker();
    await new Promise(r => setTimeout(r, 12_000));
    mod.stopModerationWorker();

    const entry = await prisma.moderationQueue.findFirst({
      where: { contentId: 'nonexistent-id' },
    });
    // Should mark as approved (skipped) since source was deleted
    expect(entry!.status).toBe('approved');
    expect(entry!.errorMessage).toMatch(/deleted|no photo/i);
  }, 15_000);
});
