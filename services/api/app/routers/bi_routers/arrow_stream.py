"""
Apache Arrow IPC Binary Streaming Router for Podacium BI
Streams DuckDB query results directly as zero-copy Apache Arrow IPC binary streams.
"""

import io
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from app.core.auth import get_current_user, verify_organization_access
from app.core.prisma import prisma
from app.services.bi_services.query_engine import QueryEngine

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/arrow", tags=["bi-arrow"])


@router.get("/stream", response_class=StreamingResponse)
async def stream_dataset_arrow(
    file_path: Optional[str] = Query(None, description="Path to Parquet/CSV dataset"),
    dataset_id: Optional[int] = Query(None, description="Target Dataset ID"),
    organization_id: Optional[int] = Query(None, description="Organization ID"),
    limit: int = Query(50000, ge=1, le=500000),
    current_user=Depends(get_current_user),
):
    """
    Stream dataset query results directly as Apache Arrow IPC binary stream.
    Provides zero-copy serialization for high-density WebGL/WebGPU client renderers.
    """
    org_id = await verify_organization_access(organization_id, current_user)

    target_path = file_path
    if dataset_id:
        ds = await prisma.dataset.find_unique(where={"id": dataset_id})
        if not ds or ds.organizationId != org_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Unauthorized access to requested dataset",
            )
        target_path = ds.filePath
    elif file_path:
        ds = await prisma.dataset.find_first(
            where={"filePath": file_path, "organizationId": org_id, "deletedAt": None}
        )
        if not ds:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Unauthorized access to requested file path",
            )
        target_path = ds.filePath
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either dataset_id or file_path must be provided",
        )

    if not target_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset does not have an associated file path",
        )

    try:
        file_path_str = QueryEngine._validate_path_security(target_path)
        con = QueryEngine.get_connection()
        try:
            table_name = QueryEngine._register_dataset_table(con, file_path_str)

            # Inspect schema to check if organization_id column exists
            schema = QueryEngine.get_dataset_schema(file_path_str)
            col_names = [col["name"] for col in schema]

            if "organization_id" in col_names:
                sql = f"SELECT * FROM {table_name} WHERE organization_id = {int(org_id)} LIMIT {min(limit, 500000)}"
            else:
                sql = f"SELECT * FROM {table_name} LIMIT {min(limit, 500000)}"

            # Execute query directly into PyArrow Table via DuckDB Arrow interface
            try:
                import pyarrow.ipc as ipc
            except ImportError:
                raise HTTPException(
                    status_code=status.HTTP_501_NOT_IMPLEMENTED,
                    detail="Apache Arrow IPC support requires pyarrow installed on the server",
                )

            arrow_table = con.query(sql).arrow()
        finally:
            QueryEngine.release_connection(con)

        # Stream PyArrow IPC binary stream
        def iter_arrow_ipc():
            sink = io.BytesIO()
            writer = ipc.new_stream(sink, arrow_table.schema)

            for batch in arrow_table.to_batches():
                sink.seek(0)
                sink.truncate(0)
                writer.write_batch(batch)
                yield sink.getvalue()

            sink.seek(0)
            sink.truncate(0)
            writer.close()
            yield sink.getvalue()

        return StreamingResponse(
            iter_arrow_ipc(),
            media_type="application/vnd.apache.arrow.stream",
            headers={
                "Content-Disposition": "attachment; filename=dataset.arrow",
                "X-Arrow-Record-Count": str(arrow_table.num_rows),
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Arrow IPC streaming failed: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Arrow IPC stream failed: {str(e)}",
        )
