# Terraform troubleshooting (prod serverless)

## `BucketNotEmpty` when Terraform destroys the web bucket

The static site bucket may hold deployed assets. Either:

1. Empty it, then re-run apply:

```bash
aws s3 rm "s3://BUCKET_NAME" --recursive
```

2. Or rely on **`force_destroy = true`** on the web bucket (enabled by default in current modules) so Terraform can empty it on destroy.

**Legacy `module.web` bucket** (random suffix, e.g. `badgers-investments-prod-web-dadfa5b4`): that resource often had **`force_destroy = false`**. Terraform cannot delete it until it is empty. Run **`aws s3 rm s3://badgers-investments-prod-web-dadfa5b4 --recursive`** (adjust name from `terraform state list` if different), then **`terraform apply`** again.

## GitHub Actions Terraform: `S3 HeadObject` / `403 Forbidden` on state object

The OIDC deploy role must be allowed to read and write the **bootstrap remote state bucket** (and the **state lock DynamoDB table** if `backend.hcl` sets `dynamodb_table`). The inline deploy policy only covered the **web** bucket until explicit state ARNs were added to **`github-actions-oidc`**.

After upgrading that module, run **`terraform apply`** for prod locally so IAM updates, then re-run the workflow.

If **`terraform apply`** in CI still fails on other APIs, set **`github_actions_grant_terraform_apply = true`** in **`terraform.tfvars`**, apply once (AdministratorAccess on the same role), and sync **`PROD_TFVARS`**.

Also confirm **`AWS_ROLE_ARN`** in GitHub matches **`terraform output github_actions_deploy_role_arn`**.

## CloudFront: `InvalidArgument: The parameter ForwardedValues is required`

`aws_cloudfront_distribution` cache behaviors must use either a **`forwarded_values`** block (legacy) or **`cache_policy_id`** (and usually **`origin_request_policy_id`** for S3 + OPTIONS). If neither is set, AWS returns this error. The **`static_site`** module uses **Managed-CachingOptimized** + **Managed-CORS-S3Origin** on default and `/_app/immutable/*` behaviors (`Managed-CachingImmutable` is not available in every account’s managed policy list).

## `EntityAlreadyExists` on IAM role (e.g. `badgers-investments-prod-api-lambda`)

The role exists in AWS but is missing from Terraform state (partial apply or state reset). Import it:

```bash
terraform -chdir=infra/terraform/envs/prod import \
  'module.api_lambda.aws_iam_role.api' badgers-investments-prod-api-lambda
```

Replace the role name if your `name_prefix` differs.

## `OriginAccessControlAlreadyExists` for CloudFront OAC

List IDs:

```bash
aws cloudfront list-origin-access-controls --query "OriginAccessControlList.Items[?Name=='badgers-investments-prod-web-oac'].Id" --output text
```

Import (use the returned ID, often starting with `E`):

```bash
terraform -chdir=infra/terraform/envs/prod import \
  'module.static_site.aws_cloudfront_origin_access_control.web' E1234567890ABCDEFG
```

## Certificate “not in ISSUED state” (API Gateway / CloudFront)

Prod **creates** a Route53 public zone (`dns_zone_name`, default `badgers.nl`) and writes ACM DNS validation records there. You must **delegate** that zone at your registrar (`terraform output route53_name_servers`) so validation can complete and aliases resolve.

If validation stays pending, confirm NS at the registrar match the output name servers exactly.

## Hosted zone already exists in AWS (duplicate `badgers.nl`)

You can have only one public hosted zone per apex per account. If the zone already exists, import it instead of creating:

```bash
terraform -chdir=infra/terraform/envs/prod import \
  'module.public_dns_zone.aws_route53_zone.this' ZONE_ID_FROM_CONSOLE
```

Then remove any conflicting `terraform state` entries from an older module address if you migrated.

## Route53 hosted zone destroyed

If Terraform reported **`aws_route53_zone` … Destruction complete**, the **zone may have been deleted in AWS**. Check **Route53 → Hosted zones** immediately. If the zone is gone, restoring DNS is an AWS/account procedure (recreate zone, fix NS at registrar, re-validate certs). This doc cannot recover that automatically.

## Old bucket name vs new (`…-web-dadfa5b4` vs `…-web-static`)

Older code sometimes used a random suffix. Current code uses **`${name_prefix}-web-static`**. If state still references the old bucket, run **`terraform state list`**, then **`terraform state rm`** on the old address if you have abandoned it, **after** emptying or deleting the old bucket in AWS.
