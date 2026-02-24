import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { requireStaffOrAdmin, apiKeyAdmin } from '../middleware/adminAuth.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { hasCapability } from '../lib/capabilities.js';
import { LeadStatus, LeadSource } from '@prisma/client';

const router = Router();

const LEAD_STATUSES = Object.values(LeadStatus);
const LEAD_SOURCES = Object.values(LeadSource);

// Valid status transitions
const STATUS_TRANSITIONS: Record<string, string[]> = {
  NEW: ['VERIFIED', 'REJECTED', 'BLOCKED'],
  VERIFIED: ['OUTREACH_READY', 'REJECTED', 'BLOCKED'],
  OUTREACH_READY: ['CONTACTED', 'REJECTED', 'BLOCKED'],
  CONTACTED: ['REPLIED', 'STALE', 'REJECTED', 'BLOCKED'],
  REPLIED: ['ENGAGED', 'STALE', 'REJECTED', 'BLOCKED'],
  ENGAGED: ['CONVERTED', 'STALE', 'REJECTED', 'BLOCKED'],
  CONVERTED: [],
  REJECTED: ['NEW'], // allow re-opening
  STALE: ['NEW', 'CONTACTED'], // allow re-engaging
  BLOCKED: [],
};

// ─── Middleware: require LEAD_GEN capability or admin ───
async function requireLeadGen(req: AuthRequest, res: any, next: any) {
  if (!req.userId) return res.status(401).json({ error: 'Authentication required' });
  const user = await prisma.human.findUnique({
    where: { id: req.userId },
    select: { role: true, capabilities: true, email: true },
  });
  if (!user) return res.status(401).json({ error: 'User not found' });

  const { getEffectiveRole } = await import('../middleware/adminAuth.js');
  const role = getEffectiveRole(user.email, user.role);
  if (role === 'ADMIN' || hasCapability(role, user.capabilities, 'LEAD_GEN')) {
    return next();
  }
  return res.status(403).json({ error: 'LEAD_GEN capability required' });
}

// ─── API-key routes (for pipeline automation) ───

// POST /api/admin/leads/ingest — bulk-create leads (skip existing dedupeKeys)
const ingestLeadSchema = z.object({
  name: z.string().min(1),
  platforms: z.array(z.string()).default([]),
  handle: z.string().optional(),
  followers: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  contactUrl: z.string().optional(),
  focusAreas: z.string().optional(),
  whyRelevant: z.string().optional(),
  notes: z.string().optional(),
  list: z.string().min(1),
  country: z.string().optional(),
  language: z.string().optional(),
  dedupeKey: z.string().min(1),
  source: z.nativeEnum(LeadSource).default(LeadSource.CSV_IMPORT),
  sourceDetail: z.string().optional(),
  sourceUrl: z.string().optional(),
  outreachMessage: z.string().optional(),
  pipelinePhase: z.string().optional(),
  pipelineRunId: z.string().optional(),
});

const ingestSchema = z.object({
  leads: z.array(ingestLeadSchema).min(1).max(200),
});

router.post('/ingest', apiKeyAdmin, async (req, res) => {
  try {
    const parsed = ingestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }

    // Check which dedupeKeys already exist
    const incomingKeys = parsed.data.leads.map((l) => l.dedupeKey);
    const existing = await prisma.influencerLead.findMany({
      where: { dedupeKey: { in: incomingKeys } },
      select: { dedupeKey: true },
    });
    const existingKeys = new Set(existing.map((e) => e.dedupeKey));

    const newLeads = parsed.data.leads.filter((l) => !existingKeys.has(l.dedupeKey));

    let created = 0;
    for (const lead of newLeads) {
      await prisma.influencerLead.create({ data: lead });
      created++;
    }

    logger.info({ created, skipped: existingKeys.size }, 'Leads ingested');
    res.json({ created, skipped: parsed.data.leads.length - created });
  } catch (error) {
    logger.error({ err: error }, 'Lead ingest error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/leads/dedupe-check?keys=k1,k2 — check which keys exist
router.get('/dedupe-check', apiKeyAdmin, async (req, res) => {
  try {
    const keysParam = (req.query.keys as string) || '';
    const keys = keysParam.split(',').map((k) => k.trim()).filter(Boolean);
    if (keys.length === 0) return res.json({ existing: [] });

    const existing = await prisma.influencerLead.findMany({
      where: { dedupeKey: { in: keys } },
      select: { dedupeKey: true },
    });

    res.json({ existing: existing.map((e) => e.dedupeKey) });
  } catch (error) {
    logger.error({ err: error }, 'Dedupe check error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/leads/bulk-status — bulk-update status
const bulkStatusSchema = z.object({
  ids: z.array(z.string()).min(1).max(200),
  status: z.nativeEnum(LeadStatus),
});

router.post('/bulk-status', apiKeyAdmin, async (req, res) => {
  try {
    const parsed = bulkStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }

    const result = await prisma.influencerLead.updateMany({
      where: { id: { in: parsed.data.ids } },
      data: { status: parsed.data.status },
    });

    res.json({ updated: result.count });
  } catch (error) {
    logger.error({ err: error }, 'Bulk status update error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── JWT staff/admin auth (dashboard) ───

router.use(authenticateToken, requireStaffOrAdmin, requireLeadGen);

// GET /api/admin/leads/stats
router.get('/stats', async (_req, res) => {
  try {
    const [byStatus, byList, bySource, total, recentlyAdded] = await Promise.all([
      prisma.influencerLead.groupBy({ by: ['status'], _count: true }),
      prisma.influencerLead.groupBy({ by: ['list'], _count: true }),
      prisma.influencerLead.groupBy({ by: ['source'], _count: true }),
      prisma.influencerLead.count(),
      prisma.influencerLead.count({
        where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      }),
    ]);

    const statusCounts: Record<string, number> = {};
    for (const g of byStatus) statusCounts[g.status] = g._count;

    const listCounts: Record<string, number> = {};
    for (const g of byList) listCounts[g.list] = g._count;

    const sourceCounts: Record<string, number> = {};
    for (const g of bySource) sourceCounts[g.source] = g._count;

    res.json({ total, byStatus: statusCounts, byList: listCounts, bySource: sourceCounts, recentlyAdded });
  } catch (error) {
    logger.error({ err: error }, 'Lead stats error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/leads — paginated list with filters
router.get('/', async (req: AuthRequest, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const search = (req.query.search as string) || '';
    const status = req.query.status as string;
    const list = req.query.list as string;
    const source = req.query.source as string;
    const assignedTo = req.query.assignedTo as string;

    const where: any = {};

    if (status && LEAD_STATUSES.includes(status as any)) {
      where.status = status;
    }
    if (list) {
      where.list = list;
    }
    if (source && LEAD_SOURCES.includes(source as any)) {
      where.source = source;
    }
    if (assignedTo) {
      where.assignedToId = assignedTo;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { handle: { contains: search, mode: 'insensitive' } },
        { focusAreas: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [leads, total] = await Promise.all([
      prisma.influencerLead.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { assignedTo: { select: { id: true, name: true } } },
      }),
      prisma.influencerLead.count({ where }),
    ]);

    res.json({
      leads,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error({ err: error }, 'Lead list error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/leads/export — export as CSV
router.get('/export', async (req: AuthRequest, res) => {
  try {
    const list = req.query.list as string;
    const status = req.query.status as string;
    const where: any = {};
    if (list) where.list = list;
    if (status && LEAD_STATUSES.includes(status as any)) where.status = status;

    const leads = await prisma.influencerLead.findMany({ where, orderBy: { createdAt: 'desc' } });

    const headers = ['Name', 'Platforms', 'Handle', 'Followers', 'Email', 'Phone', 'Contact URL', 'Focus Areas', 'List', 'Status', 'Source', 'Country', 'Language', 'DedupeKey', 'Created'];
    const csvRows = [headers.join(',')];

    for (const l of leads) {
      const row = [
        `"${(l.name || '').replace(/"/g, '""')}"`,
        `"${(l.platforms || []).join(', ')}"`,
        `"${(l.handle || '').replace(/"/g, '""')}"`,
        `"${(l.followers || '').replace(/"/g, '""')}"`,
        `"${(l.email || '').replace(/"/g, '""')}"`,
        `"${(l.phone || '').replace(/"/g, '""')}"`,
        `"${(l.contactUrl || '').replace(/"/g, '""')}"`,
        `"${(l.focusAreas || '').replace(/"/g, '""')}"`,
        l.list,
        l.status,
        l.source,
        l.country || '',
        l.language || '',
        `"${l.dedupeKey.replace(/"/g, '""')}"`,
        l.createdAt.toISOString(),
      ];
      csvRows.push(row.join(','));
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=leads-export-${new Date().toISOString().slice(0, 10)}.csv`);
    res.send(csvRows.join('\n'));
  } catch (error) {
    logger.error({ err: error }, 'Lead export error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/leads/:id — single lead detail
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const lead = await prisma.influencerLead.findUnique({
      where: { id: req.params.id },
      include: { assignedTo: { select: { id: true, name: true, email: true } } },
    });
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    res.json(lead);
  } catch (error) {
    logger.error({ err: error }, 'Lead detail error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/leads — create lead manually
const createLeadSchema = z.object({
  name: z.string().min(1),
  platforms: z.array(z.string()).default([]),
  handle: z.string().optional(),
  followers: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  contactUrl: z.string().optional(),
  focusAreas: z.string().optional(),
  whyRelevant: z.string().optional(),
  notes: z.string().optional(),
  list: z.string().min(1),
  country: z.string().optional(),
  language: z.string().optional(),
  dedupeKey: z.string().min(1),
  source: z.nativeEnum(LeadSource).default(LeadSource.MANUAL),
  sourceDetail: z.string().optional(),
  sourceUrl: z.string().optional(),
  outreachMessage: z.string().optional(),
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const parsed = createLeadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }

    const existing = await prisma.influencerLead.findUnique({ where: { dedupeKey: parsed.data.dedupeKey } });
    if (existing) {
      return res.status(409).json({ error: 'Lead with this dedupeKey already exists', existingId: existing.id });
    }

    const lead = await prisma.influencerLead.create({ data: parsed.data });
    logger.info({ leadId: lead.id }, 'Lead created manually');
    res.status(201).json(lead);
  } catch (error) {
    logger.error({ err: error }, 'Lead create error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/admin/leads/:id — update fields
const updateLeadSchema = z.object({
  name: z.string().min(1).optional(),
  platforms: z.array(z.string()).optional(),
  handle: z.string().nullable().optional(),
  followers: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  contactUrl: z.string().nullable().optional(),
  focusAreas: z.string().nullable().optional(),
  whyRelevant: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  list: z.string().min(1).optional(),
  country: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  sourceDetail: z.string().nullable().optional(),
  sourceUrl: z.string().nullable().optional(),
  outreachMessage: z.string().nullable().optional(),
  outreachChannel: z.string().nullable().optional(),
  responseNotes: z.string().nullable().optional(),
  adminNotes: z.string().nullable().optional(),
}).strict();

router.patch('/:id', async (req: AuthRequest, res) => {
  try {
    const parsed = updateLeadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }

    const lead = await prisma.influencerLead.update({
      where: { id: req.params.id },
      data: parsed.data,
    });
    res.json(lead);
  } catch (error: any) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Lead not found' });
    logger.error({ err: error }, 'Lead update error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/admin/leads/:id/status — transition status (validated)
const statusTransitionSchema = z.object({
  status: z.nativeEnum(LeadStatus),
});

router.patch('/:id/status', async (req: AuthRequest, res) => {
  try {
    const parsed = statusTransitionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }

    const lead = await prisma.influencerLead.findUnique({ where: { id: req.params.id } });
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const allowed = STATUS_TRANSITIONS[lead.status] || [];
    if (!allowed.includes(parsed.data.status)) {
      return res.status(400).json({
        error: `Cannot transition from ${lead.status} to ${parsed.data.status}`,
        allowed,
      });
    }

    const extraData: any = {};
    if (parsed.data.status === 'CONTACTED') {
      extraData.outreachSentAt = new Date();
      extraData.lastContactAt = new Date();
    }

    const updated = await prisma.influencerLead.update({
      where: { id: req.params.id },
      data: { status: parsed.data.status, ...extraData },
    });
    res.json(updated);
  } catch (error) {
    logger.error({ err: error }, 'Lead status transition error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/admin/leads/:id/assign — assign to staff
const assignSchema = z.object({
  assignedToId: z.string().nullable(),
});

router.patch('/:id/assign', async (req: AuthRequest, res) => {
  try {
    const parsed = assignSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }

    const lead = await prisma.influencerLead.update({
      where: { id: req.params.id },
      data: { assignedToId: parsed.data.assignedToId },
      include: { assignedTo: { select: { id: true, name: true } } },
    });
    res.json(lead);
  } catch (error: any) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Lead not found' });
    logger.error({ err: error }, 'Lead assign error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/leads/:id
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    await prisma.influencerLead.delete({ where: { id: req.params.id } });
    res.json({ deleted: true });
  } catch (error: any) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Lead not found' });
    logger.error({ err: error }, 'Lead delete error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
