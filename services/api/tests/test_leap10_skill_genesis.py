"""
tests/test_leap10_skill_genesis.py
Unit tests for Leap 10: Autonomous Self-Evolving Skill Genesis Engine.
"""

import pytest
from app.agent.skills.genesis import (
    SkillGenesisEngine,
    SecurityViolationException,
)
from app.agent.tools.registry import ToolRegistry
from app.agent.context import AgentSecurityContext
from app.schemas.auth import UserRole


@pytest.fixture
def genesis_engine():
    # Use isolated test registry instance
    isolated_registry = ToolRegistry()
    return SkillGenesisEngine(registry=isolated_registry)


def test_ast_security_blocks_forbidden_imports(genesis_engine):
    unsafe_code = """
import os
from app.agent.tools.base import BaseTool
class DangerousTool(BaseTool):
    async def execute(self, args, context):
        os.system('id')
"""
    with pytest.raises(SecurityViolationException, match="FORBIDDEN_IMPORT"):
        genesis_engine.compile_and_instantiate(unsafe_code)


def test_ast_security_blocks_forbidden_calls(genesis_engine):
    unsafe_code = """
from app.agent.tools.base import BaseTool
class EvalTool(BaseTool):
    async def execute(self, args, context):
        eval("1 + 1")
"""
    with pytest.raises(SecurityViolationException, match="FORBIDDEN_CALL"):
        genesis_engine.compile_and_instantiate(unsafe_code)


def test_ast_security_blocks_dunder_attribute_escapes(genesis_engine):
    unsafe_code = """
from app.agent.tools.base import BaseTool
class EscapeTool(BaseTool):
    async def execute(self, args, context):
        x = ().__class__.__subclasses__()
"""
    with pytest.raises(SecurityViolationException, match="FORBIDDEN_ATTRIBUTE"):
        genesis_engine.compile_and_instantiate(unsafe_code)


@pytest.mark.asyncio
async def test_compile_instantiate_hot_load_and_execute(genesis_engine):
    safe_code = """
from app.agent.tools.base import BaseTool, ToolResult, ToolDomain
from app.agent.context import AgentSecurityContext
from pydantic import BaseModel, Field

class CurrencyConverterArgs(BaseModel):
    dzd_amount: float = Field(..., description="Amount in Algerian Dinars")

class DynamicCurrencyConverterTool(BaseTool):
    name: str = "dynamic_currency_converter"
    description: str = "Converts DZD to EUR at Bank of Algeria official rate"
    domain: ToolDomain = ToolDomain.FINTECH
    args_schema: type[BaseModel] = CurrencyConverterArgs

    async def execute(self, args: CurrencyConverterArgs, context: AgentSecurityContext) -> ToolResult:
        eur_rate = 145.50
        eur_amount = round(args.dzd_amount / eur_rate, 2)
        return ToolResult(
            success=True,
            data={"dzd": args.dzd_amount, "eur": eur_amount, "rate": eur_rate}
        )
"""
    tool = genesis_engine.validate_and_load(safe_code)
    assert tool.name == "dynamic_currency_converter"

    # Verify tool is registered in the isolated registry
    found = genesis_engine.registry.get_tool("dynamic_currency_converter")
    assert found is not None
    assert found.name == "dynamic_currency_converter"

    # Test tool invocation via .call()
    ctx = AgentSecurityContext(user_id=1, user_role=UserRole.ADMIN)
    result = await found.call({"dzd_amount": 145500}, ctx)
    assert result.success is True
    assert result.data["eur"] == 1000.0

    # Test tool unregistering
    unregistered = genesis_engine.unregister_dynamic_tool("dynamic_currency_converter")
    assert unregistered is True
    assert genesis_engine.registry.get_tool("dynamic_currency_converter") is None
