"""
GitHub REST/GraphQL Connector for Freelancing Contract PR Sync.
"""

import logging
import httpx
from typing import Dict, Any
from app.core.prisma import prisma
from app.core.security import decrypt_vault_secret

logger = logging.getLogger(__name__)


class GitHubConnector:
    async def sync_milestone_pr(
        self, user_id: int, repo_owner: str, repo_name: str, pull_number: int
    ) -> Dict[str, Any]:
        """Interrogate GitHub Pull Request to sync milestone completion for a freelance contract."""
        integration = await prisma.userintegration.find_unique(
            where={"userId_provider": {"userId": user_id, "provider": "github"}}
        )
        if not integration or not integration.accessToken:
            raise ValueError("GitHub integration not connected")

        raw_token = decrypt_vault_secret(integration.accessToken)

        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(
                f"https://api.github.com/repos/{repo_owner}/{repo_name}/pulls/{pull_number}",
                headers={
                    "Authorization": f"Bearer {raw_token}",
                    "Accept": "application/vnd.github.v3+json",
                    "User-Agent": "Podacium-Connect-Engine",
                },
            )
            if res.status_code != 200:
                raise ValueError(f"GitHub API Error: {res.text}")

            pr_data = res.json()
            is_merged = pr_data.get("merged", False)
            branch_name = pr_data.get("head", {}).get("ref", "")
            title = pr_data.get("title", "")

            milestone_status = "READY_FOR_REVIEW" if is_merged else "IN_PROGRESS"

            return {
                "status": "SUCCESS",
                "repo": f"{repo_owner}/{repo_name}",
                "pull_number": pull_number,
                "title": title,
                "branch": branch_name,
                "is_merged": is_merged,
                "contract_milestone_status": milestone_status,
            }


github_connector = GitHubConnector()
