import { PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import type { TechnicalAnalysisComputationPayload } from './compute-technical-analysis-payload.js';
import { buildTechnicalAnalysisChartAssetSvgs } from './build-technical-analysis-chart-svgs.js';
import type { TechnicalAnalysisBundleChartContext } from './bundle-chart-context.js';

export type AnalysisBundleManifestV1 = {
  readonly version: 1;
  readonly body: { readonly path: string; readonly contentType: string };
  readonly assets: readonly { readonly id: string; readonly path: string; readonly mime: string; readonly role: 'series' | 'chart' }[];
};

export type TechnicalAnalysisBundleUploadResult = {
  readonly bundlePrefix: string;
  readonly manifestKey: string;
  readonly bodyKey: string;
};

function manifestAsset(
  id: string,
  path: string,
  mime: string,
  role: 'series' | 'chart',
): { readonly id: string; readonly path: string; readonly mime: string; readonly role: 'series' | 'chart' } {
  return { id, path, mime, role };
}

/**
 * Upload TA report folder: `{type}-{isoUtc}-{subject}/report.md`, `manifest.json`, `assets/*`.
 */
export async function uploadTechnicalAnalysisReportBundle(input: {
  readonly bucketName: string;
  readonly s3Client: S3Client;
  readonly folderPrefix: string;
  readonly markdownBody: string;
  readonly payload: TechnicalAnalysisComputationPayload;
  readonly chartContext: TechnicalAnalysisBundleChartContext;
}): Promise<TechnicalAnalysisBundleUploadResult> {
  const prefix: string = input.folderPrefix.endsWith('/') ? input.folderPrefix : `${input.folderPrefix}/`;
  const bodyKey: string = `${prefix}report.md`;
  const manifestKey: string = `${prefix}manifest.json`;
  const lastClose: number = input.chartContext.closes[input.chartContext.closes.length - 1] ?? Number.NaN;
  const chartSvgs: Record<string, string> = buildTechnicalAnalysisChartAssetSvgs({
    chartContext: input.chartContext,
    fib: input.payload.levels.fib,
    lastClose,
  });
  const payloadKey: string = `${prefix}assets/payload.json`;
  const assets: ReturnType<typeof manifestAsset>[] = [
    manifestAsset('computation-payload', 'assets/payload.json', 'application/json', 'series'),
  ];
  for (const relativePath of Object.keys(chartSvgs)) {
    const fileName: string = relativePath.replace(/^assets\//, '');
    const id: string = fileName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9]+/g, '-');
    assets.push(manifestAsset(id, relativePath, 'image/svg+xml', 'chart'));
  }
  const manifest: AnalysisBundleManifestV1 = {
    version: 1,
    body: { path: 'report.md', contentType: 'text/markdown; charset=utf-8' },
    assets,
  };
  const put = async (key: string, body: string | Uint8Array, contentType: string): Promise<void> => {
    await input.s3Client.send(
      new PutObjectCommand({
        Bucket: input.bucketName,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  };
  await put(bodyKey, input.markdownBody, 'text/markdown; charset=utf-8');
  await put(manifestKey, JSON.stringify(manifest, null, 2), 'application/json');
  await put(payloadKey, JSON.stringify(input.payload, null, 2), 'application/json');
  for (const [relativePath, svg] of Object.entries(chartSvgs)) {
    await put(`${prefix}${relativePath}`, svg, 'image/svg+xml');
  }
  return {
    bundlePrefix: prefix,
    manifestKey,
    bodyKey,
  };
}

/**
 * Minimal bundle for non–technical-analysis reports: same folder layout, markdown body only.
 */
export async function uploadSimpleAnalysisReportBundle(input: {
  readonly bucketName: string;
  readonly s3Client: S3Client;
  readonly folderPrefix: string;
  readonly markdownBody: string;
}): Promise<TechnicalAnalysisBundleUploadResult> {
  const prefix: string = input.folderPrefix.endsWith('/') ? input.folderPrefix : `${input.folderPrefix}/`;
  const bodyKey: string = `${prefix}report.md`;
  const manifestKey: string = `${prefix}manifest.json`;
  const manifest: AnalysisBundleManifestV1 = {
    version: 1,
    body: { path: 'report.md', contentType: 'text/markdown; charset=utf-8' },
    assets: [],
  };
  await input.s3Client.send(
    new PutObjectCommand({
      Bucket: input.bucketName,
      Key: bodyKey,
      Body: input.markdownBody,
      ContentType: 'text/markdown; charset=utf-8',
    }),
  );
  await input.s3Client.send(
    new PutObjectCommand({
      Bucket: input.bucketName,
      Key: manifestKey,
      Body: JSON.stringify(manifest, null, 2),
      ContentType: 'application/json',
    }),
  );
  return { bundlePrefix: prefix, manifestKey, bodyKey };
}
