###############################################################################
# AWS WAF — Web Application Firewall
# Shared rule group used by both ALB and CloudFront.
###############################################################################

# Managed rule groups
locals {
  managed_rule_groups = [
    {
      name        = "AWSManagedRulesCommonRuleSet"
      vendor      = "aws"
      priority    = 10
      description = "Core rule set — SQLi, XSS, LFI, RFI, SSRF"
    },
    {
      name        = "AWSManagedRulesKnownBadInputsRuleSet"
      vendor      = "aws"
      priority    = 20
      description = "Known attack patterns — probe, scanner, discover"
    },
    {
      name        = "AWSManagedRulesAmazonIpReputationList"
      vendor      = "aws"
      priority    = 30
      description = "IP reputation — block known bad actors"
    },
    {
      name        = "AWSManagedRulesAnonymousIpList"
      vendor      = "aws"
      priority    = 40
      description = "Block anonymized traffic — VPN, Tor, proxies"
    },
    {
      name        = "AWSManagedRulesBotControlRuleSet"
      vendor      = "aws"
      priority    = 50
      description = "Bot control — block scrapers, crawlers, headless browsers"
    },
  ]
}

# ── Shared WAF WebACL ──────────────────────────────────────────────────────────
resource "aws_wafv2_web_acl" "main" {
  name        = "podacium-${var.environment}"
  description = "Podacium WebACL — rate-based + managed rules"
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  # ── Rate-based rule: 2000 req/5min per IP ──────────────────────────────────
  rule {
    name     = "rate-limit-global"
    priority = 1

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = 2000
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "PodaciumRateLimitGlobal"
      sampled_requests_enabled   = true
    }
  }

  # ── Managed rule groups ─────────────────────────────────────────────────────
  dynamic "rule" {
    for_each = local.managed_rule_groups
    content {
      name     = rule.value.name
      priority = rule.value.priority

      override_action {
        none {}
      }

      statement {
        managed_rule_group_statement {
          name        = rule.value.name
          vendor_name = rule.value.vendor

          # Exclude known-good patterns
          dynamic "rule_action_override" {
            for_each = rule.value.name == "AWSManagedRulesCommonRuleSet" ? [1] : []
            content {
              name = "NoUserAgent_HEADER"
              action_to_use {
                count {}
              }
            }
          }
        }
      }

      visibility_config {
        cloudwatch_metrics_enabled = true
        metric_name                = replace(rule.value.name, "/[^a-zA-Z0-9]/", "")
        sampled_requests_enabled   = true
      }
    }
  }

  # ── IP blocklist (optional, empty by default) ───────────────────────────────
  # Populate via: aws wafv2 update-ip-set --name podacium-blocklist
  # or via Terraform: add aws_wafv2_ip_set resource and reference here.
  # rule {
  #   name     = "ip-blocklist"
  #   priority = 60
  #   action { block {} }
  #   statement {
  #     ip_set_reference_statement {
  #       arn = aws_wafv2_ip_set.blocklist.arn
  #     }
  #   }
  #   visibility_config {
  #     cloudwatch_metrics_enabled = true
  #     metric_name                = "PodaciumIPBlocklist"
  #     sampled_requests_enabled   = true
  #   }
  # }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "PodaciumWAF"
    sampled_requests_enabled   = true
  }

  tags = {
    Name = "podacium-waf-${var.environment}"
  }
}

# ═══════════════════════════════════════════════════════════════════════════════
# ALB Association
# ═══════════════════════════════════════════════════════════════════════════════

resource "aws_wafv2_web_acl_association" "alb" {
  resource_arn = aws_lb.main.arn
  web_acl_arn  = aws_wafv2_web_acl.main.arn
}

# ═══════════════════════════════════════════════════════════════════════════════
# CloudFront Distribution (scope = CLOUDFRONT, not REGIONAL)
# ═══════════════════════════════════════════════════════════════════════════════
# CloudFront requires a separate WebACL because WAFv2 scope must be CLOUDFRONT.
# The rules are identical to the regional ACL via local.managed_rule_groups.

resource "aws_wafv2_web_acl" "cloudfront" {
  name        = "podacium-cdn-${var.environment}"
  description = "Podacium CloudFront WAF — rate-based + managed rules"
  scope       = "CLOUDFRONT"

  default_action {
    allow {}
  }

  # ── Rate-based rule (lower limit for CDN origin access) ────────────────────
  rule {
    name     = "rate-limit-cdn"
    priority = 1

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = 5000
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "PodaciumRateLimitCDN"
      sampled_requests_enabled   = true
    }
  }

  # ── Managed rules (same groups as regional) ────────────────────────────────
  dynamic "rule" {
    for_each = local.managed_rule_groups
    content {
      name     = rule.value.name
      priority = rule.value.priority

      override_action {
        none {}
      }

      statement {
        managed_rule_group_statement {
          name        = rule.value.name
          vendor_name = rule.value.vendor
        }
      }

      visibility_config {
        cloudwatch_metrics_enabled = true
        metric_name                = join("", ["CDN", replace(rule.value.name, "/[^a-zA-Z0-9]/", "")])
        sampled_requests_enabled   = true
      }
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "PodaciumCDNWAF"
    sampled_requests_enabled   = true
  }

  tags = {
    Name = "podacium-cdn-waf-${var.environment}"
  }
}

# CloudFront distribution WAF association
# The web_acl_id is set directly on the cloudfront_distribution resource.
