###############################################################################
# CloudFront Distribution — CDN for static assets and API acceleration
###############################################################################

# Origin Access Identity for S3
resource "aws_cloudfront_origin_access_identity" "content" {
  comment = "Podacium content bucket OAI"
}

# CloudFront Distribution
resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "Podacium CDN - ${var.environment}"
  default_root_object = ""
  price_class         = var.environment == "staging" ? "PriceClass_100" : "PriceClass_All"
  aliases             = var.environment == "production" ? ["cdn.podacium.com"] : []
  web_acl_id          = aws_wafv2_web_acl.cloudfront.arn

  # Wait for deployment
  wait_for_deployment = true

  # ─── Origin: S3 Content Bucket ───────────────────────────────────────────────
  origin {
    domain_name = aws_s3_bucket.content.bucket_regional_domain_name
    origin_id   = "s3-content"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.content.cloudfront_access_identity_path
    }
  }

  # ─── Origin: S3 Videos Bucket ────────────────────────────────────────────────
  origin {
    domain_name = aws_s3_bucket.videos.bucket_regional_domain_name
    origin_id   = "s3-videos"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.content.cloudfront_access_identity_path
    }
  }

  # ─── Origin: ALB (API) ──────────────────────────────────────────────────────
  origin {
    domain_name = aws_lb.main.dns_name
    origin_id   = "alb-api"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # ─── Cache policies ──────────────────────────────────────────────────────────
  # Custom policies replace deprecated forwarded_values blocks.
  # ref: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/using-managed-cache-policies.html

  # ─── Default Behavior: S3 Content ───────────────────────────────────────────
  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "s3-content"

    cache_policy_id = aws_cloudfront_cache_policy.s3_static.id

    viewer_protocol_policy = "redirect-to-https"
    compress               = true
  }

  # ─── Behavior: Video assets (long cache) ────────────────────────────────────
  ordered_cache_behavior {
    path_pattern     = "/videos/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "s3-videos"

    cache_policy_id = aws_cloudfront_cache_policy.video.id

    viewer_protocol_policy = "redirect-to-https"
    compress               = true
  }

  # ─── Behavior: API passthrough (no caching) ─────────────────────────────────
  ordered_cache_behavior {
    path_pattern     = "/api/*"
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "alb-api"

    cache_policy_id          = aws_cloudfront_cache_policy.api_passthrough.id
    origin_request_policy_id = aws_cloudfront_origin_request_policy.api_passthrough.id

    viewer_protocol_policy = "https-only"
    compress               = true
  }

  # ─── Restrictions ───────────────────────────────────────────────────────────
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # ─── TLS Certificate ────────────────────────────────────────────────────────
  # Staging uses the default CloudFront cert (*.cloudfront.net).
  # Production uses a custom ACM certificate (var.acm_certificate_arn) for
  # the cdn.podacium.com alias with TLS 1.2 minimum.
  viewer_certificate {
    cloudfront_default_certificate = var.environment != "production"
    acm_certificate_arn            = var.acm_certificate_arn
    ssl_support_method             = "sni-only"
    minimum_protocol_version       = "TLSv1.2_2021"
  }

  tags = {
    Name = "podacium-cdn-${var.environment}"
  }
}

# S3 Bucket Policy — Allow CloudFront OAI to read (content bucket)
resource "aws_s3_bucket_policy" "content_cdn" {
  bucket = aws_s3_bucket.content.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontOAI"
        Effect = "Allow"
        Principal = {
          AWS = aws_cloudfront_origin_access_identity.content.iam_arn
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.content.arn}/*"
      }
    ]
  })
}

# S3 Bucket Policy — Allow CloudFront OAI to read (videos bucket)
resource "aws_s3_bucket_policy" "videos_cdn" {
  bucket = aws_s3_bucket.videos.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontOAI"
        Effect = "Allow"
        Principal = {
          AWS = aws_cloudfront_origin_access_identity.content.iam_arn
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.videos.arn}/*"
      }
    ]
  })
}

###############################################################################
# CloudFront Cache & Origin Request Policies
###############################################################################

# Static S3 content (1 day cache, no query string, no cookies)
resource "aws_cloudfront_cache_policy" "s3_static" {
  name    = "podacium-s3-static-${var.environment}"
  comment = "1 day cache, no query string, no cookies"

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "none"
    }
    headers_config {
      header_behavior = "none"
    }
    query_strings_config {
      query_string_behavior = "none"
    }
    enable_accept_encoding_gzip   = true
    enable_accept_encoding_brotli = true
  }

  min_ttl     = 0
  default_ttl = 86400
  max_ttl     = 31536000
}

# Video assets (7 day cache, no query string, no cookies)
resource "aws_cloudfront_cache_policy" "video" {
  name    = "podacium-video-${var.environment}"
  comment = "7 day cache, no query string, no cookies"

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "none"
    }
    headers_config {
      header_behavior = "none"
    }
    query_strings_config {
      query_string_behavior = "none"
    }
    enable_accept_encoding_gzip   = true
    enable_accept_encoding_brotli = true
  }

  min_ttl     = 0
  default_ttl = 604800
  max_ttl     = 31536000
}

# API passthrough (no caching, forward auth headers + cookies)
resource "aws_cloudfront_cache_policy" "api_passthrough" {
  name    = "podacium-api-${var.environment}"
  comment = "No caching, forward query string and cookies"

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "all"
    }
    headers_config {
      header_behavior = "whitelist"
      headers {
        items = ["Authorization", "X-Request-ID", "X-Idempotency-Key", "X-CSRF-Token"]
      }
    }
    query_strings_config {
      query_string_behavior = "all"
    }
    enable_accept_encoding_gzip   = true
    enable_accept_encoding_brotli = true
  }

  min_ttl     = 0
  default_ttl = 0
  max_ttl     = 0
}

# API origin request policy (forward auth headers to ALB)
resource "aws_cloudfront_origin_request_policy" "api_passthrough" {
  name    = "podacium-api-origin-${var.environment}"
  comment = "Forward auth headers, cookies, and query string to API origin"

  cookies_config {
    cookie_behavior = "all"
  }
  headers_config {
    header_behavior = "whitelist"
    headers {
      items = ["Authorization", "X-Request-ID", "X-Idempotency-Key", "X-CSRF-Token"]
    }
  }
  query_strings_config {
    query_string_behavior = "all"
  }
}

###############################################################################
# Outputs
###############################################################################

output "cloudfront_domain" {
  value = aws_cloudfront_distribution.main.domain_name
}

output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.main.id
}
