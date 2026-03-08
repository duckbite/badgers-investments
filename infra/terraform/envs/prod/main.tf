locals {
  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

module "network" {
  source                  = "../../modules/network"
  name_prefix             = "${var.project_name}-${var.environment}"
  aws_region              = var.aws_region
  vpc_cidr                = var.vpc_cidr
  public_subnet_cidrs     = var.public_subnet_cidrs
  private_subnet_cidrs    = var.private_subnet_cidrs
  availability_zone_count = var.availability_zone_count
  tags                    = local.tags
}

module "ecr" {
  source      = "../../modules/ecr"
  name_prefix = "${var.project_name}-${var.environment}"
  tags        = local.tags
}

module "database" {
  source                   = "../../modules/rds"
  name_prefix              = "${var.project_name}-${var.environment}"
  vpc_id                   = module.network.vpc_id
  private_subnet_ids       = module.network.private_subnet_ids
  db_security_group_id     = module.network.db_security_group_id
  engine_major_version     = var.db_engine_major_version
  engine_version_override  = var.db_engine_version_override
  instance_class           = var.db_instance_class
  allocated_storage_gb     = var.db_allocated_storage
  backup_retention_days    = var.db_backup_retention_days
  max_allocated_storage_gb = var.db_max_allocated_storage
  backup_window            = var.db_backup_window
  maintenance_window       = var.db_maintenance_window
  deletion_protection      = var.db_deletion_protection
  skip_final_snapshot      = var.db_skip_final_snapshot
  apply_immediately        = var.db_apply_immediately
  tags                     = local.tags
}

module "secrets" {
  source       = "../../modules/secrets"
  name_prefix  = "${var.project_name}-${var.environment}"
  database_url = module.database.database_url
  tags         = local.tags
}

module "alb" {
  source                = "../../modules/alb"
  name_prefix           = "${var.project_name}-${var.environment}"
  vpc_id                = module.network.vpc_id
  public_subnet_ids     = module.network.public_subnet_ids
  alb_security_group_id = module.network.alb_security_group_id
  web_domain            = var.web_domain
  api_domain            = var.api_domain
  route53_zone_id       = var.route53_zone_id
  tags                  = local.tags
}

module "ecs" {
  source                    = "../../modules/ecs"
  name_prefix               = "${var.project_name}-${var.environment}"
  vpc_id                    = module.network.vpc_id
  private_subnet_ids        = module.network.private_subnet_ids
  ecs_security_group_id     = module.network.ecs_security_group_id
  alb_listener_https_arn    = module.alb.https_listener_arn
  web_domain                = var.web_domain
  api_domain                = var.api_domain
  web_target_group_arn      = module.alb.web_target_group_arn
  api_target_group_arn      = module.alb.api_target_group_arn
  web_ecr_repository_url    = module.ecr.web_repository_url
  api_ecr_repository_url    = module.ecr.api_repository_url
  worker_ecr_repository_url = module.ecr.worker_repository_url
  secrets_arn               = module.secrets.app_secret_arn
  tags                      = local.tags

  web_image_tag    = var.web_image_tag
  api_image_tag    = var.api_image_tag
  worker_image_tag = var.worker_image_tag
  enable_services  = var.enable_services
}

