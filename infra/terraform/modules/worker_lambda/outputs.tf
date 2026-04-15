output "daily_worker_function_name" {
  value = aws_lambda_function.daily_worker.function_name
}

output "daily_worker_function_arn" {
  value = aws_lambda_function.daily_worker.arn
}

output "recommendation_processor_function_name" {
  value = aws_lambda_function.recommendation_processor.function_name
}

output "recommendation_processor_function_arn" {
  value = aws_lambda_function.recommendation_processor.arn
}

output "recommendation_queue_url" {
  value = aws_sqs_queue.recommendation_queue.url
}

output "recommendation_queue_arn" {
  value = aws_sqs_queue.recommendation_queue.arn
}
