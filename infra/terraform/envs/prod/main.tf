data "aws_caller_identity" "current" {}

locals {
  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
  dynamodb_table_arn = "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${var.dynamodb_table_name}"
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

module "secrets" {
  source      = "../../modules/secrets"
  name_prefix = "${var.project_name}-${var.environment}"
  tags        = local.tags
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
  aws_region                = var.aws_region
  dynamodb_table_name       = var.dynamodb_table_name
  dynamodb_table_arn        = local.dynamodb_table_arn
  tags                      = local.tags

  web_image_tag    = var.web_image_tag
  api_image_tag    = var.api_image_tag
  worker_image_tag = var.worker_image_tag
  enable_services  = var.enable_services
}

module "github_actions_oidc" {
  source                 = "../../modules/github-actions-oidc"
  name_prefix            = "${var.project_name}-${var.environment}"
  github_org             = var.github_org
  github_repo            = var.github_repo
  github_ref             = var.github_ref
  ecr_repository_arns    = [module.ecr.web_repository_arn, module.ecr.api_repository_arn, module.ecr.worker_repository_arn]
  ecs_execution_role_arn = module.ecs.execution_role_arn
  ecs_task_role_arn      = module.ecs.task_role_arn
  tags                   = local.tags
}

