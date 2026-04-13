import type { SnapshotStateRepository } from './snapshot-state-repository.js';

function isIsoDate(input: { readonly raw: string }): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(input.raw);
}

function minDate(left: string, right: string): string {
  return left.localeCompare(right) <= 0 ? left : right;
}

export class SnapshotInvalidationService {
  private readonly snapshotStateRepository: SnapshotStateRepository;

  public constructor(input: { readonly snapshotStateRepository: SnapshotStateRepository }) {
    this.snapshotStateRepository = input.snapshotStateRepository;
  }

  public async notifyLedgerTradeDates(input: {
    readonly userId: string;
    readonly portfolioId: string;
    readonly tradeDates: readonly string[];
    readonly nowIso: string;
  }): Promise<void> {
    const valid: string[] = input.tradeDates.filter((d) => isIsoDate({ raw: d }));
    if (valid.length === 0) {
      return;
    }
    const candidate: string = valid.slice().sort()[0] ?? '';
    await this.mergeEarliestAffected({ ...input, candidateDate: candidate });
  }

  public async notifyPriceDate(input: {
    readonly userId: string;
    readonly portfolioId: string;
    readonly priceDate: string;
    readonly nowIso: string;
  }): Promise<void> {
    if (!isIsoDate({ raw: input.priceDate })) {
      return;
    }
    await this.mergeEarliestAffected({
      userId: input.userId,
      portfolioId: input.portfolioId,
      candidateDate: input.priceDate,
      nowIso: input.nowIso,
    });
  }

  private async mergeEarliestAffected(input: {
    readonly userId: string;
    readonly portfolioId: string;
    readonly candidateDate: string;
    readonly nowIso: string;
  }): Promise<void> {
    const existing = await this.snapshotStateRepository.get({
      userId: input.userId,
      portfolioId: input.portfolioId,
    });
    const nextEarliest: string =
      existing?.earliestAffectedDate === undefined ? input.candidateDate : minDate(existing.earliestAffectedDate, input.candidateDate);
    await this.snapshotStateRepository.put({
      userId: input.userId,
      portfolioId: input.portfolioId,
      earliestAffectedDate: nextEarliest,
      updatedAtIso: input.nowIso,
    });
  }
}
