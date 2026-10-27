import asyncio
import os
import uuid
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Tuple, Optional, Dict, Any

import aiofiles  # type: ignore[import-untyped]
import redis.asyncio as aioredis

from app.core.prisma import prisma
from app.core.redis import get_redis
from app.generated.prisma.enums import StorageProvider, UploadSessionStatus

logger = logging.getLogger(__name__)

# Magic byte signatures for video containers
ISOBMFF_MAGIC_BRANDS = [
    b"isom",
    b"mp41",
    b"mp42",
    b"qt  ",
    b"avc1",
    b"iso2",
    b"mp71",
    b"M4V ",
]
WEBM_EBML_HEADER = b"\x1a\x45\xdf\xa3"

# In-memory lock fallback when Redis is absent
_LOCAL_LOCKS: Dict[str, asyncio.Lock] = {}
_LOCAL_LOCKS_GUARD = asyncio.Lock()


class DistributedUploadLock:
    """Distributed Redis Lock (Redlock pattern) with 30s TTL and auto-renewing heartbeat."""

    def __init__(
        self,
        upload_id: str,
        ttl_seconds: int = 30,
        heartbeat_interval: float = 10.0,
    ):
        self.upload_id = upload_id
        self.lock_key = f"upload_lock:{upload_id}"
        self.token = str(uuid.uuid4())
        self.ttl = ttl_seconds
        self.heartbeat_interval = heartbeat_interval
        self._renewal_task: Optional[asyncio.Task] = None
        self._redis: Optional[aioredis.Redis] = None
        self._local_lock: Optional[asyncio.Lock] = None

    async def acquire(self) -> bool:
        """Attempt to acquire distributed Redis lock, falling back to local lock."""
        try:
            self._redis = await get_redis()
        except Exception as e:
            logger.warning(
                f"Could not reach Redis for upload lock, falling back to local: {e}"
            )
            self._redis = None

        if self._redis is not None:
            try:
                acquired = await self._redis.set(
                    self.lock_key, self.token, ex=self.ttl, nx=True
                )
                if acquired:
                    self._renewal_task = asyncio.create_task(self._heartbeat())
                    return True
                return False
            except Exception as redis_err:
                logger.warning(
                    f"Redis lock acquire failed, falling back to in-memory: {redis_err}"
                )
                self._redis = None

        # Fallback to local in-memory lock
        async with _LOCAL_LOCKS_GUARD:
            if self.upload_id not in _LOCAL_LOCKS:
                _LOCAL_LOCKS[self.upload_id] = asyncio.Lock()
            self._local_lock = _LOCAL_LOCKS[self.upload_id]

        # Non-blocking acquisition test
        if self._local_lock.locked():
            return False
        await self._local_lock.acquire()
        return True

    async def _heartbeat(self) -> None:
        """Heartbeat to renew Redis TTL while chunk stream upload is in progress."""
        lua_renew = """
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("expire", KEYS[1], ARGV[2])
        else
            return 0
        end
        """
        try:
            while True:
                await asyncio.sleep(self.heartbeat_interval)
                if self._redis:
                    client: Any = self._redis
                    res = await client.eval(
                        lua_renew, 1, self.lock_key, self.token, self.ttl
                    )
                    if not res:
                        logger.warning(
                            f"Failed to renew distributed upload lock {self.lock_key}"
                        )
                        break
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(
                f"Error in upload lock heartbeat renewal for {self.lock_key}: {e}"
            )

    async def release(self) -> None:
        """Release distributed lock and cancel heartbeat."""
        if self._renewal_task is not None:
            self._renewal_task.cancel()
            try:
                await self._renewal_task
            except asyncio.CancelledError:
                pass
            self._renewal_task = None

        if self._redis is not None:
            lua_release = """
            if redis.call("get", KEYS[1]) == ARGV[1] then
                return redis.call("del", KEYS[1])
            else
                return 0
            end
            """
            try:
                client: Any = self._redis
                await client.eval(lua_release, 1, self.lock_key, self.token)
            except Exception as e:
                logger.error(f"Error releasing Redis lock {self.lock_key}: {e}")

        if self._local_lock is not None and self._local_lock.locked():
            self._local_lock.release()


class TusUploadService:
    """TUS Protocol 1.0.0 Resumable Upload Handler with Security Validation."""

    @staticmethod
    def verify_chunk0_magic_bytes(
        header_bytes: bytes, file_name: str = ""
    ) -> Tuple[bool, str]:
        """Validate Chunk 0 magic bytes to detect disguised file extensions.

        Supports ISOBMFF (MP4, MOV, M4V), WebM (EBML), and Matroska (MKV).
        """
        if not header_bytes or len(header_bytes) < 12:
            return False, "Chunk 0 header too short for container validation"

        # Check WebM / Matroska EBML header (\x1a\x45\xdf\xa3)
        if header_bytes.startswith(WEBM_EBML_HEADER):
            ebml_sub = header_bytes[:512]
            if b"webm" in ebml_sub:
                return True, "webm"
            if b"matroska" in ebml_sub:
                return True, "mkv"
            return True, "ebml"

        # Check ISOBMFF (MP4 / MOV / M4V) ftyp box at offset 4
        # Offset 0..3: ftyp box size (big endian int32)
        # Offset 4..7: ftyp box type (b"ftyp")
        # Offset 8..11: major brand (e.g. b"isom", b"mp42", b"qt  ")
        box_type = header_bytes[4:8]
        if box_type == b"ftyp":
            major_brand = header_bytes[8:12]
            if major_brand in ISOBMFF_MAGIC_BRANDS or any(
                brand in header_bytes[:64] for brand in ISOBMFF_MAGIC_BRANDS
            ):
                return True, "mp4"

        return False, f"Invalid video container header for file '{file_name}'"

    @staticmethod
    def get_upload_file_path(upload_id: str) -> str:
        """Get safe absolute staging file path for upload session."""
        clean_id = "".join(c for c in upload_id if c.isalnum() or c in ("-", "_"))
        base_dir = os.path.join(os.getcwd(), "uploads", "video_tus")
        os.makedirs(base_dir, exist_ok=True)
        return os.path.join(base_dir, f"{clean_id}.part")

    @classmethod
    def ensure_staging_file(cls, upload_id: str) -> str:
        """Atomically create staging file without truncation if not existing."""
        path = cls.get_upload_file_path(upload_id)
        # os.O_CREAT | os.O_RDWR creates if missing, and does NOT truncate existing contents
        fd = os.open(path, os.O_CREAT | os.O_RDWR, 0o644)
        os.close(fd)
        return path

    @classmethod
    def get_upload_offset(cls, upload_id: str) -> int:
        """Get current size of uploaded bytes on disk."""
        path = cls.get_upload_file_path(upload_id)
        if os.path.exists(path):
            return os.path.getsize(path)
        return 0

    @classmethod
    @asynccontextmanager
    async def upload_lock(cls, upload_id: str):
        """Context manager for distributed Redis lock with auto-renewing heartbeat."""
        lock = DistributedUploadLock(
            upload_id=upload_id, ttl_seconds=30, heartbeat_interval=10.0
        )
        acquired = await lock.acquire()
        if not acquired:
            raise ValueError("Concurrent upload in progress for this session")
        try:
            yield
        finally:
            await lock.release()

    @classmethod
    def write_chunk(cls, upload_id: str, chunk_bytes: bytes, offset: int) -> int:
        """Append incoming binary chunk to staging file at verified offset."""
        path = cls.ensure_staging_file(upload_id)
        with open(path, "r+b") as f:
            f.seek(0, os.SEEK_END)
            current_size = f.tell()
            if offset != current_size:
                raise ValueError(
                    f"Offset mismatch: expected {current_size}, got {offset}"
                )
            f.seek(offset, os.SEEK_SET)
            f.write(chunk_bytes)
            f.flush()
            os.fsync(f.fileno())
            return f.tell()

    @classmethod
    async def write_chunk_stream(
        cls, upload_id: str, request_stream, offset: int
    ) -> int:
        """Stream binary chunks directly to disk at verified offset with Redlock and magic bytes check."""
        async with cls.upload_lock(upload_id):
            path = cls.ensure_staging_file(upload_id)
            async with aiofiles.open(path, "r+b") as f:
                await f.seek(0, os.SEEK_END)
                current_size = await f.tell()
                if offset != current_size:
                    raise ValueError(
                        f"Offset mismatch after lock: expected {current_size}, got {offset}"
                    )

                await f.seek(offset, os.SEEK_SET)

                is_first_chunk = offset == 0
                header_buffer = bytearray()
                magic_verified = not is_first_chunk

                async for chunk in request_stream:
                    if not chunk:
                        continue
                    if not magic_verified:
                        header_buffer.extend(chunk)
                        if len(header_buffer) >= 512:
                            is_valid, container = cls.verify_chunk0_magic_bytes(
                                bytes(header_buffer)
                            )
                            if not is_valid:
                                raise ValueError(
                                    f"Security rejection: Invalid video magic bytes ({container})"
                                )
                            magic_verified = True
                    await f.write(chunk)

                if not magic_verified and header_buffer:
                    is_valid, container = cls.verify_chunk0_magic_bytes(
                        bytes(header_buffer)
                    )
                    if not is_valid:
                        raise ValueError(
                            f"Security rejection: Invalid video magic bytes ({container})"
                        )
                    magic_verified = True

                await f.flush()
                # Run fsync in threadpool so it doesn't block event loop
                await asyncio.to_thread(os.fsync, f.fileno())
                return await f.tell()

    @classmethod
    def delete_upload(cls, upload_id: str) -> bool:
        """Purge staged partial upload from disk."""
        path = cls.get_upload_file_path(upload_id)
        if os.path.exists(path):
            try:
                os.remove(path)
                return True
            except OSError as e:
                logger.warning(f"Failed to remove partial upload {path}: {e}")
        return False

    @classmethod
    async def create_upload_session(
        cls,
        user_id: int,
        file_name: str,
        file_size_bytes: int,
        lesson_id: Optional[str] = None,
        provider: str = "aws",
    ) -> Dict[str, Any]:
        """Initialize TUS upload session and persist in database."""
        upload_id = str(uuid.uuid4())
        tus_id = upload_id

        provider_map = {
            "aws": StorageProvider.AWS,
            "bunny": StorageProvider.BUNNY,
            "cloudflare": StorageProvider.CLOUDFLARE,
            "youtube": StorageProvider.YOUTUBE,
            "vimeo": StorageProvider.VIMEO,
            "dailymotion": StorageProvider.DAILYMOTION,
            "supabase": StorageProvider.SUPABASE,
        }
        storage_provider = provider_map.get(provider.lower(), StorageProvider.AWS)

        expires_at = datetime.now(timezone.utc) + timedelta(hours=24)

        session = await prisma.videouploadsession.create(
            data={
                "tusId": tus_id,
                "userId": user_id,
                "lessonId": lesson_id,
                "storageProvider": storage_provider,
                "fileName": file_name,
                "fileSizeBytes": file_size_bytes,
                "uploadedBytes": 0,
                "chunkSizeBytes": 5242880,  # 5 MB default chunk
                "status": UploadSessionStatus.PENDING,
                "expiresAt": expires_at,
            }
        )

        upload_url = f"/api/v1/video/tus/{tus_id}"
        return {
            "upload_id": session.id,
            "tus_id": tus_id,
            "upload_url": upload_url,
            "file_name": file_name,
            "file_size_bytes": file_size_bytes,
            "chunk_size_bytes": 5242880,
            "expires_at": expires_at.isoformat(),
            "provider": provider,
        }

    @classmethod
    async def get_session(cls, upload_id: str) -> Optional[Any]:
        """Fetch upload session by tusId or id."""
        session = await prisma.videouploadsession.find_first(
            where={
                "OR": [
                    {"tusId": upload_id},
                    {"id": upload_id},
                ]
            }
        )
        return session

    @classmethod
    async def verify_session_access(
        cls, upload_id: str, user_id: int, is_admin: bool = False
    ) -> bool:
        """Verify user owns upload session or is admin."""
        session = await cls.get_session(upload_id)
        if not session:
            path = cls.get_upload_file_path(upload_id)
            return os.path.exists(path) and is_admin
        return is_admin or session.userId == user_id


tus_upload_service = TusUploadService()
