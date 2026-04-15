variable "name_prefix" {
  type = string
}

variable "aws_region" {
  type = string
}

variable "dynamodb_table_name" {
  type = string
}

variable "dynamodb_table_arn" {
  type = string
}

variable "api_ai_settings_secret" {
  type      = string
  sensitive = true
}

variable "recommendation_queue_visibility_timeout_seconds" {
  type    = number
  default = 120
}

variable "recommendation_processor_timeout_seconds" {
  type    = number
  default = 90
}

variable "recommendation_processor_max_concurrency" {
  type    = number
  default = 2
}

variable "recommendation_queue_max_receive_count" {
  type    = number
  default = 5
}

variable "recommendation_queue_age_alarm_threshold_seconds" {
  type    = number
  default = 180
}

variable "alarm_actions" {
  type    = list(string)
  default = []
}

variable "tags" {
  type    = map(string)
  default = {}
}
