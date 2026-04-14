export type RuleSeverity = 'INFO' | 'WARN' | 'HIGH';

export type RuleScope = 'PORTFOLIO' | 'ASSET';

export type RuleFinding = {
  readonly findingId: string;
  readonly rule_code: string;
  readonly severity: RuleSeverity;
  readonly scope: RuleScope;
  readonly asset_id: string | null;
  readonly message: string;
  readonly metrics_json: Readonly<Record<string, unknown>>;
};
