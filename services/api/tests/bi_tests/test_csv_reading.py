import os
import tempfile
from app.services.bi_services.ingestion_service import IngestionService


def test_safe_read_csv_bad_lines():
    # Create CSV with malformed row (header has 2 cols, row 2 has 4 cols)
    content = "col_a,col_b\nval1,val2\nextra1,extra2,extra3,extra4\nval3,val4\n"
    with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
        f.write(content)
        temp_path = f.name

    try:
        df = IngestionService.safe_read_csv(temp_path)
        assert len(df) == 2  # The 4-column malformed row should be skipped cleanly
        assert list(df.columns) == ["col_a", "col_b"]
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
