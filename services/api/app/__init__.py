"""
Podacium API Application Package.

Initializes root package and applies runtime memory optimizations.
"""

import sys
import types as _py_types
from typing import Any, Dict, List, Union
import datetime

# =============================================================================
# MEMORY OPTIMIZATION: Prisma Types Runtime Proxy
# =============================================================================
# app.generated.prisma.types contains 567,809 lines of static TypedDict / Literal
# definitions for 146 models. Parsing this monolithic file into the Python heap
# consumes ~430 MB of RAM with ZERO executable logic at runtime.
# By installing this dynamic proxy before app.generated.prisma is imported,
# runtime queries run at full speed with 430 MB lower RAM usage.
# Static typecheckers (mypy / pyright) inspect types.py on disk and are unaffected.
if "app.generated.prisma.types" not in sys.modules:

    class _PrismaLazyTypes(_py_types.ModuleType):
        Serializable = Union[
            None, bool, float, int, str, datetime.datetime, List[Any], Dict[Any, Any]
        ]

        def __getattr__(self, name: str) -> Any:
            return object

    sys.modules["app.generated.prisma.types"] = _PrismaLazyTypes(
        "app.generated.prisma.types"
    )
