import type { PrismaClient } from '@prisma/client';

type DatabaseConnectionMetadata = {
  readonly now: Date;
  readonly serverVersion: string;
  readonly currentDatabase: string;
  readonly currentUser: string;
};

/**
 * Provides database health and connectivity diagnostics.
 */
export class DbHealthService {
  private readonly prismaClient: PrismaClient;

  public constructor(input: { readonly prismaClient: PrismaClient }) {
    this.prismaClient = input.prismaClient;
  }

  public async getDatabaseConnectionMetadata(): Promise<DatabaseConnectionMetadata> {
    const result: Array<{
      now: Date;
      server_version: string;
      current_database: string;
      current_user: string;
    }> = await this.prismaClient.$queryRaw`
      SELECT
        now() as now,
        version() as server_version,
        current_database() as current_database,
        current_user as current_user
    `;
    const firstRow: (typeof result)[number] | undefined = result[0];
    if (firstRow === undefined) {
      throw new Error('Database metadata query returned no rows');
    }
    return {
      now: firstRow.now,
      serverVersion: firstRow.server_version,
      currentDatabase: firstRow.current_database,
      currentUser: firstRow.current_user,
    };
  }
}

