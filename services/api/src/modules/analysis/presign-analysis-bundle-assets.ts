import { GetObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { AnalysisBundleManifestV1 } from './technical-analysis-bundle.js';

const PRESIGN_EXPIRES_SECONDS: number = 900;

/**
 * Short-lived GET URLs for bundle body and manifest assets (session-scoped client use).
 */
export async function presignBundleAssetUrls(input: {
  readonly s3Client: S3Client;
  readonly bucketName: string;
  readonly bundlePrefix: string;
  readonly manifest: AnalysisBundleManifestV1;
}): Promise<Record<string, string>> {
  const urls: Record<string, string> = {};
  const prefix: string = input.bundlePrefix.endsWith('/') ? input.bundlePrefix : `${input.bundlePrefix}/`;
  const signKey = async (relativePath: string): Promise<void> => {
    const key: string = `${prefix}${relativePath.replace(/^\//, '')}`;
    const command: GetObjectCommand = new GetObjectCommand({ Bucket: input.bucketName, Key: key });
    // Presigner and S3 client can reference different @smithy/types patch versions in the monorepo; runtime is compatible.
    urls[relativePath] = await (
      getSignedUrl as (client: unknown, command: unknown, opts: { expiresIn: number }) => Promise<string>
    )(input.s3Client, command, { expiresIn: PRESIGN_EXPIRES_SECONDS });
  };
  await signKey(input.manifest.body.path);
  for (const asset of input.manifest.assets) {
    await signKey(asset.path);
  }
  return urls;
}
