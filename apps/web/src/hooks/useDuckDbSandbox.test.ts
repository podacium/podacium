import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useDuckDbSandbox } from "./useDuckDbSandbox";

describe("useDuckDbSandbox hook", () => {
  it("initializes and provides query, registration, and Arrow extraction methods", async () => {
    const { result } = renderHook(() => useDuckDbSandbox());

    expect(result.current.query).toBeDefined();
    expect(result.current.registerCsv).toBeDefined();
    expect(result.current.registerParquet).toBeDefined();
    expect(result.current.extractArrowRecordBatches).toBeDefined();
    expect(result.current.reset).toBeDefined();
    expect(result.current.registeredFiles).toEqual([]);
  });

  it("registers CSV and Parquet files and tracks registered file names", async () => {
    const { result } = renderHook(() => useDuckDbSandbox());

    let csvSuccess = false;
    await act(async () => {
      csvSuccess = await result.current.registerCsv(
        "sales.csv",
        "id,amount\n1,500\n2,1200",
      );
    });
    expect(csvSuccess).toBe(true);
    expect(result.current.registeredFiles).toContain("sales.csv");

    let parquetSuccess = false;
    await act(async () => {
      parquetSuccess = await result.current.registerParquet(
        "ledger.parquet",
        new ArrayBuffer(64),
      );
    });
    expect(parquetSuccess).toBe(true);
    expect(result.current.registeredFiles).toContain("ledger.parquet");
  });

  it("executes SQL queries and returns structured rows and rowCount", async () => {
    const { result } = renderHook(() => useDuckDbSandbox());

    await act(async () => {
      const res = await result.current.query("SELECT * FROM sales;");
      expect(res.rowCount).toBeGreaterThanOrEqual(1);
      expect(res.columns).toBeDefined();
      expect(res.rows).toBeDefined();
    });
  });

  it("extracts zero-copy Arrow RecordBatches with schema and buffer", async () => {
    const { result } = renderHook(() => useDuckDbSandbox());

    await act(async () => {
      const res = await result.current.extractArrowRecordBatches(
        "SELECT * FROM sales;",
      );
      expect(res.buffer).toBeInstanceOf(ArrayBuffer);
      expect(res.schema).toBeDefined();
      expect(res.rowCount).toBeGreaterThanOrEqual(1);
    });
  });
});
