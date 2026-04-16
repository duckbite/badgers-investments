import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import {
  buildAnalysisReportSortKey,
  buildAnalysisReportSortKeyPrefix,
  buildAnalysisRunSortKey,
  buildAnalysisRunSortKeyPrefix,
  buildPortfolioScopedPartitionKey,
} from '../domain/domain-keys.js';
import { ANALYSIS_TYPES } from './analysis-types.js';
import type { AnalysisReportRecord, AnalysisRunRecord, AnalysisStatus, AnalysisType } from './analysis-types.js';

const PARTITION_KEY: string = 'PK';
const SORT_KEY: string = 'SK';
const ENTITY_ANALYSIS_RUN: string = 'ANALYSIS_RUN';
const ENTITY_ANALYSIS_REPORT: string = 'ANALYSIS_REPORT';
const ANALYSIS_STATUSES: readonly AnalysisStatus[] = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'];

export class AnalysisRunRepository {
  private readonly documentClient: DynamoDBDocumentClient;
  private readonly tableName: string;

  public constructor(input: { readonly documentClient: DynamoDBDocumentClient; readonly tableName: string }) {
    this.documentClient = input.documentClient;
    this.tableName = input.tableName;
  }

  public async putRun(input: { readonly userId: string; readonly record: AnalysisRunRecord }): Promise<void> {
    const item = {
      [PARTITION_KEY]: buildPortfolioScopedPartitionKey({ userId: input.userId, portfolioId: input.record.portfolioId }),
      [SORT_KEY]: buildAnalysisRunSortKey({ createdAtIso: input.record.createdAtIso, runId: input.record.runId }),
      entityType: ENTITY_ANALYSIS_RUN,
      ...input.record,
    };
    await this.documentClient.send(new PutCommand({ TableName: this.tableName, Item: item }));
  }

  public async putReport(input: { readonly userId: string; readonly record: AnalysisReportRecord }): Promise<void> {
    const item = {
      [PARTITION_KEY]: buildPortfolioScopedPartitionKey({ userId: input.userId, portfolioId: input.record.portfolioId }),
      [SORT_KEY]: buildAnalysisReportSortKey({ createdAtIso: input.record.createdAtIso, reportId: input.record.reportId }),
      entityType: ENTITY_ANALYSIS_REPORT,
      ...input.record,
    };
    await this.documentClient.send(new PutCommand({ TableName: this.tableName, Item: item }));
  }

  public async listRuns(input: {
    readonly userId: string;
    readonly portfolioId: string;
    readonly limit: number;
  }): Promise<readonly AnalysisRunRecord[]> {
    return this.queryByPrefix<AnalysisRunRecord>({
      userId: input.userId,
      portfolioId: input.portfolioId,
      prefix: buildAnalysisRunSortKeyPrefix(),
      limit: input.limit,
      parser: parseRun,
    });
  }

  public async listReports(input: {
    readonly userId: string;
    readonly portfolioId: string;
    readonly limit: number;
  }): Promise<readonly AnalysisReportRecord[]> {
    return this.queryByPrefix<AnalysisReportRecord>({
      userId: input.userId,
      portfolioId: input.portfolioId,
      prefix: buildAnalysisReportSortKeyPrefix(),
      limit: input.limit,
      parser: parseReport,
    });
  }

  private async queryByPrefix<T>(input: {
    readonly userId: string;
    readonly portfolioId: string;
    readonly prefix: string;
    readonly limit: number;
    readonly parser: (item: Record<string, unknown>) => T | undefined;
  }): Promise<readonly T[]> {
    const partitionKey = buildPortfolioScopedPartitionKey({ userId: input.userId, portfolioId: input.portfolioId });
    const collected: T[] = [];
    let startKey: Record<string, unknown> | undefined;
    do {
      const response = await this.documentClient.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
          ExpressionAttributeValues: { ':pk': partitionKey, ':prefix': input.prefix },
          ScanIndexForward: false,
          ExclusiveStartKey: startKey,
        }),
      );
      for (const item of response.Items ?? []) {
        const parsed = input.parser(item);
        if (parsed !== undefined) {
          collected.push(parsed);
        }
      }
      startKey = response.LastEvaluatedKey;
    } while (startKey !== undefined && collected.length < input.limit);
    return collected.slice(0, input.limit);
  }
}

function parseRun(item: Record<string, unknown>): AnalysisRunRecord | undefined {
  if (item['entityType'] !== ENTITY_ANALYSIS_RUN) {
    return undefined;
  }
  if (
    typeof item['runId'] !== 'string' ||
    typeof item['portfolioId'] !== 'string' ||
    typeof item['type'] !== 'string' ||
    typeof item['status'] !== 'string' ||
    typeof item['parametersJson'] !== 'string' ||
    typeof item['summary'] !== 'string' ||
    typeof item['createdAtIso'] !== 'string'
  ) {
    return undefined;
  }
  const analysisType: AnalysisType | undefined = parseAnalysisType({ value: item['type'] });
  const analysisStatus: AnalysisStatus | undefined = parseAnalysisStatus({ value: item['status'] });
  if (analysisType === undefined || analysisStatus === undefined) {
    return undefined;
  }
  return {
    runId: item['runId'],
    portfolioId: item['portfolioId'],
    type: analysisType,
    status: analysisStatus,
    parametersJson: item['parametersJson'],
    summary: item['summary'],
    createdAtIso: item['createdAtIso'],
    completedAtIso: typeof item['completedAtIso'] === 'string' ? item['completedAtIso'] : null,
    reportId: typeof item['reportId'] === 'string' ? item['reportId'] : null,
    errorMessage: typeof item['errorMessage'] === 'string' ? item['errorMessage'] : null,
  };
}

function parseReport(item: Record<string, unknown>): AnalysisReportRecord | undefined {
  if (item['entityType'] !== ENTITY_ANALYSIS_REPORT) {
    return undefined;
  }
  if (
    typeof item['reportId'] !== 'string' ||
    typeof item['runId'] !== 'string' ||
    typeof item['portfolioId'] !== 'string' ||
    typeof item['type'] !== 'string' ||
    typeof item['title'] !== 'string' ||
    typeof item['summary'] !== 'string' ||
    typeof item['markdownBody'] !== 'string' ||
    typeof item['createdAtIso'] !== 'string' ||
    typeof item['createdBy'] !== 'string'
  ) {
    return undefined;
  }
  const analysisType: AnalysisType | undefined = parseAnalysisType({ value: item['type'] });
  if (analysisType === undefined) {
    return undefined;
  }
  return {
    reportId: item['reportId'],
    runId: item['runId'],
    portfolioId: item['portfolioId'],
    type: analysisType,
    title: item['title'],
    summary: item['summary'],
    markdownBody: item['markdownBody'],
    storageBucket: typeof item['storageBucket'] === 'string' ? item['storageBucket'] : null,
    storageKey: typeof item['storageKey'] === 'string' ? item['storageKey'] : null,
    createdAtIso: item['createdAtIso'],
    createdBy: item['createdBy'],
  };
}

function parseAnalysisType(input: { readonly value: unknown }): AnalysisType | undefined {
  if (typeof input.value !== 'string') {
    return undefined;
  }
  if (!ANALYSIS_TYPES.includes(input.value as AnalysisType)) {
    return undefined;
  }
  return input.value as AnalysisType;
}

function parseAnalysisStatus(input: { readonly value: unknown }): AnalysisStatus | undefined {
  if (typeof input.value !== 'string') {
    return undefined;
  }
  if (!ANALYSIS_STATUSES.includes(input.value as AnalysisStatus)) {
    return undefined;
  }
  return input.value as AnalysisStatus;
}
