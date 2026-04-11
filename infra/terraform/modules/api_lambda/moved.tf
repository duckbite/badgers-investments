moved {
  from = aws_acm_certificate.api
  to   = aws_acm_certificate.api[0]
}

moved {
  from = aws_apigatewayv2_domain_name.api
  to   = aws_apigatewayv2_domain_name.api[0]
}

moved {
  from = aws_apigatewayv2_api_mapping.api
  to   = aws_apigatewayv2_api_mapping.api[0]
}
