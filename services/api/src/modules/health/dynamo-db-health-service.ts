import { DescribeTableCommand, type DynamoDBClient } from '@aws-sdk/client-dynamodb';

/**
 * Verifies that the configured DynamoDB table exists and the caller can describe it (IAM + network).
 */
export class DynamoDbHealthService {
  private readonly dynamoDbClient: DynamoDBClient;
  private readonly tableName: string;

  public constructor(input: { readonly dynamoDbClient: DynamoDBClient; readonly tableName: string }) {
    this.dynamoDbClient = input.dynamoDbClient;
    this.tableName = input.tableName;
  }

  public async verifyTableAccessible(): Promise<void> {
    await this.dynamoDbClient.send(new DescribeTableCommand({ TableName: this.tableName }));
  }
}
