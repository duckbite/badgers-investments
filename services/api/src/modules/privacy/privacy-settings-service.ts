import { getPrivacyPinPepper } from '../../config/get-privacy-pepper.js';
import { hashPassword, verifyPassword } from '../auth/password-hash-service.js';
import type { UserPrivacySettingsRepository } from './user-privacy-settings-repository.js';

export type PrivacySettingsPublicDto = {
  readonly hasAmountRevealPin: boolean;
};

export class PrivacySettingsServiceError extends Error {
  public readonly code: string;

  public constructor(input: { readonly code: string; readonly message: string }) {
    super(input.message);
    this.code = input.code;
  }
}

export class PrivacySettingsService {
  private readonly userPrivacySettingsRepository: UserPrivacySettingsRepository;

  public constructor(input: { readonly userPrivacySettingsRepository: UserPrivacySettingsRepository }) {
    this.userPrivacySettingsRepository = input.userPrivacySettingsRepository;
  }

  public async getForUser(input: { readonly userId: string }): Promise<PrivacySettingsPublicDto> {
    const record = await this.userPrivacySettingsRepository.getByUserId({ userId: input.userId });
    return {
      hasAmountRevealPin: record !== undefined && record.amountRevealPinHash.length > 0,
    };
  }

  public async setAmountRevealPin(input: { readonly userId: string; readonly pin: string; readonly now: Date }): Promise<void> {
    const pepper: string | undefined = getPrivacyPinPepper();
    if (pepper === undefined) {
      throw new PrivacySettingsServiceError({
        code: 'PRIVACY_SECRET_UNAVAILABLE',
        message: 'Server is not configured to store a reveal PIN (set API_PRIVACY_SECRET or API_AI_SETTINGS_SECRET).',
      });
    }
    const normalized: string = input.pin.trim();
    if (normalized.length < 4 || normalized.length > 64) {
      throw new PrivacySettingsServiceError({
        code: 'PRIVACY_PIN_INVALID',
        message: 'PIN must be between 4 and 64 characters.',
      });
    }
    const amountRevealPinHash: string = hashPassword(`${pepper}:${normalized}`);
    await this.userPrivacySettingsRepository.put({
      record: {
        userId: input.userId,
        amountRevealPinHash,
        updatedAtIso: input.now.toISOString(),
      },
    });
  }

  public async verifyAmountRevealPin(input: { readonly userId: string; readonly pin: string }): Promise<boolean> {
    const pepper: string | undefined = getPrivacyPinPepper();
    if (pepper === undefined) {
      return false;
    }
    const record = await this.userPrivacySettingsRepository.getByUserId({ userId: input.userId });
    if (record === undefined) {
      return false;
    }
    const normalized: string = input.pin.trim();
    return verifyPassword({
      plaintextPassword: `${pepper}:${normalized}`,
      storedHash: record.amountRevealPinHash,
    });
  }
}
