export type AnalysisReportStorageConfig = {
  readonly bucketName: string | null;
  readonly awsRegion: string;
};

export function getAnalysisReportStorageConfig(): AnalysisReportStorageConfig {
  const bucketRaw: string = process.env['API_REPORTS_BUCKET_NAME'] ?? '';
  const bucketName: string | null = bucketRaw.trim().length > 0 ? bucketRaw.trim() : null;
  const awsRegion: string = process.env['API_AWS_REGION'] ?? process.env['AWS_REGION'] ?? 'eu-central-1';
  return { bucketName, awsRegion };
}
