import logging

logger = logging.getLogger(__name__)
"""
Cross-pillar flywheel service for Podacium BI.

Aggregates events from Education (enrollments, certificates) and 
Freelancing (contracts, transactions) pillars into BI-ready datasets,
creating the network effect that makes the platform valuable.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from app.core.prisma import prisma


class FlywheelService:
    """
    Ingests cross-pillar data into BI datasets.
    
    Data flow:
        Education → enrollment completions, certificate awards
        Freelancing → contract completions, payments received/sent
        Platform → user activity, revenue, growth
    """

    @classmethod
    async def sync_education_to_bi(
        cls,
        organization_id: int,
        user_id: int,
        days_back: int = 90,
    ) -> Dict[str, Any]:
        """
        Pull education pillar data into BI-ready records.
        
        Creates records from:
        - Enrollment completions
        - Certificate awards
        - Module engagement metrics
        """
        since = datetime.now(timezone.utc) - timedelta(days=days_back)
        records = []

        try:
            # Get completed enrollments
            enrollments = await prisma.enrollment.find_many(
                where={
                    "userId": user_id,
                    "completedAt": {"not": None, "gte": since},
                },
                include={
                    "module": True,
                },
                order={"completedAt": "desc"},
            )

            for e in enrollments:
                module = e.module
                records.append({
                    "date": e.completedAt.strftime("%Y-%m-%d") if e.completedAt else "",
                    "source": "education",
                    "event_type": "course_completion",
                    "description": f"Completed: {module.title if module else 'Unknown'}",
                    "amount": float(module.price or 0) if module else 0.0,
                    "currency": "DZD",
                    "category": "education_investment",
                    "metadata": {
                        "module_level": module.level if module else None,
                        "duration_minutes": module.durationMinutes if module else None,
                        "progress": e.progress,
                    },
                })

            # Get certificates
            certificates = await prisma.certificate.find_many(
                where={
                    "userId": user_id,
                    "issuedAt": {"gte": since},
                },
                include={
                    "module": True,
                },
                order={"issuedAt": "desc"},
            )

            for cert in certificates:
                records.append({
                    "date": cert.issuedAt.strftime("%Y-%m-%d") if cert.issuedAt else "",
                    "source": "education",
                    "event_type": "certificate_earned",
                    "description": f"Certificate: {cert.module.title if cert.module else 'Unknown'}",
                    "amount": 0.0,
                    "currency": "DZD",
                    "category": "skill_acquisition",
                    "metadata": {
                        "certificate_id": cert.id,
                        "verification_code": cert.verificationCode,
                    },
                })

        except Exception as e:
            logger.exception("Failed to sync education to BI: %s", str(e))

        return {
            "pillar": "education",
            "records": records,
            "record_count": len(records),
            "synced_at": datetime.now(timezone.utc).isoformat(),
        }

    @classmethod
    async def sync_freelancing_to_bi(
        cls,
        organization_id: int,
        user_id: int,
        days_back: int = 90,
    ) -> Dict[str, Any]:
        """
        Pull freelancing pillar data into BI-ready records.
        
        Creates records from:
        - Completed contracts
        - Payments received (as freelancer)
        - Payments sent (as client)
        """
        since = datetime.now(timezone.utc) - timedelta(days=days_back)
        records = []

        try:
            # Get contracts where user is freelancer
            contracts_as_freelancer = await prisma.contract.find_many(
                where={
                    "freelancerId": user_id,
                    "status": "COMPLETED",
                    "updatedAt": {"gte": since},
                },
                include={
                    "project": True,
                    "client": True,
                },
                order={"updatedAt": "desc"},
            )

            for c in contracts_as_freelancer:
                records.append({
                    "date": c.updatedAt.strftime("%Y-%m-%d") if c.updatedAt else "",
                    "source": "freelancing",
                    "event_type": "contract_completed",
                    "description": f"Contract: {c.project.title if c.project else 'Freelance Work'}",
                    "amount": float(c.amount or 0),
                    "currency": "DZD",
                    "category": "freelance_revenue",
                    "type": "revenu",
                    "metadata": {
                        "contract_id": c.id,
                        "client": c.client.fullName if c.client else None,
                    },
                })

            # Get contracts where user is client
            contracts_as_client = await prisma.contract.find_many(
                where={
                    "clientId": user_id,
                    "status": "COMPLETED",
                    "updatedAt": {"gte": since},
                },
                include={
                    "project": True,
                    "freelancer": True,
                },
                order={"updatedAt": "desc"},
            )

            for c in contracts_as_client:
                records.append({
                    "date": c.updatedAt.strftime("%Y-%m-%d") if c.updatedAt else "",
                    "source": "freelancing",
                    "event_type": "service_purchased",
                    "description": f"Hired: {c.freelancer.fullName if c.freelancer else 'Freelancer'} for {c.project.title if c.project else 'Project'}",
                    "amount": float(c.amount or 0),
                    "currency": "DZD",
                    "category": "freelance_expense",
                    "type": "depense",
                    "metadata": {
                        "contract_id": c.id,
                        "freelancer": c.freelancer.fullName if c.freelancer else None,
                    },
                })

            # Get wallet transactions
            try:
                transactions = await prisma.transaction.find_many(
                    where={
                        "userId": user_id,
                        "createdAt": {"gte": since},
                    },
                    order={"createdAt": "desc"},
                    take=100,
                )

                for tx in transactions:
                    purpose_str = str(tx.purpose or "").upper()
                    tx_type = "revenu" if purpose_str in ("WALLET_DEPOSIT", "PAYOUT", "MILESTONE_PAYMENT") else "depense"
                    records.append({
                        "date": tx.createdAt.strftime("%Y-%m-%d"),
                        "source": "wallet",
                        "event_type": f"transaction_{purpose_str.lower()}",
                        "description": tx.description or f"Transaction: {purpose_str}",
                        "amount": float(tx.amount or 0),
                        "currency": "DZD",
                        "category": f"wallet_{purpose_str.lower()}",
                        "type": tx_type,
                        "metadata": {
                            "transaction_id": tx.id,
                            "status": tx.status,
                        },
                    })
            except Exception as e:
                logger.exception("Failed to sync transactions: %s", str(e))

        except Exception as e:
            logger.exception("Failed to sync freelancing to BI: %s", str(e))

        return {
            "pillar": "freelancing",
            "records": records,
            "record_count": len(records),
            "synced_at": datetime.now(timezone.utc).isoformat(),
        }

    @classmethod
    async def sync_all_pillars(
        cls,
        organization_id: int,
        user_id: int,
        days_back: int = 90,
    ) -> Dict[str, Any]:
        """
        Sync data from all pillars into a unified BI dataset.
        Returns all cross-pillar records merged.
        """
        edu_result = await cls.sync_education_to_bi(organization_id, user_id, days_back)
        free_result = await cls.sync_freelancing_to_bi(organization_id, user_id, days_back)

        all_records = edu_result["records"] + free_result["records"]

        # Sort by date descending
        all_records.sort(key=lambda r: r.get("date", ""), reverse=True)

        return {
            "pillars_synced": ["education", "freelancing"],
            "records": all_records,
            "record_count": len(all_records),
            "breakdown": {
                "education": edu_result["record_count"],
                "freelancing": free_result["record_count"],
            },
            "synced_at": datetime.now(timezone.utc).isoformat(),
        }

    @classmethod
    async def create_flywheel_dataset(
        cls,
        organization_id: int,
        user_id: int,
        days_back: int = 90,
        name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Sync all pillars and create a BI dataset from the results.
        This is the main entry point for the flywheel.
        """
        from app.services.bi_services.ingestion_service import IngestionService

        sync_result = await cls.sync_all_pillars(organization_id, user_id, days_back)

        if not sync_result["records"]:
            return {
                "success": False,
                "message": "No cross-pillar data found to sync.",
                "record_count": 0,
            }

        dataset_name = name or f"Podacium Intelligence — {datetime.now(timezone.utc).strftime('%B %Y')}"

        dataset = await IngestionService.ingest_json(
            records=sync_result["records"],
            name=dataset_name,
            description=f"Auto-synced from {', '.join(sync_result['pillars_synced'])} ({sync_result['record_count']} records)",
            organization_id=str(organization_id),
            user_id=str(user_id),
            domain="cross_pillar",
        )

        return {
            "success": True,
            "dataset": dataset,
            "sync_summary": sync_result["breakdown"],
            "record_count": sync_result["record_count"],
        }
