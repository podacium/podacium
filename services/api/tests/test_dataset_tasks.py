"""
Unit tests for background Celery dataset ingestion tasks.
Verifies retry resilience and error handling behavior.
"""

from unittest.mock import MagicMock, patch
import pytest

from app.tasks.dataset_tasks import process_dataset_task


class TestDatasetTasksRetryResilience:
    @pytest.fixture(autouse=True)
    def setup_mocks(self):
        with (
            patch("app.tasks.dataset_tasks.limit_resources"),
            patch("app.tasks.dataset_tasks.run_async") as mock_run_async,
        ):
            self.mock_run_async = mock_run_async
            yield

    def test_retry_on_intermediate_failure_does_not_mark_failed(self):
        """On transient error with retries < max_retries, task retries without setting status to FAILED."""
        with patch.object(
            process_dataset_task, "retry", MagicMock(side_effect=Exception("Retrying"))
        ) as mock_retry:
            with patch("pandas.read_csv", side_effect=ValueError("Corrupted CSV")):
                with pytest.raises(Exception, match="Retrying"):
                    process_dataset_task.apply(
                        args=(10, "/tmp/test.csv", 1, 42, "test.csv", "SALES"),
                        retries=1,
                        throw=True,
                    )
            mock_retry.assert_called_once()

    def test_max_retries_exceeded_marks_failed(self):
        """When retries reach max_retries, dataset status is set to FAILED."""
        with patch.object(process_dataset_task, "retry", MagicMock()) as mock_retry:
            with patch("pandas.read_csv", side_effect=ValueError("Corrupted CSV")):
                with pytest.raises(ValueError, match="Corrupted CSV"):
                    process_dataset_task.apply(
                        args=(10, "/tmp/test.csv", 1, 42, "test.csv", "SALES"),
                        retries=3,
                        throw=True,
                    )
            mock_retry.assert_not_called()
            assert self.mock_run_async.call_count >= 2

    def test_memory_error_unrecoverable_marks_failed(self):
        """When MemoryError is raised, task immediately marks dataset FAILED."""
        with patch.object(
            process_dataset_task, "update_state", MagicMock()
        ) as mock_update_state:
            with patch("pandas.read_csv", side_effect=MemoryError("Out of memory")):
                process_dataset_task.apply(
                    args=(10, "/tmp/test.csv", 1, 42, "test.csv", "SALES"),
                    retries=0,
                )
            mock_update_state.assert_called_once_with(
                state="FAILURE", meta={"error": "Worker out-of-memory"}
            )
            assert self.mock_run_async.call_count >= 2
