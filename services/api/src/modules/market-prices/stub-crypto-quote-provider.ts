import { PRICE_PROVIDER_KEY_CRYPTO_AGGREGATE } from './price-provider-keys.js';

/**
 * Reserved provider slot for non-equity assets; returns no quotes until a real integration exists.
 */
export class StubCryptoQuoteProvider {
  public readonly providerKey: string = PRICE_PROVIDER_KEY_CRYPTO_AGGREGATE;

  public async fetchQuotesForSymbols(): Promise<readonly never[]> {
    return [];
  }
}
