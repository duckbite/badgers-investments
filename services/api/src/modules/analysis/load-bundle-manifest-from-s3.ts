import { GetObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import type { AnalysisBundleManifestV1 } from './technical-analysis-bundle.js';

export async function loadBundleManifestFromS3(input: {
  readonly s3Client: S3Client;
  readonly bucketName: string;
  readonly manifestKey: string;
}): Promise<AnalysisBundleManifestV1> {
  const response = await input.s3Client.send(
    new GetObjectCommand({
      Bucket: input.bucketName,
      Key: input.manifestKey,
    }),
  );
  const body: unknown = response.Body;
  if (body === undefined) {
    throw new Error('Empty manifest body from S3.');
  }
  const stream: { transformToByteArray?: () => Promise<Uint8Array> } = body as {
    transformToByteArray?: () => Promise<Uint8Array>;
  };
  if (stream.transformToByteArray === undefined) {
    throw new Error('S3 body stream not readable.');
  }
  const bytes: Uint8Array = await stream.transformToByteArray();
  const text: string = Buffer.from(bytes).toString('utf-8');
  const parsed: unknown = JSON.parse(text);
  if (typeof parsed !== 'object' || parsed === null || (parsed as { version?: unknown }).version !== 1) {
    throw new Error('Unsupported analysis bundle manifest.');
  }
  return parsed as AnalysisBundleManifestV1;
}
