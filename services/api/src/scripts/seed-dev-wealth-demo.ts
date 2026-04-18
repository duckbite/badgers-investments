import { BatchWriteCommand, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';
import { Decimal } from 'decimal.js';
import { getDynamoDbConfig } from '../config/get-dynamo-db-config.js';
import { createDynamoDbClient } from '../db/create-dynamo-db-client.js';
import { buildUserAccountPartitionKey, getMetaSortKey, normalizeUsername } from '../modules/auth/dynamo-auth-keys.js';
import { AssetRepository } from '../modules/assets/asset-repository.js';
import { buildPortfolioScopedPartitionKey, PORTFOLIO_CONFIG_ACTIVE_SORT_KEY, buildPortfolioConfigVersionSortKeyPrefix } from '../modules/domain/domain-keys.js';
import { FifoHoldingsService } from '../modules/ledger/fifo-holdings-service.js';
import { LotLinkRepository } from '../modules/ledger/lot-link-repository.js';
import { TransactionRepository } from '../modules/ledger/transaction-repository.js';
import { PortfolioRepository } from '../modules/portfolio/portfolio-repository.js';
import { PortfolioService } from '../modules/portfolio/portfolio-service.js';
import { PerformanceSnapshotRepository } from '../modules/snapshots/performance-snapshot-repository.js';
import { PortfolioSnapshotRepository } from '../modules/snapshots/portfolio-snapshot-repository.js';
import { PositionSnapshotRepository } from '../modules/snapshots/position-snapshot-repository.js';
import { SnapshotRebuildService } from '../modules/snapshots/snapshot-rebuild-service.js';
import { SnapshotStateRepository } from '../modules/snapshots/snapshot-state-repository.js';
import { PriceSnapshotRepository } from '../modules/valuations/price-snapshot-repository.js';

const PARTITION_KEY: string = 'PK';
const SORT_KEY: string = 'SK';

type AssetDef = {
  readonly symbol: string;
  readonly name: string;
  readonly assetType: 'STOCK' | 'ETF';
  readonly sector: string;
  readonly basePrice: number;
};

type AssetRow = AssetDef & { readonly assetId: string };

type PlannedRow = {
  kind: 'BUY' | 'SELL' | 'DIVIDEND';
  assetId: string;
  tradeDate: string;
  tradeTimestampIso: string;
  quantity?: string;
  unitPrice?: string;
  grossAmount?: string;
  notes?: string;
  _seq: number;
};

type PlannedTxn = Omit<PlannedRow, '_seq'>;

const ASSET_DEFS: readonly AssetDef[] = [
  { symbol: 'AAPL', name: 'Apple Inc.', assetType: 'STOCK', sector: 'Technology', basePrice: 175 },
  { symbol: 'MSFT', name: 'Microsoft Corp.', assetType: 'STOCK', sector: 'Technology', basePrice: 395 },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', assetType: 'STOCK', sector: 'Technology', basePrice: 92 },
  { symbol: 'XOM', name: 'Exxon Mobil Corp.', assetType: 'STOCK', sector: 'Energy', basePrice: 118 },
  { symbol: 'JNJ', name: 'Johnson & Johnson', assetType: 'STOCK', sector: 'Healthcare', basePrice: 152 },
  { symbol: 'UNH', name: 'UnitedHealth Group', assetType: 'STOCK', sector: 'Healthcare', basePrice: 505 },
  { symbol: 'IBB', name: 'iShares Biotechnology ETF', assetType: 'ETF', sector: 'Biotech', basePrice: 138 },
  { symbol: 'VNQ', name: 'Vanguard Real Estate ETF', assetType: 'ETF', sector: 'Real Estate', basePrice: 89 },
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust', assetType: 'ETF', sector: 'Indices', basePrice: 520 },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust', assetType: 'ETF', sector: 'Indices', basePrice: 445 },
];

function seedMulberry32(seed: number): () => number {
  return (): number => {
    let t: number = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function addUtcDaysYmd(input: { readonly ymd: string; readonly deltaDays: number }): string {
  const d: Date = new Date(`${input.ymd}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + input.deltaDays);
  return d.toISOString().slice(0, 10);
}

function kindOrder(row: PlannedRow): number {
  if (row.kind === 'BUY') {
    return 0;
  }
  if (row.kind === 'SELL') {
    return 1;
  }
  return 2;
}

function buildDemoTransactions(input: { readonly assets: readonly AssetRow[]; readonly rng: () => number }): PlannedTxn[] {
  const planned: PlannedRow[] = [];
  let seq: number = 0;
  const startYmd: string = '2024-04-22';
  const endBuyPhase: string = '2025-10-01';
  for (const asset of input.assets) {
    let cursor: string = addUtcDaysYmd({ ymd: startYmd, deltaDays: Math.floor(input.rng() * 40) });
    for (let i = 0; i < 6; i += 1) {
      if (cursor > endBuyPhase) {
        break;
      }
      const qty: string = new Decimal(3 + input.rng() * 45).toDecimalPlaces(3, Decimal.ROUND_DOWN).toFixed();
      const px: string = new Decimal(asset.basePrice)
        .mul(new Decimal(0.88 + input.rng() * 0.28))
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        .toFixed();
      planned.push({
        kind: 'BUY',
        assetId: asset.assetId,
        tradeDate: cursor,
        tradeTimestampIso: `${cursor}T12:00:00.000Z`,
        quantity: qty,
        unitPrice: px,
        _seq: seq,
      } satisfies PlannedRow);
      seq += 1;
      cursor = addUtcDaysYmd({ ymd: cursor, deltaDays: 25 + Math.floor(input.rng() * 95) });
    }
  }
  const held: Map<string, Decimal> = new Map();
  for (const row of planned) {
    if (row.kind !== 'BUY' || row.quantity === undefined) {
      continue;
    }
    const q: Decimal = new Decimal(row.quantity);
    held.set(row.assetId, (held.get(row.assetId) ?? new Decimal(0)).plus(q));
  }
  for (const asset of input.assets) {
    const total: Decimal | undefined = held.get(asset.assetId);
    if (total === undefined || total.lte(0)) {
      continue;
    }
    const sellCount: number = input.rng() > 0.35 ? 2 : 1;
    let cursor: string = '2025-06-10';
    for (let s = 0; s < sellCount; s += 1) {
      cursor = addUtcDaysYmd({ ymd: cursor, deltaDays: 20 + Math.floor(input.rng() * 120) });
      if (cursor > '2026-04-05') {
        break;
      }
      const current: Decimal = held.get(asset.assetId) ?? new Decimal(0);
      if (current.lte(0)) {
        break;
      }
      const maxSell: Decimal = current.mul(0.42).toDecimalPlaces(3, Decimal.ROUND_DOWN);
      const qtySell: Decimal = Decimal.min(maxSell, current.mul(0.28).plus(new Decimal(input.rng()).mul(12)));
      if (qtySell.lte(0)) {
        break;
      }
      const px: string = new Decimal(asset.basePrice)
        .mul(new Decimal(0.95 + input.rng() * 0.35))
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        .toFixed();
      planned.push({
        kind: 'SELL',
        assetId: asset.assetId,
        tradeDate: cursor,
        tradeTimestampIso: `${cursor}T12:00:00.000Z`,
        quantity: qtySell.toFixed(3),
        unitPrice: px,
        _seq: seq,
      } satisfies PlannedRow);
      seq += 1;
      held.set(asset.assetId, current.minus(qtySell));
    }
  }
  for (const asset of input.assets) {
    let divDate: string = '2024-07-15';
    while (divDate < '2026-04-01') {
      const gross: string = new Decimal(0.35 + input.rng() * 2.2)
        .mul(asset.basePrice / 120)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        .toFixed();
      planned.push({
        kind: 'DIVIDEND',
        assetId: asset.assetId,
        tradeDate: divDate,
        tradeTimestampIso: `${divDate}T12:00:00.000Z`,
        grossAmount: gross,
        notes: `Synthetic quarterly dividend (${asset.symbol})`,
        _seq: seq,
      } satisfies PlannedRow);
      seq += 1;
      divDate = addUtcDaysYmd({ ymd: divDate, deltaDays: 85 + Math.floor(input.rng() * 20) });
    }
  }
  planned.sort((left: PlannedRow, right: PlannedRow): number => {
    const dateCompare: number = left.tradeDate.localeCompare(right.tradeDate);
    if (dateCompare !== 0) {
      return dateCompare;
    }
    const kindCompare: number = kindOrder(left) - kindOrder(right);
    if (kindCompare !== 0) {
      return kindCompare;
    }
    return left._seq - right._seq;
  });
  let tickDay: string = '';
  let tick: number = 0;
  for (const row of planned) {
    if (row.tradeDate !== tickDay) {
      tickDay = row.tradeDate;
      tick = 0;
    }
    const hour: number = 10 + Math.floor(tick / 60);
    const minute: number = tick % 60;
    row.tradeTimestampIso = `${row.tradeDate}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`;
    tick += 1;
  }
  return planned.map((row: PlannedRow): PlannedTxn => {
    const { _seq, ...rest } = row;
    void _seq;
    return rest;
  });
}

async function deletePortfolioScopedItems(input: {
  readonly documentClient: DynamoDBDocumentClient;
  readonly tableName: string;
  readonly portfolioPk: string;
}): Promise<number> {
  let deleted: number = 0;
  let exclusiveStartKey: Record<string, unknown> | undefined;
  const preservePrefix: (sk: string) => boolean = (sk: string): boolean =>
    sk.startsWith(PORTFOLIO_CONFIG_ACTIVE_SORT_KEY) || sk.startsWith(buildPortfolioConfigVersionSortKeyPrefix());
  do {
    const response = await input.documentClient.send(
      new QueryCommand({
        TableName: input.tableName,
        KeyConditionExpression: '#pk = :pk',
        ExpressionAttributeNames: { '#pk': PARTITION_KEY },
        ExpressionAttributeValues: { ':pk': input.portfolioPk },
        ExclusiveStartKey: exclusiveStartKey,
      }),
    );
    const batch: Array<{ readonly PK: string; readonly SK: string }> = [];
    for (const item of response.Items ?? []) {
      const pk: unknown = item[PARTITION_KEY];
      const sk: unknown = item[SORT_KEY];
      if (typeof pk !== 'string' || typeof sk !== 'string') {
        continue;
      }
      if (preservePrefix(sk)) {
        continue;
      }
      batch.push({ PK: pk, SK: sk });
    }
    for (let i: number = 0; i < batch.length; i += 25) {
      const slice: typeof batch = batch.slice(i, i + 25);
      if (slice.length === 0) {
        continue;
      }
      await input.documentClient.send(
        new BatchWriteCommand({
          RequestItems: {
            [input.tableName]: slice.map((key) => ({
              DeleteRequest: { Key: { [PARTITION_KEY]: key.PK, [SORT_KEY]: key.SK } },
            })),
          },
        }),
      );
      deleted += slice.length;
    }
    exclusiveStartKey = response.LastEvaluatedKey;
  } while (exclusiveStartKey !== undefined);
  return deleted;
}

async function resolveUserId(input: {
  readonly documentClient: DynamoDBDocumentClient;
  readonly tableName: string;
  readonly usernameRaw: string;
}): Promise<string> {
  const usernameNormalized: string = normalizeUsername({ rawUsername: input.usernameRaw });
  const response = await input.documentClient.send(
    new GetCommand({
      TableName: input.tableName,
      Key: {
        [PARTITION_KEY]: buildUserAccountPartitionKey({ usernameNormalized }),
        [SORT_KEY]: getMetaSortKey(),
      },
      ConsistentRead: true,
    }),
  );
  const userId: unknown = response.Item?.['userId'];
  if (typeof userId !== 'string' || userId.length === 0) {
    throw new Error(`No user_account found for BOOTSTRAP_USERNAME="${input.usernameRaw}". Run pnpm bootstrap:user first.`);
  }
  return userId;
}

async function seedWeeklyPrices(input: {
  readonly priceSnapshotRepository: PriceSnapshotRepository;
  readonly userId: string;
  readonly portfolioId: string;
  readonly assets: readonly AssetRow[];
  readonly rng: () => number;
  readonly fromYmd: string;
  readonly throughYmd: string;
  readonly nowIso: string;
}): Promise<number> {
  let count: number = 0;
  for (const asset of input.assets) {
    let cursor: string = input.fromYmd;
    let level: Decimal = new Decimal(asset.basePrice).mul(0.92);
    while (cursor <= input.throughYmd) {
      const drift: Decimal = new Decimal(input.rng() * 0.024 - 0.011);
      level = Decimal.max(new Decimal(3), level.mul(new Decimal(1).plus(drift)));
      const price: string = level.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed();
      const ts: string = `${cursor}T21:00:00.000Z`;
      await input.priceSnapshotRepository.create({
        userId: input.userId,
        portfolioId: input.portfolioId,
        priceSnapshotId: randomUUID(),
        assetId: asset.assetId,
        price,
        currencyCode: 'USD',
        priceTimestampIso: ts,
        priceDate: cursor,
        providerKey: 'SEED_DEV_WEALTH',
        dataQuality: undefined,
        rawPayloadHash: undefined,
        createdAtIso: input.nowIso,
      });
      count += 1;
      cursor = addUtcDaysYmd({ ymd: cursor, deltaDays: 7 });
    }
  }
  return count;
}

async function main(): Promise<void> {
  const usernameRaw: string | undefined = process.env['BOOTSTRAP_USERNAME']?.trim();
  if (usernameRaw === undefined || usernameRaw.length === 0) {
    throw new Error('Set BOOTSTRAP_USERNAME to the dev account username (same as pnpm bootstrap:user).');
  }
  const dynamoDbConfig = getDynamoDbConfig();
  const dynamoDbClient = createDynamoDbClient(dynamoDbConfig);
  const documentClient = DynamoDBDocumentClient.from(dynamoDbClient, {
    marshallOptions: { removeUndefinedValues: true },
  });
  const tableName: string = dynamoDbConfig.tableName;
  const userId: string = await resolveUserId({ documentClient, tableName, usernameRaw });
  const portfolioRepository = new PortfolioRepository({ documentClient, tableName });
  const portfolioService = new PortfolioService({ portfolioRepository });
  const now: Date = new Date();
  const nowIso: string = now.toISOString();
  const portfolioDto = await portfolioService.getOrCreateForUser({ userId, now });
  const portfolioId: string = portfolioDto.portfolioId;
  const portfolioPk: string = buildPortfolioScopedPartitionKey({ userId, portfolioId });
  console.log(`Seeding demo wealth for userId=${userId} portfolioId=${portfolioId} (table=${tableName})…`);
  const removed: number = await deletePortfolioScopedItems({ documentClient, tableName, portfolioPk });
  console.log(`Removed ${removed} existing portfolio-scoped items (kept PORTFOLIO_CFG*).`);
  const assetRepository = new AssetRepository({ documentClient, tableName });
  const assets: AssetRow[] = ASSET_DEFS.map((def: AssetDef) => ({ ...def, assetId: randomUUID() }));
  for (const asset of assets) {
    await assetRepository.create({
      userId,
      portfolioId,
      assetId: asset.assetId,
      assetType: asset.assetType,
      name: asset.name,
      symbol: asset.symbol,
      currencyCode: 'USD',
      ownershipPct: '1',
      notes: 'Seeded by seed-dev-wealth-demo.ts',
      isin: undefined,
      exchangeCode: 'SEED',
      sector: asset.sector,
      primaryPriceProviderKey: undefined,
      createdAtIso: nowIso,
    });
  }
  console.log(`Created ${assets.length} assets.`);
  const rng: () => number = seedMulberry32(20260413);
  const planned: PlannedTxn[] = buildDemoTransactions({ assets, rng });
  const transactionRepository = new TransactionRepository({ documentClient, tableName });
  for (const row of planned) {
    const transactionId: string = randomUUID();
    if (row.kind === 'DIVIDEND') {
      await transactionRepository.create({
        userId,
        portfolioId,
        transactionId,
        assetId: row.assetId,
        transactionType: 'DIVIDEND',
        tradeDate: row.tradeDate,
        tradeTimestampIso: row.tradeTimestampIso,
        quantity: undefined,
        unitPrice: undefined,
        grossAmount: row.grossAmount,
        feeAmount: undefined,
        currencyCode: 'USD',
        notes: row.notes,
        adjustmentSide: undefined,
        createdAtIso: nowIso,
        createdByUserId: userId,
      });
    } else {
      await transactionRepository.create({
        userId,
        portfolioId,
        transactionId,
        assetId: row.assetId,
        transactionType: row.kind,
        tradeDate: row.tradeDate,
        tradeTimestampIso: row.tradeTimestampIso,
        quantity: row.quantity,
        unitPrice: row.unitPrice,
        grossAmount: undefined,
        feeAmount: undefined,
        currencyCode: 'USD',
        notes: undefined,
        adjustmentSide: undefined,
        createdAtIso: nowIso,
        createdByUserId: userId,
      });
    }
  }
  console.log(`Inserted ${planned.length} transactions (BUY/SELL/DIVIDEND).`);
  const fifoHoldingsService = new FifoHoldingsService();
  const lotLinkRepository = new LotLinkRepository({ documentClient, tableName });
  const rows = await transactionRepository.listByPortfolio({ userId, portfolioId });
  const fifo = fifoHoldingsService.compute({ transactions: rows, nowIso });
  await lotLinkRepository.replaceAll({ userId, portfolioId, links: fifo.lotLinks });
  console.log(`Recomputed FIFO lot links (${fifo.lotLinks.length} links).`);
  const priceSnapshotRepository = new PriceSnapshotRepository({ documentClient, tableName });
  const priceCount: number = await seedWeeklyPrices({
    priceSnapshotRepository,
    userId,
    portfolioId,
    assets,
    rng: seedMulberry32(991337),
    fromYmd: '2024-04-01',
    throughYmd: now.toISOString().slice(0, 10),
    nowIso,
  });
  console.log(`Inserted ${priceCount} weekly price snapshots.`);
  const snapshotStateRepository = new SnapshotStateRepository({ documentClient, tableName });
  const positionSnapshotRepository = new PositionSnapshotRepository({ documentClient, tableName });
  const portfolioSnapshotRepository = new PortfolioSnapshotRepository({ documentClient, tableName });
  const performanceSnapshotRepository = new PerformanceSnapshotRepository({ documentClient, tableName });
  const snapshotRebuildService = new SnapshotRebuildService({
    documentClient,
    tableName,
    transactionRepository,
    fifoHoldingsService,
    priceSnapshotRepository,
    assetRepository,
    portfolioRepository,
    snapshotStateRepository,
    positionSnapshotRepository,
    portfolioSnapshotRepository,
    performanceSnapshotRepository,
    portfolioService,
  });
  const rebuild = await snapshotRebuildService.rebuild({ userId, now, throughDate: undefined });
  console.log(
    `Snapshot rebuild complete: ${rebuild.daysProcessed} day(s) from ${rebuild.fromDate} through ${rebuild.throughDate} (earliestCleared=${rebuild.earliestAffectedCleared}).`,
  );
  console.log('Done. Log in as', usernameRaw, 'and open Dashboard / Holdings / Performance.');
}

main().catch((err: unknown) => {
  const error: Error = err instanceof Error ? err : new Error('Unknown error');
  console.error(error);
  process.exit(1);
});
