"""
services/api/app/agent/security/sql_guardrails.py
Module alias / compatibility layer for sql_guardrail.py.
"""

from app.agent.security.sql_guardrail import (
    DuckDbAstSecurityVisitor,
    SecurityAstViolation,
)

__all__ = ["DuckDbAstSecurityVisitor", "SecurityAstViolation"]
