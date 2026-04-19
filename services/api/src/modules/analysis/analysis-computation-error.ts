export const COMPUTATION_ERROR_CODE: string = 'COMPUTATION_ERROR';

export class AnalysisComputationError extends Error {
  public readonly code: typeof COMPUTATION_ERROR_CODE;

  public constructor(message: string) {
    super(message);
    this.name = 'AnalysisComputationError';
    this.code = COMPUTATION_ERROR_CODE;
  }
}
