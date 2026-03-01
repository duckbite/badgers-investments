data "aws_region" "current" {}

locals {
  web_image    = "${var.web_ecr_repository_url}:${var.web_image_tag}"
  api_image    = "${var.api_ecr_repository_url}:${var.api_image_tag}"
  worker_image = "${var.worker_ecr_repository_url}:${var.worker_image_tag}"

  secret_api_database_url = "${var.secrets_arn}:API_DATABASE_URL::"
  secret_database_url     = "${var.secrets_arn}:API_DATABASE_URL::"
  secret_cookie_secret    = "${var.secrets_arn}:COOKIE_SECRET::"
}

resource "aws_ecs_cluster" "main" {
  name = "${var.name_prefix}-cluster"
  tags = merge(var.tags, { Name = "${var.name_prefix}-cluster" })
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/${var.name_prefix}/api"
  retention_in_days = 30
  tags              = var.tags
}

resource "aws_cloudwatch_log_group" "web" {
  name              = "/ecs/${var.name_prefix}/web"
  retention_in_days = 30
  tags              = var.tags
}

resource "aws_cloudwatch_log_group" "worker" {
  name              = "/ecs/${var.name_prefix}/worker"
  retention_in_days = 30
  tags              = var.tags
}

data "aws_iam_policy_document" "task_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "execution" {
  name               = "${var.name_prefix}-ecs-exec"
  assume_role_policy = data.aws_iam_policy_document.task_assume_role.json
  tags               = var.tags
}

resource "aws_iam_role_policy_attachment" "execution_ecs" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "task" {
  name               = "${var.name_prefix}-ecs-task"
  assume_role_policy = data.aws_iam_policy_document.task_assume_role.json
  tags               = var.tags
}

data "aws_iam_policy_document" "task_secrets_access" {
  statement {
    actions   = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"]
    resources = [var.secrets_arn]
  }
}

resource "aws_iam_role_policy" "task_secrets_access" {
  name   = "${var.name_prefix}-secrets-access"
  role   = aws_iam_role.task.id
  policy = data.aws_iam_policy_document.task_secrets_access.json
}

resource "aws_ecs_task_definition" "api" {
  count                    = var.enable_services ? 1 : 0
  family                   = "${var.name_prefix}-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([
    {
      name      = "api"
      image     = local.api_image
      essential = true
      portMappings = [
        { containerPort = 3000, hostPort = 3000, protocol = "tcp" }
      ]
      environment = [
        { name = "API_PORT", value = "3000" }
      ]
      secrets = [
        { name = "API_DATABASE_URL", valueFrom = local.secret_api_database_url },
        { name = "DATABASE_URL", valueFrom = local.secret_database_url },
        { name = "COOKIE_SECRET", valueFrom = local.secret_cookie_secret }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.api.name
          awslogs-region        = data.aws_region.current.name
          awslogs-stream-prefix = "ecs"
        }
      }
    }
  ])

  tags = var.tags
}

resource "aws_ecs_task_definition" "web" {
  count                    = var.enable_services ? 1 : 0
  family                   = "${var.name_prefix}-web"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([
    {
      name      = "web"
      image     = local.web_image
      essential = true
      portMappings = [
        { containerPort = 3000, hostPort = 3000, protocol = "tcp" }
      ]
      environment = [
        { name = "HOST", value = "0.0.0.0" },
        { name = "PORT", value = "3000" },
        { name = "PUBLIC_API_BASE_URL", value = "https://${var.api_domain}" }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.web.name
          awslogs-region        = data.aws_region.current.name
          awslogs-stream-prefix = "ecs"
        }
      }
    }
  ])

  tags = var.tags
}

resource "aws_ecs_task_definition" "worker" {
  count                    = var.enable_services ? 1 : 0
  family                   = "${var.name_prefix}-worker"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([
    {
      name      = "worker"
      image     = local.worker_image
      essential = true
      secrets = [
        { name = "API_DATABASE_URL", valueFrom = local.secret_api_database_url },
        { name = "DATABASE_URL", valueFrom = local.secret_database_url }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.worker.name
          awslogs-region        = data.aws_region.current.name
          awslogs-stream-prefix = "ecs"
        }
      }
    }
  ])

  tags = var.tags
}

resource "aws_ecs_service" "api" {
  count           = var.enable_services ? 1 : 0
  name            = "${var.name_prefix}-api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api[0].arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.ecs_security_group_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = var.api_target_group_arn
    container_name   = "api"
    container_port   = 3000
  }

  tags = var.tags
}

resource "aws_ecs_service" "web" {
  count           = var.enable_services ? 1 : 0
  name            = "${var.name_prefix}-web"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.web[0].arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.ecs_security_group_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = var.web_target_group_arn
    container_name   = "web"
    container_port   = 3000
  }

  tags = var.tags
}

resource "aws_lb_listener_rule" "web_host" {
  count        = var.enable_services ? 1 : 0
  listener_arn = var.alb_listener_https_arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = var.web_target_group_arn
  }

  condition {
    host_header {
      values = [var.web_domain]
    }
  }
}

resource "aws_lb_listener_rule" "api_host" {
  count        = var.enable_services ? 1 : 0
  listener_arn = var.alb_listener_https_arn
  priority     = 20

  action {
    type             = "forward"
    target_group_arn = var.api_target_group_arn
  }

  condition {
    host_header {
      values = [var.api_domain]
    }
  }
}

