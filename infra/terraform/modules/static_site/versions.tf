terraform {
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      version               = ">= 5.100"
      configuration_aliases = [aws.us_east_1]
    }
  }
}
