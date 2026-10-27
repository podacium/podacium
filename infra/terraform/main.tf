###############################################################################
# Podacium Infrastructure — AWS
# Defines: VPC, ECS, RDS, ElastiCache, S3, CloudFront, ALB
###############################################################################

terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "podacium-terraform-state"
    key            = "infra/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "podacium-terraform-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "podacium"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

###############################################################################
# Variables
###############################################################################

variable "aws_region" {
  default = "eu-west-3"
}

variable "environment" {
  default = "staging"
}

variable "db_password" {
  sensitive = true
}

variable "domain" {
  default = "podacium.com"
}

variable "image_tag" {
  description = "Docker image tag for ECS task definitions (default: latest)"
  type        = string
  default     = "latest"

  validation {
    condition     = can(regex("^[a-zA-Z0-9][a-zA-Z0-9._-]+$", var.image_tag))
    error_message = "image_tag must be a valid Docker image tag."
  }
}

variable "image_digest" {
  description = "SHA256 digest for immutable image pinning (e.g., sha256:abc123...). Mutually exclusive with image_tag — when set, takes precedence over image_tag."
  type        = string
  default     = ""

  validation {
    condition     = var.image_digest == "" || can(regex("^sha256:[a-f0-9]{64}$", var.image_digest))
    error_message = "image_digest must be a valid SHA256 digest (sha256:...) or empty string."
  }
}

variable "acm_certificate_arn" {
  description = "ARN of the ACM certificate for the ALB HTTPS listener and CloudFront CDN"
  type        = string
  validation {
    condition     = can(regex("^arn:aws:acm:", var.acm_certificate_arn))
    error_message = "acm_certificate_arn must be a valid ACM certificate ARN starting with 'arn:aws:acm:'."
  }
}

###############################################################################
# VPC
###############################################################################

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "podacium-${var.environment}"
  cidr = "10.0.0.0/16"

  azs             = ["${var.aws_region}a", "${var.aws_region}b"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24"]

  enable_nat_gateway   = true
  single_nat_gateway   = var.environment == "staging"
  enable_dns_hostnames = true
}

###############################################################################
# Network ACL — production defense-in-depth
###############################################################################

resource "aws_network_acl" "main" {
  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  ingress {
    protocol   = "tcp"
    rule_no    = 100
    action     = "allow"
    cidr_block = "10.0.0.0/16"
    from_port  = 0
    to_port    = 65535
  }

  ingress {
    protocol   = "tcp"
    rule_no    = 200
    action     = "allow"
    cidr_block = "0.0.0.0/0"
    from_port  = 443
    to_port    = 443
  }

  ingress {
    protocol   = "tcp"
    rule_no    = 300
    action     = "allow"
    cidr_block = "0.0.0.0/0"
    from_port  = 80
    to_port    = 80
  }

  egress {
    protocol   = "-1"
    rule_no    = 100
    action     = "allow"
    cidr_block = "0.0.0.0/0"
    from_port  = 0
    to_port    = 65535
  }

  tags = {
    Name = "podacium-${var.environment}"
  }
}

###############################################################################
# RDS (PostgreSQL)
###############################################################################

resource "aws_db_subnet_group" "main" {
  name       = "podacium-${var.environment}"
  subnet_ids = module.vpc.private_subnets
}

resource "aws_security_group" "rds" {
  name_prefix = "podacium-rds-"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }
}

resource "aws_db_instance" "main" {
  identifier     = "podacium-${var.environment}"
  engine         = "postgres"
  engine_version = "16.3"
  instance_class = var.environment == "staging" ? "db.t3.micro" : "db.t3.medium"

  allocated_storage     = 20
  max_allocated_storage = 100
  storage_encrypted     = true

  db_name  = "podacium"
  username = "podacium"
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  backup_retention_period = 7
  skip_final_snapshot     = false
  multi_az                = var.environment == "production"
  deletion_protection     = var.environment == "production"

  performance_insights_enabled = true
}

###############################################################################
# ElastiCache (Redis)
###############################################################################

resource "aws_elasticache_subnet_group" "main" {
  name       = "podacium-${var.environment}"
  subnet_ids = module.vpc.private_subnets
}

resource "aws_security_group" "redis" {
  name_prefix = "podacium-redis-"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }
}

resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "podacium-${var.environment}"
  description          = "Podacium Redis cluster"
  node_type            = var.environment == "staging" ? "cache.t3.micro" : "cache.t3.medium"
  num_cache_clusters   = var.environment == "staging" ? 1 : 2

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  automatic_failover_enabled = var.environment == "production"
}

###############################################################################
# ECS Cluster
###############################################################################

resource "aws_security_group" "ecs" {
  name_prefix = "podacium-ecs-"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port       = 8000
    to_port         = 8000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_ecs_cluster" "main" {
  name = "podacium-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

###############################################################################
# S3 Buckets
###############################################################################

# Terraform state bucket — managed in code so terraform import is needed once
resource "aws_s3_bucket" "terraform_state" {
  bucket = "podacium-terraform-state"

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket" "videos" {
  bucket = "podacium-videos-${var.environment}"
}

resource "aws_s3_bucket" "content" {
  bucket = "podacium-content-${var.environment}"
}

# Block public access for both buckets
resource "aws_s3_bucket_public_access_block" "videos" {
  bucket = aws_s3_bucket.videos.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "content" {
  bucket = aws_s3_bucket.content.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Enable versioning for both buckets
resource "aws_s3_bucket_versioning" "videos" {
  bucket = aws_s3_bucket.videos.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_versioning" "content" {
  bucket = aws_s3_bucket.content.id
  versioning_configuration { status = "Enabled" }
}

# Backup bucket — encrypted database backups
resource "aws_s3_bucket" "backup" {
  bucket = "podacium-backups-${var.environment}"
}

resource "aws_s3_bucket_public_access_block" "backup" {
  bucket = aws_s3_bucket.backup.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "backup" {
  bucket = aws_s3_bucket.backup.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backup" {
  bucket = aws_s3_bucket.backup.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "backup" {
  bucket = aws_s3_bucket.backup.id

  rule {
    id     = "transition-to-glacier"
    status = "Enabled"

    transition {
      days          = 30
      storage_class = "GLACIER"
    }

    expiration {
      days = 365
    }
  }

  rule {
    id     = "abort-incomplete-multipart"
    status = "Enabled"

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

###############################################################################
# ALB
###############################################################################

resource "aws_security_group" "alb" {
  name_prefix = "podacium-alb-"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_lb" "main" {
  name               = "podacium-${var.environment}"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = module.vpc.public_subnets
}

###############################################################################
# Outputs
###############################################################################

output "rds_endpoint" {
  value = aws_db_instance.main.endpoint
}

output "redis_endpoint" {
  value = aws_elasticache_replication_group.main.primary_endpoint_address
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "alb_dns" {
  value = aws_lb.main.dns_name
}

output "videos_bucket" {
  value = aws_s3_bucket.videos.id
}
