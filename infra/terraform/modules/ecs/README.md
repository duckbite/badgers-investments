## Module: ecs

Creates:

- ECS cluster (Fargate)
- CloudWatch log groups
- IAM roles for task execution and runtime
- Task definitions for `web`, `api`, and `worker`
- ECS services for `web` and `api` behind the ALB target groups
- ALB listener rules for host-based routing

