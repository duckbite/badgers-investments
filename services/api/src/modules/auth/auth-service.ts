import { randomUUID } from 'crypto';
import type { AuthConfig } from '../../config/get-auth-config.js';
import { verifyPassword } from './password-hash-service.js';
import type { UserAccountRepository } from './user-account-repository.js';
import type { UserSessionRepository } from './user-session-repository.js';

export type AuthenticatedUser = {
  readonly userId: string;
  readonly username: string;
};

export class AuthService {
  private readonly userAccountRepository: UserAccountRepository;
  private readonly userSessionRepository: UserSessionRepository;
  private readonly authConfig: AuthConfig;

  public constructor(input: {
    readonly userAccountRepository: UserAccountRepository;
    readonly userSessionRepository: UserSessionRepository;
    readonly authConfig: AuthConfig;
  }) {
    this.userAccountRepository = input.userAccountRepository;
    this.userSessionRepository = input.userSessionRepository;
    this.authConfig = input.authConfig;
  }

  public async login(input: {
    readonly username: string;
    readonly password: string;
    readonly now: Date;
    readonly ipAddress: string | undefined;
    readonly userAgent: string | undefined;
  }): Promise<
    | { readonly outcome: 'ok'; readonly sessionId: string; readonly user: AuthenticatedUser }
    | { readonly outcome: 'invalid_credentials' }
  > {
    const account = await this.userAccountRepository.findByUsername({ username: input.username });
    if (account === undefined || !account.isActive) {
      return { outcome: 'invalid_credentials' };
    }
    const passwordOk: boolean = verifyPassword({
      plaintextPassword: input.password,
      storedHash: account.passwordHash,
    });
    if (!passwordOk) {
      return { outcome: 'invalid_credentials' };
    }
    const sessionId: string = randomUUID();
    const createdAtIso: string = input.now.toISOString();
    const expiresAt: Date = new Date(input.now.getTime() + this.authConfig.sessionTtlSeconds * 1000);
    const expiresAtIso: string = expiresAt.toISOString();
    await this.userSessionRepository.createSession({
      sessionId,
      userId: account.userId,
      username: account.username,
      createdAtIso,
      expiresAtIso,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
    try {
      await this.userAccountRepository.touchLastLoginAt({ username: input.username, atIso: createdAtIso });
    } catch {
      // Last-login is best-effort; session is already established.
    }
    return { outcome: 'ok', sessionId, user: { userId: account.userId, username: account.username } };
  }

  public async logout(input: { readonly sessionId: string | undefined }): Promise<void> {
    if (input.sessionId === undefined || input.sessionId.length === 0) {
      return;
    }
    await this.userSessionRepository.deleteSession({ sessionId: input.sessionId });
  }

  public async getSession(input: { readonly sessionId: string | undefined; readonly now: Date }): Promise<AuthenticatedUser | undefined> {
    if (input.sessionId === undefined || input.sessionId.length === 0) {
      return undefined;
    }
    const record = await this.userSessionRepository.findValidSession({ sessionId: input.sessionId, now: input.now });
    if (record === undefined) {
      return undefined;
    }
    return { userId: record.userId, username: record.username };
  }
}
