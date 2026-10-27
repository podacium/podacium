"""Unit tests for Tus Resumable Upload Service, Distributed Redlock, and Abandoned Cleanup."""

import os
import time
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.video.tus_service import (
    TusUploadService,
    DistributedUploadLock,
    WEBM_EBML_HEADER,
)
from app.tasks.video_tasks import purge_abandoned_uploads


def test_magic_bytes_validation():
    """Verify robust ISOBMFF and Matroska container magic bytes validation."""
    # 1. Valid MP4 header (ftyp box at offset 4 with isom brand)
    valid_mp4 = b"\x00\x00\x00\x1cftypisom\x00\x00\x02\x00isomiso2mp41"
    is_valid, container = TusUploadService.verify_chunk0_magic_bytes(
        valid_mp4, "lecture.mp4"
    )
    assert is_valid is True
    assert container == "mp4"

    # 2. Valid WebM header
    valid_webm = WEBM_EBML_HEADER + b"\x42\x82\x84webm" + b"\x00" * 20
    is_valid, container = TusUploadService.verify_chunk0_magic_bytes(
        valid_webm, "lecture.webm"
    )
    assert is_valid is True
    assert container == "webm"

    # 3. Valid MKV header
    valid_mkv = WEBM_EBML_HEADER + b"\x42\x82\x88matroska" + b"\x00" * 20
    is_valid, container = TusUploadService.verify_chunk0_magic_bytes(
        valid_mkv, "lecture.mkv"
    )
    assert is_valid is True
    assert container == "mkv"

    # 4. Truncated header (< 12 bytes)
    is_valid, err = TusUploadService.verify_chunk0_magic_bytes(
        b"\x00\x00\x00\x04", "short.mp4"
    )
    assert is_valid is False
    assert "too short" in err

    # 5. Invalid / spoofed binary (e.g. ELF or Windows PE executable)
    fake_exe = b"\x7fELF" + b"\x01\x01\x01\x00" * 10
    is_valid, err = TusUploadService.verify_chunk0_magic_bytes(fake_exe, "malware.mp4")
    assert is_valid is False
    assert "Invalid video container header" in err


@pytest.mark.asyncio
async def test_distributed_upload_lock_concurrency():
    """Test that concurrent lock acquisitions for the same upload_id reject conflicts."""
    upload_id = "test-lock-sess-123"

    lock1 = DistributedUploadLock(upload_id=upload_id, ttl_seconds=5)
    acquired1 = await lock1.acquire()
    assert acquired1 is True

    # Concurrent acquisition while lock1 is held must fail
    lock2 = DistributedUploadLock(upload_id=upload_id, ttl_seconds=5)
    acquired2 = await lock2.acquire()
    assert acquired2 is False

    # After releasing lock1, lock2 must be able to acquire
    await lock1.release()
    acquired2_retry = await lock2.acquire()
    assert acquired2_retry is True
    await lock2.release()


@pytest.mark.asyncio
async def test_write_chunk_offset_mismatch_raises_value_error(tmp_path):
    """Writing a chunk at an unexpected offset raises ValueError for 409 Conflict mapping."""
    upload_id = "offset-mismatch-test"

    # Mock staging path inside tmp_path
    staging_file = tmp_path / f"{upload_id}.part"
    staging_file.write_bytes(b"HELLO")  # 5 bytes

    with patch.object(
        TusUploadService, "get_upload_file_path", return_value=str(staging_file)
    ):
        with pytest.raises(ValueError, match="Offset mismatch"):
            # Request offset is 0, but disk already has 5 bytes
            TusUploadService.write_chunk(upload_id, b"WORLD", offset=0)

        # Correct offset succeeds
        new_offset = TusUploadService.write_chunk(upload_id, b"WORLD", offset=5)
        assert new_offset == 10
        assert staging_file.read_bytes() == b"HELLOWORLD"


@patch("app.tasks.video_tasks.connect_prisma")
@patch("app.tasks.video_tasks.disconnect_prisma")
@patch("app.core.prisma.prisma.videouploadsession.find_many")
@patch("app.core.prisma.prisma.videouploadsession.update")
def test_purge_abandoned_uploads(
    mock_update, mock_find_many, mock_disc, mock_conn, tmp_path
):
    """purge_abandoned_uploads unlinks stale .part files and marks DB sessions EXPIRED."""
    mock_conn.return_value = None
    mock_disc.return_value = None

    # Create dummy staging files: one linked to DB, one orphaned without DB, one fresh
    uploads_dir = tmp_path / "uploads" / "video_tus"
    uploads_dir.mkdir(parents=True)

    stale_file = uploads_dir / "stale-upload.part"
    stale_file.write_bytes(b"stale data")

    orphaned_file = uploads_dir / "orphaned-without-db.part"
    orphaned_file.write_bytes(b"orphaned data")
    past_mtime = time.time() - (30 * 3600)
    os.utime(str(orphaned_file), (past_mtime, past_mtime))

    fresh_file = uploads_dir / "fresh-upload.part"
    fresh_file.write_bytes(b"fresh data")

    # Mock DB session matching stale_file
    stale_session = MagicMock(id="sess-stale", tusId="stale-upload")
    mock_find_many.side_effect = AsyncMock(return_value=[stale_session])
    mock_update.side_effect = AsyncMock(return_value=stale_session)

    with patch("os.getcwd", return_value=str(tmp_path)):
        res = purge_abandoned_uploads()

    assert res["purged_sessions"] == 1
    assert res["purged_files"] == 1
    assert not stale_file.exists()
    assert not orphaned_file.exists()
    assert fresh_file.exists()
