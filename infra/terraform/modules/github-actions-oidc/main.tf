data "tls_certificate" "github_actions" {
  url = "https://token.actions.githubusercontent.com"
}

resource "aws_iam_openid_connect_provider" "github_actions" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.github_actions.certificates[0].sha1_fingerprint]
  tags            = var.tags
}

locals {
  subject = "repo:${var.github_org}/${var.github_repo}:ref:${var.github_ref}"
}

data "aws_iam_policy_document" "assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github_actions.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = [local.subject]
    }
  }
}

resource "aws_iam_role" "deploy" {
  name               = "${var.name_prefix}-github-actions-deploy"
  assume_role_policy = data.aws_iam_policy_document.assume_role.json
  tags               = var.tags
}

data "aws_iam_policy_document" "deploy_core" {
  statement {
    sid    = "S3WebSync"
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
      "s3:ListBucket",
    ]
    resources = [
      var.web_s3_bucket_arn,
      "${var.web_s3_bucket_arn}/*",
    ]
  }

  statement {
    sid       = "CloudFrontInvalidate"
    effect    = "Allow"
    actions   = ["cloudfront:CreateInvalidation", "cloudfront:GetDistribution"]
    resources = [var.cloudfront_distribution_arn]
  }

  statement {
    sid     = "LambdaUpdateCode"
    effect  = "Allow"
    actions = ["lambda:UpdateFunctionCode", "lambda:GetFunction", "lambda:GetFunctionConfiguration"]
    resources = [
      var.lambda_api_function_arn,
      var.lambda_daily_worker_function_arn,
      var.lambda_recommendation_processor_function_arn,
    ]
  }

  statement {
    sid       = "RecommendationQueueRead"
    effect    = "Allow"
    actions   = ["sqs:GetQueueAttributes", "sqs:GetQueueUrl"]
    resources = [var.recommendation_queue_arn]
  }
}

data "aws_iam_policy_document" "deploy_remote_state_s3" {
  count = trimspace(var.terraform_remote_state_s3_bucket_arn) != "" ? 1 : 0

  statement {
    sid    = "TerraformRemoteStateS3"
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
      "s3:ListBucket",
    ]
    resources = [
      var.terraform_remote_state_s3_bucket_arn,
      "${var.terraform_remote_state_s3_bucket_arn}/*",
    ]
  }
}

data "aws_iam_policy_document" "deploy_remote_state_lock" {
  count = trimspace(var.terraform_remote_state_lock_dynamodb_table_arn) != "" ? 1 : 0

  statement {
    sid    = "TerraformRemoteStateLock"
    effect = "Allow"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:DeleteItem",
      "dynamodb:DescribeTable",
    ]
    resources = [var.terraform_remote_state_lock_dynamodb_table_arn]
  }
}

data "aws_iam_policy_document" "deploy" {
  source_policy_documents = concat(
    [data.aws_iam_policy_document.deploy_core.json],
    data.aws_iam_policy_document.deploy_remote_state_s3[*].json,
    data.aws_iam_policy_document.deploy_remote_state_lock[*].json,
  )
}

resource "aws_iam_role_policy" "deploy" {
  name   = "${var.name_prefix}-github-actions-deploy"
  role   = aws_iam_role.deploy.id
  policy = data.aws_iam_policy_document.deploy.json
}

# CI terraform apply needs broad IAM unless you maintain a custom policy for every resource.
resource "aws_iam_role_policy_attachment" "terraform_apply_admin" {
  count      = var.grant_terraform_apply_permissions ? 1 : 0
  role       = aws_iam_role.deploy.name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
}
