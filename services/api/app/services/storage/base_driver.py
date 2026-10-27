"""
Base Storage Driver Interface
Defines the contract for all storage providers (Local VPS, GCS, R2, Bunny, S3).
"""

from abc import ABC, abstractmethod
from typing import Dict, Optional
from dataclasses import dataclass


@dataclass
class UploadTicket:
    upload_url: str
    file_key: str
    method: str = "PUT"
    headers: Optional[Dict[str, str]] = None
    is_cloud: bool = False
    expires_in_seconds: int = 900
    category: str = "attachments"
    driver_name: str = "local"


class BaseStorageDriver(ABC):
    """Abstract base class for all file storage providers."""

    @property
    @abstractmethod
    def driver_name(self) -> str:
        """Name of the driver (e.g. 'local', 'gcs', 'r2', 'bunny', 's3')."""
        pass

    @property
    @abstractmethod
    def is_sovereign(self) -> bool:
        """True if storage is physically located on national sovereign infrastructure."""
        pass

    @abstractmethod
    async def upload_file(
        self,
        content: bytes,
        key: str,
        content_type: str,
        is_public: bool = False,
    ) -> str:
        """
        Directly upload bytes to the storage backend.
        Returns the resolved URL or relative path.
        """
        pass

    @abstractmethod
    async def generate_presigned_upload_ticket(
        self,
        key: str,
        content_type: str,
        max_size_bytes: int,
        category: str = "attachments",
        expires_in: int = 900,
    ) -> UploadTicket:
        """
        Generate an upload ticket (presigned PUT/POST URL for cloud, or local streaming endpoint).
        """
        pass

    @abstractmethod
    async def generate_download_url(
        self,
        key: str,
        filename: Optional[str] = None,
        expires_in: int = 900,
    ) -> str:
        """
        Generate a download URL (signed time-limited URL for cloud, or relative URL for local).
        """
        pass

    @abstractmethod
    async def delete_file(self, key: str) -> bool:
        """Delete a file from the storage backend."""
        pass

    @abstractmethod
    async def file_exists(self, key: str) -> bool:
        """Check if a file exists in the storage backend."""
        pass

    @abstractmethod
    async def read_file_bytes(self, key: str) -> Optional[bytes]:
        """Read file contents as raw bytes."""
        pass
