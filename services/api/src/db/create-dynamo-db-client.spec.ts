import { describe, expect, it } from 'vitest';
import { createDynamoDbClient } from './create-dynamo-db-client.js';

describe('createDynamoDbClient', () => {
  it('creates a client with region and optional endpoint', () => {
    const withoutEndpoint = createDynamoDbClient({
      tableName: 't',
      region: 'eu-west-1',
      endpoint: undefined,
    });
    expect(withoutEndpoint).toBeDefined();
    const withEndpoint = createDynamoDbClient({
      tableName: 't',
      region: 'eu-west-1',
      endpoint: 'http://localhost:4566',
    });
    expect(withEndpoint).toBeDefined();
  });
});
