-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('CASH', 'STOCK', 'ETF');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('BUY', 'SELL', 'DEPOSIT', 'WITHDRAWAL', 'FEE', 'ADJUSTMENT', 'DIVIDEND', 'INTEREST');

-- CreateEnum
CREATE TYPE "CashImpactDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "RecommendationScopeType" AS ENUM ('PORTFOLIO', 'ASSET');

-- CreateEnum
CREATE TYPE "RecommendationType" AS ENUM ('BUY', 'SELL', 'HOLD', 'WATCH');

-- CreateEnum
CREATE TYPE "RecommendationRunStatus" AS ENUM ('STARTED', 'COMPLETED', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "FindingSeverity" AS ENUM ('INFO', 'WARN', 'HIGH');

-- CreateTable
CREATE TABLE "user_account" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_otp_challenge" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "email" TEXT NOT NULL,
    "otp_code_hash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "sent_via_provider" TEXT,
    "provider_message_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_otp_challenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_session" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "is_revoked" BOOLEAN NOT NULL DEFAULT false,
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "user_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "base_currency_code" CHAR(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "portfolio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset" (
    "id" UUID NOT NULL,
    "portfolio_id" UUID NOT NULL,
    "asset_type" "AssetType" NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT,
    "isin" TEXT,
    "exchange_code" TEXT,
    "currency_code" CHAR(3) NOT NULL,
    "country_code" CHAR(2),
    "sector" TEXT,
    "is_listed_market_asset" BOOLEAN NOT NULL DEFAULT false,
    "ownership_pct" DECIMAL(5,2) NOT NULL DEFAULT 100.0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "archived_at" TIMESTAMPTZ(6),

    CONSTRAINT "asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_valuation_manual" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "valuation_amount" DECIMAL(20,8) NOT NULL,
    "currency_code" CHAR(3) NOT NULL,
    "valuation_date" DATE NOT NULL,
    "valuation_timestamp" TIMESTAMPTZ(6),
    "source_type" TEXT NOT NULL,
    "source_note" TEXT,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_valuation_manual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_ledger" (
    "id" UUID NOT NULL,
    "portfolio_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "transaction_type" "TransactionType" NOT NULL,
    "trade_date" DATE NOT NULL,
    "trade_timestamp" TIMESTAMPTZ(6),
    "quantity" DECIMAL(28,12),
    "unit_price" DECIMAL(20,8),
    "gross_amount" DECIMAL(20,8),
    "fee_amount" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(20,8),
    "currency_code" CHAR(3) NOT NULL,
    "fx_rate_to_portfolio_base" DECIMAL(20,10),
    "cash_impact_amount" DECIMAL(20,8),
    "cash_impact_direction" "CashImpactDirection",
    "external_reference" TEXT,
    "source_type" TEXT NOT NULL DEFAULT 'MANUAL',
    "notes" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by_user_id" UUID,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "transaction_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_lot_link" (
    "id" UUID NOT NULL,
    "sell_transaction_id" UUID NOT NULL,
    "buy_transaction_id" UUID NOT NULL,
    "matched_quantity" DECIMAL(28,12) NOT NULL,
    "buy_unit_price" DECIMAL(20,8) NOT NULL,
    "sell_unit_price" DECIMAL(20,8) NOT NULL,
    "realised_pnl_amount" DECIMAL(20,8) NOT NULL,
    "currency_code" CHAR(3) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_lot_link_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_data_provider" (
    "id" UUID NOT NULL,
    "provider_key" TEXT NOT NULL,
    "provider_type" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "config_json_encrypted" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "market_data_provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_snapshot" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "provider_id" UUID,
    "price" DECIMAL(20,8) NOT NULL,
    "currency_code" CHAR(3) NOT NULL,
    "price_timestamp" TIMESTAMPTZ(6) NOT NULL,
    "price_date" DATE NOT NULL,
    "data_quality" TEXT,
    "raw_payload_hash" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fx_rate_snapshot" (
    "id" UUID NOT NULL,
    "base_currency_code" CHAR(3) NOT NULL,
    "quote_currency_code" CHAR(3) NOT NULL,
    "rate" DECIMAL(20,10) NOT NULL,
    "rate_timestamp" TIMESTAMPTZ(6) NOT NULL,
    "rate_date" DATE NOT NULL,
    "provider_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fx_rate_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_config_version" (
    "id" UUID NOT NULL,
    "portfolio_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "risk_profile_type" TEXT NOT NULL,
    "risk_score" INTEGER,
    "base_currency_code" CHAR(3) NOT NULL,
    "target_allocations_json" JSONB NOT NULL,
    "concentration_limits_json" JSONB NOT NULL,
    "preferences_json" JSONB,
    "ai_prompt_overrides_json" JSONB,
    "notes" TEXT,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portfolio_config_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_run" (
    "id" UUID NOT NULL,
    "portfolio_id" UUID NOT NULL,
    "config_version_id" UUID NOT NULL,
    "run_trigger_type" TEXT NOT NULL,
    "run_status" "RecommendationRunStatus" NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "completed_at" TIMESTAMPTZ(6),
    "portfolio_valuation_timestamp" TIMESTAMPTZ(6),
    "price_data_freshness_summary" JSONB,
    "analytics_input_hash" TEXT,
    "analytics_summary_json" JSONB,
    "ai_provider_key" TEXT,
    "ai_model_name" TEXT,
    "ai_request_id" TEXT,
    "ai_prompt_version" TEXT,
    "ai_status" TEXT,
    "ai_error_message" TEXT,
    "portfolio_level_summary" TEXT,
    "rule_set_version" TEXT,
    "analytics_schema_version" TEXT,
    "calculation_method_version" TEXT,
    "created_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_item" (
    "id" UUID NOT NULL,
    "recommendation_run_id" UUID NOT NULL,
    "scope_type" "RecommendationScopeType" NOT NULL,
    "asset_id" UUID,
    "recommendation_type" "RecommendationType" NOT NULL,
    "strength_score" DECIMAL(5,2),
    "confidence_score" DECIMAL(5,2),
    "priority_rank" INTEGER,
    "headline" TEXT,
    "rationale" TEXT NOT NULL,
    "assumptions" TEXT,
    "suggested_action_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rule_finding" (
    "id" UUID NOT NULL,
    "recommendation_run_id" UUID NOT NULL,
    "rule_code" TEXT NOT NULL,
    "severity" "FindingSeverity" NOT NULL,
    "scope_type" "RecommendationScopeType" NOT NULL,
    "asset_id" UUID,
    "finding_text" TEXT NOT NULL,
    "metrics_json" JSONB,
    "triggered" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rule_finding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "actor_user_id" UUID,
    "event_timestamp" TIMESTAMPTZ(6) NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "metadata_json" JSONB,
    "before_json" JSONB,
    "after_json" JSONB,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_run_log" (
    "id" UUID NOT NULL,
    "job_type" TEXT NOT NULL,
    "trigger_type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "completed_at" TIMESTAMPTZ(6),
    "summary_json" JSONB,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_run_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "position_snapshot" (
    "id" UUID NOT NULL,
    "portfolio_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "snapshot_timestamp" TIMESTAMPTZ(6) NOT NULL,
    "quantity_held" DECIMAL(28,12),
    "cost_basis_amount" DECIMAL(20,8),
    "market_price" DECIMAL(20,8),
    "market_price_currency_code" CHAR(3),
    "market_value_amount" DECIMAL(20,8),
    "owned_market_value_amount" DECIMAL(20,8),
    "unrealised_pnl_amount" DECIMAL(20,8),
    "realised_pnl_cumulative_amount" DECIMAL(20,8),
    "allocation_pct" DECIMAL(7,4),
    "data_source_summary_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "position_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_snapshot" (
    "id" UUID NOT NULL,
    "portfolio_id" UUID NOT NULL,
    "snapshot_timestamp" TIMESTAMPTZ(6) NOT NULL,
    "total_market_value_amount" DECIMAL(20,8),
    "total_owned_market_value_amount" DECIMAL(20,8),
    "total_unrealised_pnl_amount" DECIMAL(20,8),
    "total_realised_pnl_amount" DECIMAL(20,8),
    "cash_value_amount" DECIMAL(20,8),
    "allocation_by_asset_type_json" JSONB,
    "allocation_by_asset_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portfolio_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_snapshot" (
    "id" UUID NOT NULL,
    "portfolio_id" UUID NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "as_of_timestamp" TIMESTAMPTZ(6) NOT NULL,
    "twr_return" DECIMAL(20,10) NOT NULL,
    "valuation_start_amount" DECIMAL(20,8),
    "valuation_end_amount" DECIMAL(20,8),
    "external_cash_flows_amount" DECIMAL(20,8),
    "calculation_method" TEXT NOT NULL,
    "calculation_version" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "performance_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_account_email_key" ON "user_account"("email");

-- CreateIndex
CREATE INDEX "auth_otp_challenge_email_expires_idx" ON "auth_otp_challenge"("email", "expires_at");

-- CreateIndex
CREATE INDEX "user_session_user_expires_idx" ON "user_session"("user_id", "expires_at");

-- CreateIndex
CREATE INDEX "portfolio_user_active_idx" ON "portfolio"("user_id", "is_active");

-- CreateIndex
CREATE INDEX "asset_portfolio_active_idx" ON "asset"("portfolio_id", "is_active");

-- CreateIndex
CREATE INDEX "asset_portfolio_type_idx" ON "asset"("portfolio_id", "asset_type");

-- CreateIndex
CREATE INDEX "asset_valuation_manual_asset_date_idx" ON "asset_valuation_manual"("asset_id", "valuation_date");

-- CreateIndex
CREATE INDEX "transaction_ledger_portfolio_trade_date_idx" ON "transaction_ledger"("portfolio_id", "trade_date");

-- CreateIndex
CREATE INDEX "transaction_ledger_asset_trade_date_idx" ON "transaction_ledger"("asset_id", "trade_date");

-- CreateIndex
CREATE INDEX "transaction_ledger_portfolio_asset_trade_date_idx" ON "transaction_ledger"("portfolio_id", "asset_id", "trade_date");

-- CreateIndex
CREATE INDEX "transaction_lot_link_sell_idx" ON "transaction_lot_link"("sell_transaction_id");

-- CreateIndex
CREATE INDEX "transaction_lot_link_buy_idx" ON "transaction_lot_link"("buy_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "market_data_provider_provider_key_key" ON "market_data_provider"("provider_key");

-- CreateIndex
CREATE INDEX "price_snapshot_asset_timestamp_idx" ON "price_snapshot"("asset_id", "price_timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "price_snapshot_asset_provider_timestamp_uq" ON "price_snapshot"("asset_id", "provider_id", "price_timestamp");

-- CreateIndex
CREATE INDEX "fx_rate_snapshot_pair_date_idx" ON "fx_rate_snapshot"("base_currency_code", "quote_currency_code", "rate_date");

-- CreateIndex
CREATE UNIQUE INDEX "portfolio_config_version_portfolio_version_uq" ON "portfolio_config_version"("portfolio_id", "version_number");

-- CreateIndex
CREATE INDEX "recommendation_run_portfolio_started_idx" ON "recommendation_run"("portfolio_id", "started_at");

-- CreateIndex
CREATE INDEX "recommendation_item_run_idx" ON "recommendation_item"("recommendation_run_id");

-- CreateIndex
CREATE INDEX "recommendation_item_asset_idx" ON "recommendation_item"("asset_id");

-- CreateIndex
CREATE INDEX "rule_finding_run_idx" ON "rule_finding"("recommendation_run_id");

-- CreateIndex
CREATE INDEX "rule_finding_asset_idx" ON "rule_finding"("asset_id");

-- CreateIndex
CREATE INDEX "audit_log_timestamp_idx" ON "audit_log"("event_timestamp");

-- CreateIndex
CREATE INDEX "audit_log_entity_idx" ON "audit_log"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "job_run_log_job_started_idx" ON "job_run_log"("job_type", "started_at");

-- CreateIndex
CREATE INDEX "position_snapshot_portfolio_ts_idx" ON "position_snapshot"("portfolio_id", "snapshot_timestamp");

-- CreateIndex
CREATE INDEX "position_snapshot_asset_ts_idx" ON "position_snapshot"("asset_id", "snapshot_timestamp");

-- CreateIndex
CREATE INDEX "portfolio_snapshot_portfolio_ts_idx" ON "portfolio_snapshot"("portfolio_id", "snapshot_timestamp");

-- CreateIndex
CREATE INDEX "performance_snapshot_portfolio_asof_idx" ON "performance_snapshot"("portfolio_id", "as_of_timestamp");

-- AddForeignKey
ALTER TABLE "auth_otp_challenge" ADD CONSTRAINT "auth_otp_challenge_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_session" ADD CONSTRAINT "user_session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio" ADD CONSTRAINT "portfolio_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset" ADD CONSTRAINT "asset_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "portfolio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_valuation_manual" ADD CONSTRAINT "asset_valuation_manual_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_valuation_manual" ADD CONSTRAINT "asset_valuation_manual_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_ledger" ADD CONSTRAINT "transaction_ledger_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "portfolio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_ledger" ADD CONSTRAINT "transaction_ledger_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_ledger" ADD CONSTRAINT "transaction_ledger_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_ledger" ADD CONSTRAINT "transaction_ledger_deleted_by_user_id_fkey" FOREIGN KEY ("deleted_by_user_id") REFERENCES "user_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_lot_link" ADD CONSTRAINT "transaction_lot_link_sell_transaction_id_fkey" FOREIGN KEY ("sell_transaction_id") REFERENCES "transaction_ledger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_lot_link" ADD CONSTRAINT "transaction_lot_link_buy_transaction_id_fkey" FOREIGN KEY ("buy_transaction_id") REFERENCES "transaction_ledger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_snapshot" ADD CONSTRAINT "price_snapshot_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_snapshot" ADD CONSTRAINT "price_snapshot_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "market_data_provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fx_rate_snapshot" ADD CONSTRAINT "fx_rate_snapshot_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "market_data_provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_config_version" ADD CONSTRAINT "portfolio_config_version_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "portfolio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_config_version" ADD CONSTRAINT "portfolio_config_version_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_run" ADD CONSTRAINT "recommendation_run_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "portfolio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_run" ADD CONSTRAINT "recommendation_run_config_version_id_fkey" FOREIGN KEY ("config_version_id") REFERENCES "portfolio_config_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_run" ADD CONSTRAINT "recommendation_run_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_item" ADD CONSTRAINT "recommendation_item_recommendation_run_id_fkey" FOREIGN KEY ("recommendation_run_id") REFERENCES "recommendation_run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_item" ADD CONSTRAINT "recommendation_item_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_finding" ADD CONSTRAINT "rule_finding_recommendation_run_id_fkey" FOREIGN KEY ("recommendation_run_id") REFERENCES "recommendation_run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_finding" ADD CONSTRAINT "rule_finding_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "user_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position_snapshot" ADD CONSTRAINT "position_snapshot_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "portfolio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position_snapshot" ADD CONSTRAINT "position_snapshot_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_snapshot" ADD CONSTRAINT "portfolio_snapshot_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "portfolio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_snapshot" ADD CONSTRAINT "performance_snapshot_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "portfolio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
