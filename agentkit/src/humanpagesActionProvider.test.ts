import { HumanPagesActionProvider } from "./humanpagesActionProvider";

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("HumanPagesActionProvider", () => {
  let provider: HumanPagesActionProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new HumanPagesActionProvider({
      apiKey: "hp_testapikey123456789012345678901234567890abcdef",
      apiBaseUrl: "https://api.humanpages.io",
    });
  });

  it("throws if no API key provided", () => {
    delete process.env.HUMANPAGES_API_KEY;
    expect(() => new HumanPagesActionProvider({ apiKey: "" })).toThrow(
      "HUMANPAGES_API_KEY is required",
    );
  });

  it("reads API key from environment", () => {
    process.env.HUMANPAGES_API_KEY = "hp_envkey";
    const p = new HumanPagesActionProvider();
    expect(p).toBeInstanceOf(HumanPagesActionProvider);
    delete process.env.HUMANPAGES_API_KEY;
  });

  describe("searchHumans", () => {
    it("searches with skill filter", async () => {
      const mockResults = { humans: [{ id: "h1", name: "Alice", skills: ["photography"] }] };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResults),
      });

      const result = await provider.searchHumans({ skill: "photography" });
      const parsed = JSON.parse(result);

      expect(parsed.humans).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.humanpages.io/api/humans/search?skill=photography",
        expect.objectContaining({
          headers: expect.objectContaining({ "X-Agent-Key": expect.any(String) }),
        }),
      );
    });

    it("searches with geo-radius", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ humans: [] }),
      });

      await provider.searchHumans({ lat: 37.77, lng: -122.42, radius: 10 });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("lat=37.77&lng=-122.42&radius=10"),
        expect.any(Object),
      );
    });

    it("returns error on failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal Server Error"),
      });

      const result = await provider.searchHumans({ skill: "test" });
      expect(result).toContain("Error searching humans");
    });
  });

  describe("viewHumanProfile", () => {
    it("fetches full profile", async () => {
      const mockProfile = {
        id: "h1",
        name: "Alice",
        contactEmail: "alice@example.com",
        wallets: [{ address: "0x123", network: "base" }],
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProfile),
      });

      const result = await provider.viewHumanProfile({ humanId: "h1" });
      const parsed = JSON.parse(result);

      expect(parsed.contactEmail).toBe("alice@example.com");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.humanpages.io/api/humans/h1/profile",
        expect.any(Object),
      );
    });
  });

  describe("createJobOffer", () => {
    it("creates a job offer", async () => {
      const mockJob = { id: "j1", status: "PENDING", title: "Deliver package" };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockJob),
      });

      const result = await provider.createJobOffer({
        humanId: "h1",
        title: "Deliver package",
        description: "Pick up from 123 Main St, deliver to 456 Oak Ave",
        priceUsdc: 25,
      });
      const parsed = JSON.parse(result);

      expect(parsed.id).toBe("j1");
      expect(parsed.status).toBe("PENDING");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.humanpages.io/api/jobs",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("handles rate limit errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: () => Promise.resolve(JSON.stringify({ error: "Rate limit exceeded: 15 offers/day" })),
      });

      const result = await provider.createJobOffer({
        humanId: "h1",
        title: "Test",
        description: "Test",
        priceUsdc: 5,
      });
      expect(result).toContain("Rate limit exceeded");
    });
  });

  describe("getJobStatus", () => {
    it("returns job details", async () => {
      const mockJob = { id: "j1", status: "ACCEPTED", humanId: "h1" };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockJob),
      });

      const result = await provider.getJobStatus({ jobId: "j1" });
      const parsed = JSON.parse(result);

      expect(parsed.status).toBe("ACCEPTED");
    });
  });

  describe("markJobPaid", () => {
    it("records payment", async () => {
      const mockJob = { id: "j1", status: "PAID" };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockJob),
      });

      const result = await provider.markJobPaid({
        jobId: "j1",
        paymentTxHash: "0xabc123",
        paymentNetwork: "base",
        paymentAmount: "25.00",
      });
      const parsed = JSON.parse(result);

      expect(parsed.status).toBe("PAID");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.humanpages.io/api/jobs/j1/paid",
        expect.objectContaining({ method: "PATCH" }),
      );
    });
  });

  describe("createListing", () => {
    it("creates a listing", async () => {
      const mockListing = { id: "l1", title: "Need photographer", status: "OPEN" };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockListing),
      });

      const result = await provider.createListing({
        title: "Need photographer",
        description: "Product photography for e-commerce store",
        budgetUsdc: 100,
        workMode: "onsite",
        location: "San Francisco",
      });
      const parsed = JSON.parse(result);

      expect(parsed.id).toBe("l1");
    });
  });

  describe("browseListings", () => {
    it("browses with filters", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ listings: [], total: 0 }),
      });

      await provider.browseListings({ skill: "delivery", workMode: "onsite", page: 1, limit: 20 });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("skill=delivery"),
        expect.any(Object),
      );
    });
  });

  describe("leaveReview", () => {
    it("submits a review", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const result = await provider.leaveReview({
        jobId: "j1",
        rating: 5,
        comment: "Excellent work!",
      });

      expect(JSON.parse(result).success).toBe(true);
    });
  });

  describe("sendJobMessage", () => {
    it("sends a message", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "m1", content: "Hello" }),
      });

      const result = await provider.sendJobMessage({
        jobId: "j1",
        content: "Hello, when can you start?",
      });

      expect(JSON.parse(result).id).toBe("m1");
    });
  });

  describe("getJobMessages", () => {
    it("retrieves messages", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ messages: [{ id: "m1", content: "Hello" }] }),
      });

      const result = await provider.getJobMessages({ jobId: "j1" });
      expect(JSON.parse(result).messages).toHaveLength(1);
    });
  });

  describe("supportsNetwork", () => {
    it("supports all networks", () => {
      expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-mainnet" } as any)).toBe(true);
      expect(provider.supportsNetwork({ protocolFamily: "solana", networkId: "solana-mainnet" } as any)).toBe(true);
    });
  });
});
