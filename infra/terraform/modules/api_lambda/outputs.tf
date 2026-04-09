output "function_name" {
  value = aws_lambda_function.api.function_name
}

output "function_arn" {
  value = aws_lambda_function.api.arn
}

output "invoke_arn" {
  value = aws_lambda_function.api.invoke_arn
}

output "api_gateway_id" {
  value = aws_apigatewayv2_api.api.id
}

output "api_execution_arn" {
  value = aws_apigatewayv2_api.api.execution_arn
}

output "api_mutation_deploy_hint" {
  description = "GitHub Actions should call aws lambda update-function-code for this function name after CI builds the bundle."
  value       = aws_lambda_function.api.function_name
}
