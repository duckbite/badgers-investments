output "api_url" {
  description = "API URL."
  value       = "https://${var.api_domain}"
}

output "api_invoke_url" {
  description = "API Gateway invoke URL (default stage)."
  value       = aws_apigatewayv2_api.http.api_endpoint
}

output "lambda_function_name" {
  description = "Lambda function name for the API."
  value       = aws_lambda_function.api.function_name
}

output "lambda_function_arn" {
  description = "Lambda function ARN for the API."
  value       = aws_lambda_function.api.arn
}

output "http_api_id" {
  description = "API Gateway HTTP API ID."
  value       = aws_apigatewayv2_api.http.id
}

output "dns_records_to_create" {
  description = "DNS records that must exist for ACM validation / aliasing when Route53 is not managed."
  value = {
    certificate_validation = local.api_certificate_validation_records
    api_alias = {
      name                     = var.api_domain
      type_a_target_name       = aws_apigatewayv2_domain_name.api.domain_name_configuration[0].target_domain_name
      type_a_target_zone_id    = aws_apigatewayv2_domain_name.api.domain_name_configuration[0].hosted_zone_id
      type_aaaa_target_name    = aws_apigatewayv2_domain_name.api.domain_name_configuration[0].target_domain_name
      type_aaaa_target_zone_id = aws_apigatewayv2_domain_name.api.domain_name_configuration[0].hosted_zone_id
    }
  }
}

