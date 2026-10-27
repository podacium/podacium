/**
 * Web Worker for Pyodide WebAssembly Python Runtime.
 * Executes student code in a sandboxed background thread with timeout protection.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

declare const importScripts: (...urls: string[]) => void;
declare const loadPyodide: (config?: any) => Promise<any>;

let pyodidePromise: Promise<any> | null = null;

async function initPyodide(): Promise<any> {
  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      try {
        importScripts(
          "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js",
        );
        const pyodide = await loadPyodide({
          indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/",
        });
        return pyodide;
      } catch (err) {
        console.error("Failed to load Pyodide Wasm engine:", err);
        throw err;
      }
    })();
  }
  return pyodidePromise;
}

self.onmessage = async (event: MessageEvent) => {
  const { id, code, timeoutMs = 5000 } = event.data;

  try {
    const pyodide = await initPyodide();

    let stdout = "";
    let stderr = "";

    pyodide.setStdout({
      batched: (text: string) => {
        stdout += text + "\n";
      },
    });

    pyodide.setStderr({
      batched: (text: string) => {
        stderr += text + "\n";
      },
    });

    // Run execution wrapped in timeout promise
    const executionPromise = pyodide.runPythonAsync(code);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`Execution timed out after ${timeoutMs}ms`)),
        timeoutMs,
      ),
    );

    const result = await Promise.race([executionPromise, timeoutPromise]);
    const finalResult =
      result !== undefined && result !== null ? String(result) : undefined;

    self.postMessage({
      id,
      success: true,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      result: finalResult,
    });
  } catch (error: any) {
    self.postMessage({
      id,
      success: false,
      error: error?.message || String(error),
    });
  }
};
