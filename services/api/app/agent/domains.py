"""
services/api/app/agent/domains.py
Dependency-free domain partitions shared by the intent router and the tool registry.

Kept in its own module so lightweight components (e.g. the intent classifier)
can import it without pulling in the full tool catalog and its service imports.
"""

from enum import Enum


class ToolDomain(str, Enum):
    """The 5 functional domain partitions of Podacium."""

    EDTECH = "EDTECH"
    FREELANCE = "FREELANCE"
    BI = "BI"
    FINTECH = "FINTECH"
    CORE = "CORE"
