import type { S3Client } from '@aws-sdk/client-s3';
import type { AnalysisType } from './analysis-types.js';
import { buildAnalysisReportBundleFolderPrefix } from './build-analysis-report-storage-key.js';
import type { TechnicalAnalysisBundleChartContext } from './bundle-chart-context.js';
import type { TechnicalAnalysisComputationPayload } from './compute-technical-analysis-payload.js';
import { appendUnreferencedTechnicalAnalysisChartAppendix } from './technical-analysis-chart-embed.js';
import { uploadSimpleAnalysisReportBundle, uploadTechnicalAnalysisReportBundle } from './technical-analysis-bundle.js';

export type ReportStorage = {
  readonly bucketName: string | null;
  readonly s3Client?: S3Client;
};

export async function persistAnalysisReportBundle(input: {
  readonly reportStorage: ReportStorage;
  readonly type: AnalysisType;
  readonly parameters: Record<string, unknown>;
  readonly reportTimestampIso: string;
  readonly markdownBody: string;
  readonly technicalPayload: TechnicalAnalysisComputationPayload | undefined;
  readonly technicalChartContext: TechnicalAnalysisBundleChartContext | undefined;
}): Promise<{
  readonly bucketName: string | null;
  readonly storageKey: string | null;
  readonly storageBundlePrefix: string | null;
  readonly storageManifestKey: string | null;
  readonly markdownBodyForRecord: string;
}> {
  const { reportStorage } = input;
  if (reportStorage.bucketName === null || reportStorage.s3Client === undefined) {
    return {
      bucketName: null,
      storageKey: null,
      storageBundlePrefix: null,
      storageManifestKey: null,
      markdownBodyForRecord: input.markdownBody,
    };
  }
  const folderPrefix: string = buildAnalysisReportBundleFolderPrefix({
    type: input.type,
    reportTimestampIso: input.reportTimestampIso,
    parameters: input.parameters,
  });
  if (input.type === 'technical-analysis' && input.technicalPayload !== undefined && input.technicalChartContext !== undefined) {
    const markdownForBundle: string = appendUnreferencedTechnicalAnalysisChartAppendix(input.markdownBody);
    const bundle = await uploadTechnicalAnalysisReportBundle({
      bucketName: reportStorage.bucketName,
      s3Client: reportStorage.s3Client,
      folderPrefix,
      markdownBody: markdownForBundle,
      payload: input.technicalPayload,
      chartContext: input.technicalChartContext,
    });
    return {
      bucketName: reportStorage.bucketName,
      storageKey: bundle.bodyKey,
      storageBundlePrefix: bundle.bundlePrefix,
      storageManifestKey: bundle.manifestKey,
      markdownBodyForRecord: markdownForBundle,
    };
  }
  const bundle = await uploadSimpleAnalysisReportBundle({
    bucketName: reportStorage.bucketName,
    s3Client: reportStorage.s3Client,
    folderPrefix,
    markdownBody: input.markdownBody,
  });
  return {
    bucketName: reportStorage.bucketName,
    storageKey: bundle.bodyKey,
    storageBundlePrefix: bundle.bundlePrefix,
    storageManifestKey: bundle.manifestKey,
    markdownBodyForRecord: input.markdownBody,
  };
}
