import { Router } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth.js';
import { adminJwtOrSharedKey } from '../middleware/adminAuth.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

const router = Router();

const STATUSES = ['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED'] as const;
const PRIORITIES = ['P0', 'P0.5', 'P1', 'P1.5', 'P2', 'P2.5', 'P3'] as const;

const createSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  status: z.enum(STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  labels: z.array(z.string()).optional(),
  assignee: z.string().max(100).optional(),
  linearId: z.string().max(100).optional(),
});

const updateSchema = createSchema.partial().extend({
  sortOrder: z.number().int().optional(),
});

const listSchema = z.object({
  status: z.string().optional(),
  priority: z.string().optional(),
  assignee: z.string().optional(),
  label: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

// ─── LIST tasks ───
router.get('/', adminJwtOrSharedKey, async (req: AuthRequest, res) => {
  try {
    const params = listSchema.parse(req.query);
    const where: any = {};

    if (params.status) {
      // Support comma-separated statuses: "TODO,IN_PROGRESS"
      const statuses = params.status.split(',').map(s => s.trim());
      where.status = statuses.length === 1 ? statuses[0] : { in: statuses };
    }
    if (params.priority) where.priority = params.priority;
    if (params.assignee) where.assignee = params.assignee;
    if (params.label) where.labels = { has: params.label };
    if (params.search) {
      where.OR = [
        { title: { contains: params.search, mode: 'insensitive' } },
        { description: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [tasks, total] = await Promise.all([
      prisma.adminTask.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      prisma.adminTask.count({ where }),
    ]);

    res.json({
      tasks,
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid params', details: error.errors });
    logger.error({ err: error }, 'Board list error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── CREATE task ───
router.post('/', adminJwtOrSharedKey, async (req: AuthRequest, res) => {
  try {
    const data = createSchema.parse(req.body);
    // Put new tasks at top of their column
    const maxSort = await prisma.adminTask.aggregate({
      where: { status: data.status ?? 'TODO' },
      _min: { sortOrder: true },
    });
    const sortOrder = (maxSort._min.sortOrder ?? 0) - 1;

    const task = await prisma.adminTask.create({
      data: { ...data, sortOrder },
    });
    res.status(201).json(task);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid data', details: error.errors });
    logger.error({ err: error }, 'Board create error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET single task ───
router.get('/:id', adminJwtOrSharedKey, async (req: AuthRequest, res) => {
  try {
    const task = await prisma.adminTask.findUnique({ where: { id: req.params.id } });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (error) {
    logger.error({ err: error }, 'Board get error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── UPDATE task ───
router.patch('/:id', adminJwtOrSharedKey, async (req: AuthRequest, res) => {
  try {
    const data = updateSchema.parse(req.body);
    const task = await prisma.adminTask.update({
      where: { id: req.params.id },
      data,
    });
    res.json(task);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid data', details: error.errors });
    logger.error({ err: error }, 'Board update error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE task ───
router.delete('/:id', adminJwtOrSharedKey, async (req: AuthRequest, res) => {
  try {
    await prisma.adminTask.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Board delete error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── BULK import (for Linear migration) ───
router.post('/import', adminJwtOrSharedKey, async (req: AuthRequest, res) => {
  try {
    const tasksSchema = z.array(createSchema);
    const tasks = tasksSchema.parse(req.body);

    const created = await prisma.adminTask.createMany({
      data: tasks.map((t, i) => ({
        ...t,
        sortOrder: i,
      })),
      skipDuplicates: true,
    });

    res.status(201).json({ imported: created.count });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid data', details: error.errors });
    logger.error({ err: error }, 'Board import error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
