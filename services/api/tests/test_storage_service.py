"""
Storage Service & Data Sovereignty Tests
Verifies local storage, direct upload ticket generation, category routing, and Algerian Law 18-07 data sovereignty rules.
"""

import pytest
from app.services.storage import (
    StorageManager,
    LocalStorageDriver,
    UploadTicket,
    storage_manager,
)


@pytest.mark.asyncio
async def test_local_storage_driver_crud(tmp_path):
    driver = LocalStorageDriver(base_dir=str(tmp_path))
    assert driver.driver_name == "local"
    assert driver.is_sovereign is True

    test_bytes = b"Hello, Podacium Sovereign Storage!"
    key = "test_category/sample.txt"

    # Upload
    url = await driver.upload_file(test_bytes, key, "text/plain")
    assert url == "/static/test_category/sample.txt"

    # Exists
    exists = await driver.file_exists(key)
    assert exists is True

    # Read
    read_bytes = await driver.read_file_bytes(key)
    assert read_bytes == test_bytes

    # X-Accel-Redirect path for Nginx
    x_accel = driver.get_x_accel_path(key)
    assert x_accel == "/internal-uploads/test_category/sample.txt"

    # Presigned ticket
    ticket = await driver.generate_presigned_upload_ticket(
        key="test_category/new.txt",
        content_type="text/plain",
        max_size_bytes=1024 * 1024,
        category="test_category",
    )
    assert isinstance(ticket, UploadTicket)
    assert ticket.is_cloud is False
    assert "/api/files/upload" in ticket.upload_url

    # Delete
    deleted = await driver.delete_file(key)
    assert deleted is True
    assert await driver.file_exists(key) is False


def test_data_sovereignty_category_classification():
    manager = StorageManager()

    # Law 18-07 protected categories
    assert manager.is_sovereign_category("invoices") is True
    assert manager.is_sovereign_category("attachments") is True
    assert manager.is_sovereign_category("contracts") is True
    assert manager.is_sovereign_category("identities") is True

    # Public categories
    assert manager.is_sovereign_category("avatars") is False
    assert manager.is_sovereign_category("public") is False


@pytest.mark.asyncio
async def test_storage_manager_routing():
    # Verify local driver is default
    driver = storage_manager.get_driver("invoices")
    assert driver.is_sovereign is True
    assert driver.driver_name == "local"

    # Test ticket generation via storage manager
    ticket = await storage_manager.generate_presigned_upload_ticket(
        filename="test_dataset.csv",
        category="datasets",
        content_type="text/csv",
        max_size_bytes=5 * 1024 * 1024,
    )
    assert ticket.category == "datasets"
    assert ticket.file_key.startswith("datasets/")
