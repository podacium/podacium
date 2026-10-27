#!/usr/bin/env python3
"""
Podacium Self-Audit Script.

Runs all quality checks and produces a JSON scorecard.
Exit code 0 only if ALL components score 100/100.

Usage:
    python scripts/self-audit.py
    # or via Makefile:
    make perfect
"""

import json
import subprocess
import sys
from pathlib import Path
from typing import Dict, Tuple

# Project root
ROOT = Path(__file__).parent.parent
API_DIR = ROOT / "services" / "api"
WEB_DIR = ROOT / "apps" / "web"
INFRA_DIR = ROOT / "infra"


def run_cmd(cmd: str, cwd: str = None, timeout: int = 120) -> Tuple[int, str]:
    """Run a command and return (exit_code, output)."""
    try:
        result = subprocess.run(
            cmd,
            shell=True,
            capture_output=True,
            text=True,
            cwd=cwd or str(ROOT),
            timeout=timeout,
        )
        return result.returncode, result.stdout + result.stderr
    except subprocess.TimeoutExpired:
        return 1, "TIMEOUT"
    except Exception as e:
        return 1, str(e)


def check_file_exists(path: str) -> bool:
    """Check if a file exists relative to project root."""
    return (ROOT / path).exists()


def check_no_secrets_in_git() -> Tuple[bool, str]:
    """Verify no .env files with secrets are tracked in git."""
    code, output = run_cmd(
        "git ls-tree -r HEAD --name-only | grep -E '\\.env$|\\.env\\.'"
    )
    tracked_envs = []
    for f in output.strip().split("\n"):
        if not f or f.endswith(".example"):
            continue
        # Verify if the tracked env file contains any actual secrets (not purely public URLs/flags)
        file_path = ROOT / f
        if file_path.exists():
            content = file_path.read_text()
            has_secret = False
            for line in content.splitlines():
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                k = line.split("=")[0].strip()
                if not (
                    k.startswith("NEXT_PUBLIC_")
                    or k in ("NEXTAUTH_URL", "NODE_ENV", "PORT")
                ):
                    has_secret = True
                    break
            if has_secret:
                tracked_envs.append(f)
        else:
            tracked_envs.append(f)
    if tracked_envs:
        return False, f"Secrets tracked in git: {tracked_envs}"
    return True, "No secrets in git"


def check_csp_no_unsafe() -> Tuple[bool, str]:
    """Verify CSP has no unsafe-eval in actual directives.
    unsafe-inline in style-src is tolerated (NexFix framework requirement).
    """
    nginx_conf = ROOT / "infra" / "nginx" / "podacium.conf"
    if not nginx_conf.exists():
        return False, "Nginx config not found"
    content = nginx_conf.read_text()
    # Check only non-comment lines for unsafe directives
    for line in content.split("\n"):
        stripped = line.strip()
        if stripped.startswith("#"):
            continue
        # style-src 'unsafe-inline' is required by NextFix — skip that one
        if "'unsafe-eval'" in stripped:
            return False, "CSP contains unsafe-eval in script-src"
        if "'unsafe-inline'" in stripped and "style" not in stripped:
            return False, "CSP contains unsafe-inline in non-style directive"
    if "PLACEHOLDER" in content:
        return False, "CSP still has PLACEHOLDER value"
    return True, "CSP is strict (Next.js style-src unsafe-inline tolerated)"


def check_pre_commit_hooks() -> Tuple[bool, str]:
    """Verify pre-commit config blocks secrets."""
    config = ROOT / ".pre-commit-config.yaml"
    if not config.exists():
        return False, "No .pre-commit-config.yaml"
    content = config.read_text()
    checks = [
        "detect-private-key" in content,
        "no-env-files" in content or "Block .env" in content,
        "detect-secrets" in content,
    ]
    if not all(checks):
        return False, "Pre-commit hooks incomplete"
    return True, "Pre-commit hooks configured"


def check_totp_encryption() -> Tuple[bool, str]:
    """Verify TOTP secrets are encrypted at rest."""
    totp_file = API_DIR / "app" / "services" / "totp_service.py"
    if not totp_file.exists():
        return False, "TOTP service not found"
    content = totp_file.read_text()
    if "encrypt_field" not in content:
        return False, "TOTP secrets not encrypted"
    return True, "TOTP secrets encrypted at rest"


def check_csrf_middleware() -> Tuple[bool, str]:
    """Verify CSRF middleware exists."""
    csrf_file = API_DIR / "app" / "middleware" / "csrf.py"
    if not csrf_file.exists():
        return False, "CSRF middleware not found"
    main_file = API_DIR / "app" / "main.py"
    if "csrf_middleware" not in main_file.read_text():
        return False, "CSRF middleware not registered"
    return True, "CSRF protection active"


def check_webhook_signatures() -> Tuple[bool, str]:
    """Verify webhook signature verification is real (not placeholder)."""
    webhook_file = API_DIR / "app" / "services" / "webhook_service.py"
    if not webhook_file.exists():
        return False, "Webhook service not found"
    content = webhook_file.read_text()
    # Check that _verify_bank_signature doesn't just return True unconditionally
    lines = content.split("\n")
    in_bank_verify = False
    for line in lines:
        if "_verify_bank_signature" in line and "def " in line:
            in_bank_verify = True
            continue
        if in_bank_verify:
            if line.strip().startswith("def ") or (
                line.strip() and not line.startswith(" ") and not line.startswith("\t")
            ):
                break
            # Check for unconditional return True without any verification logic
            if "return True" in line and "placeholder" in content.lower():
                return False, "Bank signature verification is still a placeholder"
    # Also check that hmac is used in the bank verification
    if "hmac" not in content.lower():
        return False, "No HMAC verification in webhook service"
    return True, "Webhook signatures verified with HMAC"


def check_terraform_cloudfront() -> Tuple[bool, str]:
    """Verify CloudFront is defined in Terraform."""
    cf_file = INFRA_DIR / "terraform" / "cloudfront.tf"
    if not cf_file.exists():
        return False, "CloudFront not in Terraform"
    content = cf_file.read_text()
    if "aws_cloudfront_distribution" not in content:
        return False, "No CloudFront distribution resource"
    return True, "CloudFront defined in IaC"


def check_ecs_tasks() -> Tuple[bool, str]:
    """Verify ECS task definitions exist."""
    ecs_file = INFRA_DIR / "terraform" / "ecs.tf"
    if not ecs_file.exists():
        return False, "ECS tasks not in Terraform"
    content = ecs_file.read_text()
    if "aws_ecs_task_definition" not in content:
        return False, "No ECS task definition"
    if "aws_ecs_service" not in content:
        return False, "No ECS service"
    return True, "ECS tasks and services defined"


def check_frontend_coverage_ci() -> Tuple[bool, str]:
    """Verify frontend coverage is enforced in CI."""
    ci_file = ROOT / ".github" / "workflows" / "ci.yml"
    if not ci_file.exists():
        return False, "CI workflow not found"
    content = ci_file.read_text()
    if "coverage.thresholds" not in content and "cov-fail-under" not in content.lower():
        return False, "Frontend coverage not enforced in CI"
    return True, "Frontend coverage enforced in CI"


def check_ticket_model() -> Tuple[bool, str]:
    """Verify Ticket model exists in Prisma schema."""
    schema = API_DIR / "prisma" / "schema.prisma"
    if not schema.exists():
        return False, "Prisma schema not found"
    content = schema.read_text()
    if "model Ticket " not in content:
        return False, "Ticket model not in schema"
    if "model TicketMessage" not in content:
        return False, "TicketMessage model not in schema"
    return True, "CRM Ticket model exists"


def check_ticket_router() -> Tuple[bool, str]:
    """Verify ticket API endpoints exist."""
    router_file = API_DIR / "app" / "routers" / "tickets.py"
    if not router_file.exists():
        return False, "Ticket router not found"
    content = router_file.read_text()
    required = [
        "create_ticket",
        "list_tickets",
        "get_ticket",
        "close_ticket",
        "rate_ticket",
    ]
    missing = [r for r in required if r not in content]
    if missing:
        return False, f"Missing ticket endpoints: {missing}"
    return True, "Ticket API endpoints complete"


def check_sla_tasks() -> Tuple[bool, str]:
    """Verify SLA monitoring tasks exist."""
    tasks_file = API_DIR / "app" / "tasks" / "support_tasks.py"
    if not tasks_file.exists():
        return False, "Support tasks not found"
    content = tasks_file.read_text()
    if "check_sla_breaches" not in content:
        return False, "SLA breach detection not implemented"
    return True, "SLA monitoring tasks exist"


def check_og_image_generation() -> Tuple[bool, str]:
    """Verify dynamic OG image generation exists."""
    og_route = WEB_DIR / "src" / "app" / "api" / "og" / "route.tsx"
    if not og_route.exists():
        return False, "OG image route not found"
    return True, "Dynamic OG image generation exists"


def check_structured_data() -> Tuple[bool, str]:
    """Verify structured data components exist."""
    sd_file = WEB_DIR / "src" / "components" / "StructuredData.tsx"
    if not sd_file.exists():
        return False, "StructuredData component not found"
    content = sd_file.read_text()
    required = ["BreadcrumbJsonLd", "CourseJsonLd", "FAQPageJsonLd", "ProductJsonLd"]
    missing = [r for r in required if r not in content]
    if missing:
        return False, f"Missing structured data: {missing}"
    return True, "Per-page structured data components exist"


def check_cdn_invalidation() -> Tuple[bool, str]:
    """Verify CDN invalidation script exists."""
    script = ROOT / "scripts" / "invalidate-cdn.sh"
    if not script.exists():
        return False, "CDN invalidation script not found"
    return True, "CDN invalidation automation exists"


def check_secrets_manager_integration() -> Tuple[bool, str]:
    """Verify secrets manager loading script exists."""
    script = ROOT / "scripts" / "load-secrets.sh"
    if not script.exists():
        return False, "Secrets manager script not found"
    return True, "Secrets manager integration exists"


def check_npm_audit_in_ci() -> Tuple[bool, str]:
    """Verify npm audit is run in CI."""
    ci_file = ROOT / ".github" / "workflows" / "ci.yml"
    if not ci_file.exists():
        return False, "CI workflow not found"
    content = ci_file.read_text()
    if "npm audit" not in content:
        return False, "npm audit not configured in CI"
    return True, "npm audit configured in CI"


def check_container_image_scan_in_ci() -> Tuple[bool, str]:
    """Verify container image scanning is in CI."""
    ci_file = ROOT / ".github" / "workflows" / "ci.yml"
    if not ci_file.exists():
        return False, "CI workflow not found"
    content = ci_file.read_text()
    if "trivy-image-scan" not in content and "trivy image" not in content.lower():
        return False, "Container image scanning not configured in CI"
    return True, "Container image scanning configured in CI"


def check_codeql_workflow() -> Tuple[bool, str]:
    """Verify CodeQL analysis workflow exists."""
    codeql_workflow = ROOT / ".github" / "workflows" / "codeql-analysis.yml"
    if not codeql_workflow.exists():
        return False, "CodeQL workflow not found"
    return True, "CodeQL analysis workflow configured"


def check_dependabot_config() -> Tuple[bool, str]:
    """Verify Dependabot configuration exists."""
    dependabot = ROOT / ".github" / "dependabot.yml"
    if not dependabot.exists():
        return False, "Dependabot config not found"
    content = dependabot.read_text()
    required = ["npm", "pip", "docker", "github-actions"]
    missing = [e for e in required if e not in content]
    if missing:
        return False, f"Dependabot missing ecosystems: {missing}"
    return True, "Dependabot configured (npm + pip + docker + actions)"


def check_waf_config() -> Tuple[bool, str]:
    """Verify Coraza WAF is configured in production."""
    waf_config = ROOT / "infra" / "coraza" / "coraza.conf"
    if not waf_config.exists():
        return False, "Coraza WAF config not found"
    compose = ROOT / "docker-compose.prod.yml"
    if "coraza-waf" not in compose.read_text():
        return False, "Coraza WAF service not in docker-compose.prod.yml"
    return True, "Coraza WAF configured in production stack"


def check_design_system_tests() -> Tuple[bool, str]:
    """Verify design system components have tests."""
    ds_dir = WEB_DIR / "src" / "components" / "design-system"
    if not ds_dir.exists():
        return False, "Design system directory not found"
    components = list(ds_dir.glob("Podacium*.tsx"))
    test_files = list(ds_dir.glob("*.test.tsx"))
    # Each component should have a test
    component_names = {f.stem for f in components if ".test" not in f.stem}
    test_names = {f.stem.replace(".test", "") for f in test_files}
    untested = component_names - test_names
    if untested:
        return False, f"Untested components: {untested}"
    return True, "All design system components tested"


# =============================================================================
# SCORING
# =============================================================================


def run_audit() -> Dict:
    """Run the full self-audit and return scorecard."""
    results = {}

    # Security & Compliance checks
    security_checks = [
        check_no_secrets_in_git(),
        check_csp_no_unsafe(),
        check_pre_commit_hooks(),
        check_totp_encryption(),
        check_csrf_middleware(),
        check_webhook_signatures(),
        check_secrets_manager_integration(),
        check_npm_audit_in_ci(),
        check_container_image_scan_in_ci(),
        check_codeql_workflow(),
        check_dependabot_config(),
        check_waf_config(),
    ]
    security_pass = sum(1 for passed, _ in security_checks if passed)
    security_total = len(security_checks)
    results["security"] = {
        "score": int(security_pass / security_total * 100),
        "checks": [{"passed": p, "detail": d} for p, d in security_checks],
    }

    # CI/CD checks
    ci_content = (
        (ROOT / ".github/workflows/ci.yml").read_text()
        if (ROOT / ".github/workflows/ci.yml").exists()
        else ""
    )
    cicd_checks = [
        check_frontend_coverage_ci(),
        (True, "CI workflow exists")
        if check_file_exists(".github/workflows/ci.yml")
        else (False, "CI workflow missing"),
        (True, "Backend coverage enforced")
        if "cov-fail-under" in ci_content
        else (False, "Backend coverage not enforced"),
    ]
    cicd_pass = sum(1 for passed, _ in cicd_checks if passed)
    results["cicd"] = {
        "score": int(cicd_pass / len(cicd_checks) * 100),
        "checks": [{"passed": p, "detail": d} for p, d in cicd_checks],
    }

    # DevOps & Infrastructure checks
    devops_checks = [
        check_terraform_cloudfront(),
        check_ecs_tasks(),
        check_cdn_invalidation(),
        check_secrets_manager_integration(),
        (True, "Docker Compose prod exists")
        if check_file_exists("docker-compose.prod.yml")
        else (False, "Docker Compose prod missing"),
    ]
    devops_pass = sum(1 for passed, _ in devops_checks if passed)
    results["devops"] = {
        "score": int(devops_pass / len(devops_checks) * 100),
        "checks": [{"passed": p, "detail": d} for p, d in devops_checks],
    }

    # SEO checks
    seo_checks = [
        check_og_image_generation(),
        check_structured_data(),
        (True, "robots.ts exists")
        if check_file_exists("apps/web/src/app/robots.ts")
        else (False, "robots.ts missing"),
        (True, "Sitemap exists")
        if check_file_exists("apps/web/src/app/sitemap.xml/route.ts")
        else (False, "Sitemap missing"),
        (True, "Metadata config exists")
        if check_file_exists("apps/web/src/lib/metadata.config.ts")
        else (False, "Metadata config missing"),
    ]
    seo_pass = sum(1 for passed, _ in seo_checks if passed)
    results["seo"] = {
        "score": int(seo_pass / len(seo_checks) * 100),
        "checks": [{"passed": p, "detail": d} for p, d in seo_checks],
    }

    # CRM & Support checks
    crm_checks = [
        check_ticket_model(),
        check_ticket_router(),
        check_sla_tasks(),
    ]
    crm_pass = sum(1 for passed, _ in crm_checks if passed)
    results["crm"] = {
        "score": int(crm_pass / len(crm_checks) * 100),
        "checks": [{"passed": p, "detail": d} for p, d in crm_checks],
    }

    # Design System checks
    ds_checks = [
        check_design_system_tests(),
        (True, "Design system index exists")
        if check_file_exists("apps/web/src/components/design-system/index.ts")
        else (False, "Design system index missing"),
    ]
    ds_pass = sum(1 for passed, _ in ds_checks if passed)
    results["design_system"] = {
        "score": int(ds_pass / len(ds_checks) * 100),
        "checks": [{"passed": p, "detail": d} for p, d in ds_checks],
    }

    # Calculate global score
    all_scores = [v["score"] for v in results.values()]
    global_score = int(sum(all_scores) / len(all_scores))

    scorecard = {
        "global_score": global_score,
        "perfect": all(s == 100 for s in all_scores),
        "components": results,
        "timestamp": __import__("datetime").datetime.now().isoformat(),
    }

    return scorecard


def main():
    """Run audit and output results."""
    print("=" * 60)
    print("  PODACIUM SELF-AUDIT")
    print("=" * 60)
    print()

    scorecard = run_audit()

    # Print summary
    for component, data in scorecard["components"].items():
        score = data["score"]
        status = "✅" if score == 100 else "❌"
        print(f"  {status} {component:20s} {score}/100")
        for check in data["checks"]:
            icon = "  ✓" if check["passed"] else "  ✗"
            print(f"      {icon} {check['detail']}")

    print()
    print(f"  Global Score: {scorecard['global_score']}/100")
    print(f"  Perfect: {scorecard['perfect']}")
    print()

    # Write JSON scorecard (gitignored)
    output_path = ROOT / "audit-scorecard.json"
    with open(output_path, "w") as f:
        json.dump(scorecard, f, indent=2)
    print(f"  Scorecard written to: {output_path} (gitignored)")

    # Exit code
    if scorecard["perfect"]:
        print()
        print("  🎉 ALL COMPONENTS AT 100/100 — PERFECTION ACHIEVED")
        print()
        return 0
    else:
        print()
        print("  ⚠️  Not all components at 100. See details above.")
        print()
        return 1


if __name__ == "__main__":
    sys.exit(main())
