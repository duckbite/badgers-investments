locals {
  repositories = {
    web    = "${var.name_prefix}-web"
    api    = "${var.name_prefix}-api"
    worker = "${var.name_prefix}-worker"
  }
}

resource "aws_ecr_repository" "repos" {
  for_each             = local.repositories
  name                 = each.value
  image_tag_mutability = "IMMUTABLE"
  force_delete         = true
  tags                 = merge(var.tags, { Name = each.value })
}

resource "aws_ecr_lifecycle_policy" "repos" {
  for_each   = aws_ecr_repository.repos
  repository = each.value.name
  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 30 images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 30
        }
        action = { type = "expire" }
      }
    ]
  })
}

