import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { logger } from '../lib/logger.js';

const router = Router();

// ─── Types ───

interface WizardAnalyticsResponse {
  configured: boolean;
  range?: string;
  wizardName?: string;
  funnel?: { step: string; unique_runs: number }[];
  abandonment?: { step: string; count: number }[];
  stepTiming?: { step: string; avg_duration: number }[];
  buttonClicks?: { button: string; clicks: number }[];
  fieldEngagement?: { field: string; focus: number; blur: number; errors: number }[];
  formLifecycle?: { form: string; opened: number; completed: number; abandoned: number }[];
  deviceBreakdown?: { mobile: number; desktop: number; inAppBrowser: number };
  dailyActivity?: { day: string; sessions: number; events: number }[];
  completionRate?: { started: number; completed: number; abandoned: number };
  message?: string;
  errors?: Record<string, string>;
}

interface PostHogQueryResult {
  results?: Array<Record<string, any>>;
  error?: string;
}

// ─── Helper functions ───

function getPostHogConfig() {
  const personalApiKey = process.env.POSTHOG_PERSONAL_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID;

  return { personalApiKey, projectId, configured: !!(personalApiKey && projectId) };
}

async function queryPostHogHogQL(
  query: string,
  projectId: string,
  personalApiKey: string,
): Promise<PostHogQueryResult> {
  try {
    const response = await fetch(
      `https://us.i.posthog.com/api/projects/${projectId}/query/`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${personalApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(
        { status: response.status, error: errorText },
        'PostHog API error',
      );
      return { error: `PostHog API error: ${response.status}` };
    }

    const data = (await response.json()) as PostHogQueryResult;
    return data;
  } catch (error) {
    logger.error({ err: error }, 'PostHog query failed');
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Whitelist allowed wizard names to prevent HogQL injection
const ALLOWED_WIZARDS = ['onboarding', 'kyc', 'payment', 'profile', 'verification'];

function parseIntervalToSQLInterval(range: string): string {
  // Convert '30d' to '30 day', '7d' to '7 day', etc.
  const match = range.match(/^(\d+)([dwmy])$/);
  if (!match) return '30 day'; // default to 30 days

  const num = Math.min(parseInt(match[1], 10), 365); // Cap at 365
  const unit = match[2];
  const unitMap: Record<string, string> = {
    d: 'day',
    w: 'week',
    m: 'month',
    y: 'year',
  };

  return `${num} ${unitMap[unit]}`;
}

// ─── Main endpoint: GET /api/admin/analytics/wizard ───

router.get(
  '/wizard',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const { range = '30d', wizardName = 'onboarding' } = req.query;
      const rangeStr = String(range);
      const wizardStr = String(wizardName);

      // Validate wizard name to prevent HogQL injection
      if (!ALLOWED_WIZARDS.includes(wizardStr) && !/^[a-zA-Z0-9_-]{1,50}$/.test(wizardStr)) {
        return res.status(400).json({ error: 'Invalid wizard name' });
      }

      // Validate range format
      if (!/^\d{1,3}[dwmy]$/.test(rangeStr)) {
        return res.status(400).json({ error: 'Invalid range format. Use e.g. 30d, 7d, 1m' });
      }

      const config = getPostHogConfig();

      // If PostHog is not configured, return early with helpful message
      if (!config.configured || !config.personalApiKey || !config.projectId) {
        return res.status(200).json({
          configured: false,
          message:
            'PostHog analytics not configured. Set POSTHOG_PERSONAL_API_KEY and POSTHOG_PROJECT_ID env vars.',
        } as WizardAnalyticsResponse);
      }

      const personalApiKey = config.personalApiKey;
      const projectId = config.projectId;
      const sqlInterval = parseIntervalToSQLInterval(rangeStr);

      // ─── Build all HogQL queries ───

      const queries = {
        funnel: `
          SELECT properties.step as step, uniq(properties.wizard_run_id) as unique_runs
          FROM events
          WHERE properties.wizard_name = '${wizardStr}'
            AND timestamp > now() - interval ${sqlInterval}
          GROUP BY step
          ORDER BY unique_runs DESC
        `,

        abandonment: `
          SELECT properties.step as step, count() as count
          FROM events
          WHERE event = '${wizardStr}_abandoned'
            AND timestamp > now() - interval ${sqlInterval}
          GROUP BY step
          ORDER BY count DESC
        `,

        stepTiming: `
          SELECT properties.step as step, avg(toFloat64(properties.step_duration_seconds)) as avg_duration
          FROM events
          WHERE event = '${wizardStr}_abandoned'
            AND timestamp > now() - interval ${sqlInterval}
            AND properties.step_duration_seconds IS NOT NULL
          GROUP BY step
        `,

        buttonClicks: `
          SELECT properties.button as button, count() as clicks
          FROM events
          WHERE event = '${wizardStr}_button_clicked'
            AND timestamp > now() - interval ${sqlInterval}
          GROUP BY button
          ORDER BY clicks DESC
        `,

        fieldEngagement: `
          SELECT properties.field as field,
            countIf(event = '${wizardStr}_field_focused') as focus_count,
            countIf(event = '${wizardStr}_field_blurred') as blur_count,
            countIf(event = '${wizardStr}_field_error') as error_count
          FROM events
          WHERE event IN ('${wizardStr}_field_focused', '${wizardStr}_field_blurred', '${wizardStr}_field_error')
            AND timestamp > now() - interval ${sqlInterval}
          GROUP BY field
          ORDER BY focus_count DESC
        `,

        formLifecycle: `
          SELECT properties.form_name as form,
            countIf(event = '${wizardStr}_form_opened') as opened,
            countIf(event = '${wizardStr}_form_completed') as completed,
            countIf(event = '${wizardStr}_form_abandoned') as abandoned
          FROM events
          WHERE event IN ('${wizardStr}_form_opened', '${wizardStr}_form_completed', '${wizardStr}_form_abandoned')
            AND timestamp > now() - interval ${sqlInterval}
          GROUP BY form
        `,

        deviceBreakdown: `
          SELECT
            countIf(properties.is_mobile = true) as mobile,
            countIf(properties.is_mobile = false OR properties.is_mobile IS NULL) as desktop,
            countIf(properties.is_in_app_browser = true) as in_app_browser
          FROM events
          WHERE properties.wizard_name = '${wizardStr}'
            AND timestamp > now() - interval ${sqlInterval}
        `,

        dailyActivity: `
          SELECT toDate(timestamp) as day, uniq(properties.wizard_run_id) as unique_sessions, count() as total_events
          FROM events
          WHERE properties.wizard_name = '${wizardStr}'
            AND timestamp > now() - interval ${sqlInterval}
          GROUP BY day
          ORDER BY day
        `,

        completionRate: `
          SELECT
            uniq(properties.wizard_run_id) as total_starts,
            uniqIf(properties.wizard_run_id, event = '${wizardStr}_abandoned') as abandoned,
            uniqIf(properties.wizard_run_id, event = '${wizardStr}_completed') as completed
          FROM events
          WHERE properties.wizard_name = '${wizardStr}'
            AND timestamp > now() - interval ${sqlInterval}
        `,
      };

      // ─── Execute all queries in parallel with error handling ───

      const results = await Promise.allSettled(
        Object.entries(queries).map(async ([key, query]) => {
          const result = await queryPostHogHogQL(
            query,
            projectId,
            personalApiKey,
          );
          return { key, result };
        }),
      );

      // ─── Process results ───

      const response: WizardAnalyticsResponse = {
        configured: true,
        range: rangeStr,
        wizardName: wizardStr,
        errors: {},
      };

      for (const settlement of results) {
        if (settlement.status === 'rejected') {
          response.errors![settlement.reason.key] = settlement.reason.message;
          continue;
        }

        const { key, result } = settlement.value;

        if (result.error) {
          response.errors![key] = result.error;
          continue;
        }

        if (!result.results || result.results.length === 0) {
          continue;
        }

        // Map results based on query type
        switch (key) {
          case 'funnel':
            response.funnel = result.results.map((row: any) => ({
              step: row.step || 'unknown',
              unique_runs: parseInt(row.unique_runs, 10) || 0,
            }));
            break;

          case 'abandonment':
            response.abandonment = result.results.map((row: any) => ({
              step: row.step || 'unknown',
              count: parseInt(row.count, 10) || 0,
            }));
            break;

          case 'stepTiming':
            response.stepTiming = result.results.map((row: any) => ({
              step: row.step || 'unknown',
              avg_duration: parseFloat(row.avg_duration) || 0,
            }));
            break;

          case 'buttonClicks':
            response.buttonClicks = result.results.map((row: any) => ({
              button: row.button || 'unknown',
              clicks: parseInt(row.clicks, 10) || 0,
            }));
            break;

          case 'fieldEngagement':
            response.fieldEngagement = result.results.map((row: any) => ({
              field: row.field || 'unknown',
              focus: parseInt(row.focus_count, 10) || 0,
              blur: parseInt(row.blur_count, 10) || 0,
              errors: parseInt(row.error_count, 10) || 0,
            }));
            break;

          case 'formLifecycle':
            response.formLifecycle = result.results.map((row: any) => ({
              form: row.form || 'unknown',
              opened: parseInt(row.opened, 10) || 0,
              completed: parseInt(row.completed, 10) || 0,
              abandoned: parseInt(row.abandoned, 10) || 0,
            }));
            break;

          case 'deviceBreakdown':
            if (result.results.length > 0) {
              const row = result.results[0];
              response.deviceBreakdown = {
                mobile: parseInt(row.mobile, 10) || 0,
                desktop: parseInt(row.desktop, 10) || 0,
                inAppBrowser: parseInt(row.in_app_browser, 10) || 0,
              };
            }
            break;

          case 'dailyActivity':
            response.dailyActivity = result.results.map((row: any) => ({
              day: row.day || 'unknown',
              sessions: parseInt(row.unique_sessions, 10) || 0,
              events: parseInt(row.total_events, 10) || 0,
            }));
            break;

          case 'completionRate':
            if (result.results.length > 0) {
              const row = result.results[0];
              response.completionRate = {
                started: parseInt(row.total_starts, 10) || 0,
                completed: parseInt(row.completed, 10) || 0,
                abandoned: parseInt(row.abandoned, 10) || 0,
              };
            }
            break;
        }
      }

      return res.json(response);
    } catch (error) {
      logger.error({ err: error }, 'Wizard analytics endpoint error');
      return res.status(500).json({
        configured: true,
        message: 'Internal server error',
        errors: {
          general: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  },
);

export default router;
