import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AnalysisComputationError } from './analysis-computation-error.js';
import type { AnalysisRunService } from './analysis-run-service.js';
import { isAnalysisType } from './analysis-run-service.js';
import type { AnalysisReportSummaryDto } from './analysis-types.js';

const MAX_LIMIT: number = 100;
const DEFAULT_LIMIT: number = 30;

export function registerAnalysisRoutes(input: {
  readonly app: FastifyInstance;
  readonly analysisRunService: AnalysisRunService;
}): void {
  input.app.post(
    '/analysis/runs',
    {
      preHandler: input.app.requireSession,
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['type', 'parameters'],
          properties: {
            type: { type: 'string' },
            parameters: { type: 'object', additionalProperties: true },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId: string = request.authUser?.userId ?? '';
      const username: string = request.authUser?.username ?? 'You';
      const body = request.body as { readonly type: string; readonly parameters: Record<string, unknown> };
      if (!isAnalysisType(body.type)) {
        return reply.code(400).send({ error: { code: 'ANALYSIS_TYPE_INVALID', message: 'Unsupported analysis type.' } });
      }
      try {
        const run = await input.analysisRunService.createRun({
          userId,
          username,
          now: new Date(),
          type: body.type,
          parameters: body.parameters,
        });
        return reply.send({ run });
      } catch (error: unknown) {
        if (error instanceof AnalysisComputationError) {
          return reply.code(422).send({
            error: { code: error.code, message: error.message },
          });
        }
        throw error;
      }
    },
  );

  input.app.get(
    '/analysis/runs',
    {
      preHandler: input.app.requireSession,
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            limit: { type: 'string' },
            type: { type: 'string' },
            status: { type: 'string' },
          },
        },
      },
    },
    async (request: FastifyRequest) => {
      const userId: string = request.authUser?.userId ?? '';
      const query = request.query as { readonly limit?: string; readonly type?: string; readonly status?: string };
      const limit: number =
        query.limit !== undefined
          ? Math.min(MAX_LIMIT, Math.max(1, Number.parseInt(query.limit, 10) || DEFAULT_LIMIT))
          : DEFAULT_LIMIT;
      const runs = await input.analysisRunService.listRuns({ userId, now: new Date(), limit });
      const filtered = runs.filter((run) => {
        if (query.type !== undefined && query.type.length > 0 && run.type !== query.type) {
          return false;
        }
        if (query.status !== undefined && query.status.length > 0 && run.status !== query.status.toLowerCase()) {
          return false;
        }
        return true;
      });
      return { items: filtered };
    },
  );

  input.app.get(
    '/analysis/runs/:id',
    {
      preHandler: input.app.requireSession,
      schema: {
        params: {
          type: 'object',
          additionalProperties: false,
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId: string = request.authUser?.userId ?? '';
      const params = request.params as { readonly id: string };
      const run = await input.analysisRunService.getRunById({ userId, now: new Date(), runId: params.id });
      if (run === undefined) {
        return reply.code(404).send({ error: 'Run not found.' });
      }
      return { run };
    },
  );

  input.app.get(
    '/analysis/reports',
    {
      preHandler: input.app.requireSession,
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            limit: { type: 'string' },
            type: { type: 'string' },
            query: { type: 'string' },
            scope: { type: 'string' },
          },
        },
      },
    },
    async (request: FastifyRequest) => {
      const userId: string = request.authUser?.userId ?? '';
      const username: string = request.authUser?.username ?? 'You';
      const query = request.query as {
        readonly limit?: string;
        readonly type?: string;
        readonly query?: string;
        readonly scope?: string;
      };
      const limit: number =
        query.limit !== undefined
          ? Math.min(MAX_LIMIT, Math.max(1, Number.parseInt(query.limit, 10) || DEFAULT_LIMIT))
          : DEFAULT_LIMIT;
      const needle: string = query.query?.trim().toLowerCase() ?? '';
      const reports = await input.analysisRunService.listReports({ userId, now: new Date(), limit });
      const filtered = reports.filter((report) => {
        if (query.type !== undefined && query.type.length > 0 && report.type !== query.type) {
          return false;
        }
        if (query.scope === 'my' && report.createdBy !== username) {
          return false;
        }
        if (query.scope === 'all' && report.createdBy === username) {
          return false;
        }
        if (needle.length > 0) {
          const hay = `${report.title} ${report.summary}`.toLowerCase();
          if (!hay.includes(needle)) {
            return false;
          }
        }
        return true;
      });
      const items: AnalysisReportSummaryDto[] = filtered.map((report) => ({
        reportId: report.reportId,
        runId: report.runId,
        type: report.type,
        title: report.title,
        summary: report.summary,
        createdBy: report.createdBy,
        createdAt: report.createdAtIso,
      }));
      return { items };
    },
  );

  input.app.get(
    '/analysis/reports/:id',
    {
      preHandler: input.app.requireSession,
      schema: {
        params: {
          type: 'object',
          additionalProperties: false,
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId: string = request.authUser?.userId ?? '';
      const params = request.params as { readonly id: string };
      const report = await input.analysisRunService.getReportById({ userId, now: new Date(), reportId: params.id });
      if (report === undefined) {
        return reply.code(404).send({ error: 'Report not found.' });
      }
      const bundleAssetUrls: Record<string, string> | null =
        await input.analysisRunService.getPresignedBundleAssetUrlsForReport({ report });
      return {
        report: {
          reportId: report.reportId,
          runId: report.runId,
          type: report.type,
          title: report.title,
          summary: report.summary,
          markdownBody: report.markdownBody,
          storageBucket: report.storageBucket,
          storageKey: report.storageKey,
          storageBundlePrefix: report.storageBundlePrefix,
          storageManifestKey: report.storageManifestKey,
          bundleAssetUrls,
          createdBy: report.createdBy,
          createdAt: report.createdAtIso,
        },
      };
    },
  );

  input.app.get(
    '/analysis/reports/:id/export',
    {
      preHandler: input.app.requireSession,
      schema: {
        params: {
          type: 'object',
          additionalProperties: false,
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId: string = request.authUser?.userId ?? '';
      const params = request.params as { readonly id: string };
      const report = await input.analysisRunService.getReportById({ userId, now: new Date(), reportId: params.id });
      if (report === undefined) {
        return reply.code(404).send({ error: 'Report not found.' });
      }
      return {
        fileName: `${report.type}-${report.reportId}.md`,
        format: 'markdown',
        content: report.markdownBody,
      };
    },
  );
}
