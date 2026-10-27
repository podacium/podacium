###############################################################################
# AWS Secrets Manager — Managed Secrets
# All secrets are created and managed by Terraform.
# ECS task definitions reference these by ARN — NEVER via plaintext env vars.
###############################################################################

# ── Database URL ──────────────────────────────────────────────────────────────
resource "aws_secretsmanager_secret" "database_url" {
  name                    = "podacium/${var.environment}/database_url"
  description             = "PostgreSQL connection string for Podacium API"
  recovery_window_in_days = 7

  tags = {
    Name = "podacium-database-url-${var.environment}"
  }
}

resource "aws_secretsmanager_secret_version" "database_url" {
  secret_id     = aws_secretsmanager_secret.database_url.id
  secret_string = "postgresql://podacium:${var.db_password}@${aws_db_instance.main.endpoint}/podacium?schema=public"
}

# ── JWT Secret Key ────────────────────────────────────────────────────────────
# Created outside Terraform (manual rotation). This resource just tracks the
# existing secret so ECS task definitions can reference it by stable ARN.
data "aws_secretsmanager_secret" "jwt_secret" {
  name = "podacium/${var.environment}/jwt-secret"
}
