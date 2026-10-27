import re
from fastapi import Request, HTTPException

SQL_INJECTION_PATTERNS = [
    r"(\b(select|insert|update|delete|drop|alter|create|truncate|exec|execute|union)\b.*\b(from|into|set|where|table|database|values)\b)",
    r"'.*\s*or\s*'.*'.*\s*=\s*'",
    r"--\s*$",
    r";\s*$",
]


def _is_suspicious(value: str) -> bool:
    for pattern in SQL_INJECTION_PATTERNS:
        if re.search(pattern, value, re.IGNORECASE):
            return True
    return False


async def sql_injection_middleware(request: Request, call_next):
    if request.method in ("GET", "DELETE"):
        for value in request.query_params.values():
            if _is_suspicious(value):
                raise HTTPException(status_code=400, detail="Invalid query parameters")
    elif request.method in ("POST", "PUT", "PATCH"):
        body = await request.body()
        if body:
            try:
                decoded = body.decode("utf-8", errors="ignore")
                if _is_suspicious(decoded):
                    raise HTTPException(status_code=400, detail="Invalid request body")
            except Exception:
                pass
    return await call_next(request)
