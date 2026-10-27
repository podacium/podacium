import uuid
from fastapi import Request


async def correlation_middleware(request: Request, call_next):
    rid = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    from app.core.logging_config import set_request_id
    set_request_id(rid)
    response = await call_next(request)
    response.headers["X-Request-ID"] = rid
    return response
