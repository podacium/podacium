"""
Data Lineage Service
Generates OpenLineage specification JSON dependency graphs mapping physical datasets -> dashboards -> widgets -> reports -> ML models.
"""

import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from app.core.prisma import prisma

logger = logging.getLogger(__name__)


class DataLineageService:
    """Service for extracting data lineage dependencies and column-level maps across BI objects."""

    @classmethod
    def _extract_column_references(cls, sql_query: Optional[str]) -> List[str]:
        """Extract referenced column names from widget or dataset SQL queries using regex."""
        if not sql_query:
            return []
        matches = re.findall(r'"([a-zA-Z0-9_\-\.]+)"', sql_query)
        return list(set(matches))

    @classmethod
    async def get_dataset_lineage(cls, dataset_id: int, organization_id: int) -> Dict[str, Any]:
        """
        Build OpenLineage-compliant DAG for a specific dataset.
        """
        dataset = await prisma.dataset.find_unique(
            where={"id": dataset_id},
            include={
                "dashboardLinks": {"include": {"dashboard": True}},
                "widgets": True,
                "mlModels": True,
                "decisions": True,
            }
        )
        if not dataset or dataset.organizationId != organization_id:
            raise ValueError(f"Dataset {dataset_id} not found or unauthorized")

        nodes = [
            {
                "id": f"dataset_{dataset.id}",
                "type": "dataset",
                "name": dataset.name,
                "format": dataset.format or "parquet",
                "rowCount": dataset.rowCount,
                "columnCount": dataset.columnCount,
            }
        ]
        edges = []

        # Connected Dashboards
        for db_link in (dataset.dashboardLinks or []):
            db = db_link.dashboard
            if db:
                db_node_id = f"dashboard_{db.id}"
                nodes.append({
                    "id": db_node_id,
                    "type": "dashboard",
                    "name": db.title,
                    "isPublic": db.isPublic,
                })
                edges.append({
                    "source": f"dataset_{dataset.id}",
                    "target": db_node_id,
                    "relation": "FEEDS_DASHBOARD",
                })

                # Downstream Reports
                reports = await prisma.report.find_many(where={"dashboardId": db.id})
                for r in reports:
                    report_node_id = f"report_{r.id}"
                    nodes.append({
                        "id": report_node_id,
                        "type": "report",
                        "name": r.name,
                        "format": r.format,
                        "scheduleType": r.scheduleType,
                    })
                    edges.append({
                        "source": db_node_id,
                        "target": report_node_id,
                        "relation": "GENERATES_REPORT",
                    })

        # Connected Widgets
        for w in (dataset.widgets or []):
            widget_node_id = f"widget_{w.id}"
            referenced_cols = []
            if isinstance(w.config, dict):
                sql_q = w.config.get("sql") or w.config.get("query")
                referenced_cols = cls._extract_column_references(sql_q)

            nodes.append({
                "id": widget_node_id,
                "type": "widget",
                "name": w.name or f"Widget #{w.id}",
                "chartType": w.type.name.lower() if hasattr(w.type, "name") else str(w.type).lower(),
                "columnsUsed": referenced_cols,
            })
            edges.append({
                "source": f"dataset_{dataset.id}",
                "target": widget_node_id,
                "relation": "VISUALIZES_DATA",
            })

        # Connected ML Models
        for m in (dataset.mlModels or []):
            model_node_id = f"ml_model_{m.id}"
            nodes.append({
                "id": model_node_id,
                "type": "ml_model",
                "name": m.name,
                "modelType": m.type,
            })
            edges.append({
                "source": f"dataset_{dataset.id}",
                "target": model_node_id,
                "relation": "TRAINS_MODEL",
            })

        # Connected Decisions
        for dec in (dataset.decisions or []):
            dec_node_id = f"decision_{dec.id}"
            nodes.append({
                "id": dec_node_id,
                "type": "decision",
                "name": dec.title,
                "status": dec.status,
            })
            edges.append({
                "source": f"dataset_{dataset.id}",
                "target": dec_node_id,
                "relation": "INFORMS_DECISION",
            })

        return {
            "dataset_id": dataset_id,
            "organization_id": organization_id,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "lineage_dag": {
                "nodes": nodes,
                "edges": edges,
                "total_nodes": len(nodes),
                "total_edges": len(edges),
            }
        }

    @classmethod
    async def get_organization_lineage(cls, organization_id: int) -> Dict[str, Any]:
        """
        Build complete organization-wide data lineage graph.
        """
        datasets = await prisma.dataset.find_many(
            where={"organizationId": organization_id, "deletedAt": None}
        )
        all_nodes = []
        all_edges = []

        for ds in datasets:
            single = await cls.get_dataset_lineage(ds.id, organization_id)
            dag = single.get("lineage_dag", {})
            all_nodes.extend(dag.get("nodes", []))
            all_edges.extend(dag.get("edges", []))

        # Deduplicate nodes by id
        unique_nodes = {n["id"]: n for n in all_nodes}.values()

        return {
            "organization_id": organization_id,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "lineage_dag": {
                "nodes": list(unique_nodes),
                "edges": all_edges,
                "total_nodes": len(unique_nodes),
                "total_edges": len(all_edges),
            }
        }
