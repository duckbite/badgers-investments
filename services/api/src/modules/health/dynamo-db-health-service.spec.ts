import { DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { describe, expect, it, vi } from 'vitest';
import type { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDbHealthService } from './dynamo-db-health-service.js';

describe('DynamoDbHealthService', () => {
  it('calls DescribeTable for the configured table', async () => {
    const sendMock = vi.fn().mockResolvedValue({ Table: { TableName: 't' } });
    const dynamoDbClient = { send: sendMock } as unknown as DynamoDBClient;
    const service = new DynamoDbHealthService({ dynamoDbClient, tableName: 'my-table' });
    await service.verifyTableAccessible();
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0]?.[0]).toBeInstanceOf(DescribeTableCommand);
  });
});
