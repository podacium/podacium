import { useState, useRef, useCallback, useEffect } from "react";

export interface SandboxResult {
  stdout: string;
  stderr: string;
  result?: string;
  error?: string;
  executionTimeMs: number;
}

export function useWasmSandbox() {
  const [isRunning, setIsRunning] = useState(false);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  const executePython = useCallback(
    async (code: string, timeoutMs = 5000): Promise<SandboxResult> => {
      setIsRunning(true);
      const startTime = performance.now();

      return new Promise<SandboxResult>((resolve) => {
        try {
          if (!workerRef.current) {
            workerRef.current = new Worker(
              new URL("./pyodide.worker.ts", import.meta.url),
              { type: "module" },
            );
          }

          const id = Math.random().toString(36).substring(2, 9);

          const handleMessage = (e: MessageEvent) => {
            if (e.data.id === id) {
              workerRef.current?.removeEventListener("message", handleMessage);
              setIsRunning(false);
              const executionTimeMs = Math.round(performance.now() - startTime);

              if (e.data.success) {
                resolve({
                  stdout: e.data.stdout,
                  stderr: e.data.stderr,
                  result: e.data.result,
                  executionTimeMs,
                });
              } else {
                resolve({
                  stdout: "",
                  stderr: "",
                  error: e.data.error,
                  executionTimeMs,
                });
              }
            }
          };

          workerRef.current.addEventListener("message", handleMessage);
          workerRef.current.postMessage({ id, code, timeoutMs });
        } catch (err) {
          setIsRunning(false);
          resolve({
            stdout: "",
            stderr: "",
            error: err instanceof Error ? err.message : String(err),
            executionTimeMs: Math.round(performance.now() - startTime),
          });
        }
      });
    },
    [],
  );

  return { executePython, isRunning };
}
