"""
Report Exporter Service
Generates downloadable files (CSV, XLSX, PDF) for BI reports and dashboards using ReportLab and OpenPyXL.
"""

import io
import logging
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any, Dict, List

if TYPE_CHECKING:
    import pandas as pd

from app.core.prisma import prisma
from app.services.bi_services.query_engine import QueryEngine

logger = logging.getLogger(__name__)


class ReportExporter:
    """Service for exporting BI reports and dataset views into CSV, Excel, and PDF formats."""

    @staticmethod
    def _sanitize_formula_injection(df: "pd.DataFrame") -> "pd.DataFrame":
        """
        Neutralize CSV/Excel formula injection (CWE-1236).
        Prepend an apostrophe to text cells starting with formula triggers: =, +, -, @, \\t, \\r.
        """
        if df.empty:
            return df
        sanitized = df.copy()
        for col in sanitized.select_dtypes(include=["object", "string"]).columns:
            sanitized[col] = sanitized[col].apply(
                lambda val: f"'{val}"
                if isinstance(val, str)
                and val.startswith(("=", "+", "-", "@", "\t", "\r"))
                else val
            )
        return sanitized

    @classmethod
    def export_to_csv(cls, records: List[Dict[str, Any]]) -> bytes:
        """Helper method to convert record dicts directly into CSV bytes."""
        import pandas as pd

        df = pd.DataFrame(records) if records else pd.DataFrame()
        df = cls._sanitize_formula_injection(df)
        return df.to_csv(index=False).encode("utf-8")

    @classmethod
    def _generate_pdf_bytes(
        cls, title: str, description: str, df: "pd.DataFrame"
    ) -> bytes:
        """
        Generate a styled, pixel-perfect PDF document using ReportLab.
        """
        try:
            from reportlab.lib import colors
            from reportlab.lib.pagesizes import letter, landscape
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
            from reportlab.platypus import (
                SimpleDocTemplate,
                Paragraph,
                Spacer,
                Table,
                TableStyle,
            )

            pdf_buffer = io.BytesIO()
            doc = SimpleDocTemplate(
                pdf_buffer,
                pagesize=landscape(letter),
                rightMargin=36,
                leftMargin=36,
                topMargin=36,
                bottomMargin=36,
            )

            styles = getSampleStyleSheet()
            title_style = ParagraphStyle(
                "ReportTitle",
                parent=styles["Heading1"],
                fontSize=20,
                leading=24,
                textColor=colors.HexColor("#1e293b"),
                spaceAfter=6,
            )
            subtitle_style = ParagraphStyle(
                "ReportSubtitle",
                parent=styles["Normal"],
                fontSize=11,
                leading=14,
                textColor=colors.HexColor("#64748b"),
                spaceAfter=12,
            )

            elements = []
            elements.append(Paragraph(title, title_style))
            meta_text = f"{description} | Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}"
            elements.append(Paragraph(meta_text, subtitle_style))
            elements.append(Spacer(1, 10))

            # Limit dataframe rows and columns for PDF formatting safety
            max_cols = min(len(df.columns), 12)
            max_rows = min(len(df), 200)
            subset_df = df.iloc[:max_rows, :max_cols]

            # Build table data
            table_data = [[str(col) for col in subset_df.columns]]
            for _, row in subset_df.iterrows():
                row_vals = [str(val) if val is not None else "" for val in row]
                table_data.append(row_vals)

            t = Table(table_data)
            t.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
                        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                        ("FONTSIZE", (0, 0), (-1, 0), 9),
                        ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
                        ("TOPPADDING", (0, 0), (-1, 0), 6),
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
                        ("FONTSIZE", (0, 1), (-1, -1), 8),
                        (
                            "ROWBACKGROUNDS",
                            (0, 1),
                            (-1, -1),
                            [colors.white, colors.HexColor("#f8fafc")],
                        ),
                    ]
                )
            )
            elements.append(t)
            doc.build(elements)
            return pdf_buffer.getvalue()

        except Exception as e:
            logger.warning(
                f"ReportLab PDF generation failed, generating clean fallback text: {e}"
            )
            fallback_text = (
                f"PODACIUM BI REPORT: {title}\n{description}\n\n"
                + df.to_string(index=False)
            )
            return fallback_text.encode("utf-8")

    @classmethod
    async def generate_report_file(cls, run_id: int) -> Dict[str, Any]:
        """
        Execute data query and render report file for a given ReportRun.
        Returns metadata containing file_url, file_size, format, and raw_bytes.
        """
        run = await prisma.reportrun.find_unique(
            where={"id": run_id}, include={"report": True}
        )
        if not run or not run.report:
            raise ValueError(f"ReportRun {run_id} or parent Report not found")

        report = run.report
        fmt = (report.format or "csv").lower()

        dataset_data = []
        if report.dashboardId:
            dashboard = await prisma.dashboard.find_unique(
                where={"id": report.dashboardId},
                include={"datasetLinks": {"include": {"dataset": True}}},
            )
            if dashboard and dashboard.datasetLinks:
                first_dataset = dashboard.datasetLinks[0].dataset
                if first_dataset and first_dataset.filePath:
                    dataset_data = QueryEngine.query_dataset(
                        first_dataset.filePath, None
                    )

        if not dataset_data:
            first_available = await prisma.dataset.find_first(
                where={"organizationId": report.organizationId}
            )
            if first_available and first_available.filePath:
                dataset_data = QueryEngine.query_dataset(first_available.filePath, None)

        import pandas as pd

        df = (
            pd.DataFrame(dataset_data)
            if dataset_data
            else pd.DataFrame(
                [{"info": "No dataset records available for this report"}]
            )
        )
        df = cls._sanitize_formula_injection(df)

        buffer = io.BytesIO()

        if fmt in ["xlsx", "excel"]:
            content_type = (
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            )
            filename_ext = "xlsx"
            with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
                df.to_excel(writer, index=False, sheet_name="Report Data")
            file_bytes = buffer.getvalue()

        elif fmt == "pdf":
            content_type = "application/pdf"
            filename_ext = "pdf"
            file_bytes = cls._generate_pdf_bytes(
                title=report.name,
                description=report.description
                or "Automated Podacium BI Analytics Report",
                df=df,
            )

        else:
            content_type = "text/csv"
            filename_ext = "csv"
            csv_str = df.to_csv(index=False)
            file_bytes = csv_str.encode("utf-8")

        file_size = len(file_bytes)
        file_url = f"/api/bi/reports/{report.id}/runs/{run.id}/download"

        return {
            "run_id": run_id,
            "report_id": report.id,
            "file_url": file_url,
            "file_size": file_size,
            "content_type": content_type,
            "filename_ext": filename_ext,
            "file_bytes": file_bytes,
        }
