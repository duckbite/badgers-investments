import awsLambdaFastify from '@fastify/aws-lambda';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2, Context } from 'aws-lambda';
import { createServer } from './server/create-server.js';

type LambdaProxy = (event: APIGatewayProxyEventV2, context: Context) => Promise<APIGatewayProxyResultV2>;

let proxy: LambdaProxy | undefined;

async function getProxy(): Promise<LambdaProxy> {
  if (proxy === undefined) {
    const app = await createServer();
    // @fastify/aws-lambda must run before app.ready() (decorators cannot be added after start).
    proxy = awsLambdaFastify(app) as LambdaProxy;
    await app.ready();
  }
  return proxy;
}

export async function handler(
  event: APIGatewayProxyEventV2,
  context: Context,
): Promise<APIGatewayProxyResultV2> {
  const delegated: LambdaProxy = await getProxy();
  return delegated(event, context);
}
