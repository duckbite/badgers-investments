import Fastify from 'fastify';
import { PrismaClient } from '@prisma/client';

const app = Fastify({ logger: true });
const prisma = new PrismaClient();

app.get('/health', async () => ({ status: 'ok' }));

app.get('/health/db', async (req, reply) => {
  try {
    const [meta] = await prisma.$queryRaw<
      Array<{
        now: Date;
        server_version: string;
        current_database: string;
        current_user: string;
      }>
    >`
      SELECT
        now() as now,
        version() as server_version,
        current_database() as current_database,
        current_user as current_user
    `;

    return {
      status: 'ok',
      db: {
        now: meta?.now?.toISOString?.() ?? null,
        currentDatabase: meta?.current_database ?? null,
        currentUser: meta?.current_user ?? null,
        serverVersion: meta?.server_version ?? null,
      },
    };
  } catch (err) {
    req.log.error({ err }, 'db health check failed');
    return reply.code(500).send({ status: 'error' });
  }
});

const start = async () => {
  try {
    const port = Number(process.env['API_PORT']) || 3000;
    await app.listen({ port, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
