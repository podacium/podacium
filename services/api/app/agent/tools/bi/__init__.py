"""
BI Domain Tools Package.
"""

from typing import List
from app.agent.tools.base import BaseTool
from app.agent.tools.bi.dashboards import (
    ListDashboardsTool,
    GetDashboardWidgetsTool,
    CreateDashboardTool,
)
from app.agent.tools.bi.query import (
    PreviewDatasetSchemaTool,
    QueryDatasetSqlTool,
)
from app.agent.tools.bi.analytics import GetDatasetKpisTool
from app.agent.tools.bi.widgets import AddChartWidgetTool
from app.agent.tools.bi.dlg_parser import ParseDlgAccountingFileTool
from app.agent.tools.bi.python_sandbox import RunPythonSandboxTool
from app.agent.tools.bi.kridi_reports import GenerateKridiAgingReportTool
from app.agent.tools.bi.batch_reports import (
    BatchExportBiReportsTool,
    BatchDatasetMetricsTool,
    ForecastRevenueMetricsTool,
)

BI_TOOLS: List[BaseTool] = [
    ListDashboardsTool(),
    GetDashboardWidgetsTool(),
    PreviewDatasetSchemaTool(),
    QueryDatasetSqlTool(),
    GetDatasetKpisTool(),
    CreateDashboardTool(),
    AddChartWidgetTool(),
    ParseDlgAccountingFileTool(),
    RunPythonSandboxTool(),
    GenerateKridiAgingReportTool(),
    BatchExportBiReportsTool(),
    BatchDatasetMetricsTool(),
    ForecastRevenueMetricsTool(),
]

__all__ = [
    "ListDashboardsTool",
    "GetDashboardWidgetsTool",
    "PreviewDatasetSchemaTool",
    "QueryDatasetSqlTool",
    "GetDatasetKpisTool",
    "CreateDashboardTool",
    "AddChartWidgetTool",
    "ParseDlgAccountingFileTool",
    "RunPythonSandboxTool",
    "GenerateKridiAgingReportTool",
    "BatchExportBiReportsTool",
    "BatchDatasetMetricsTool",
    "ForecastRevenueMetricsTool",
    "BI_TOOLS",
]
