import { useCallback, useRef } from "react";
import type { StreamFrame } from "@/types/agent-stream";

export function useDataStreamParser() {
  const bufferRef = useRef<string>("");
  const decoderRef = useRef<TextDecoder | null>(null);

  const reset = useCallback(() => {
    bufferRef.current = "";
    decoderRef.current = null;
  }, []);

  const parseChunk = useCallback(
    (chunk: Uint8Array | string, onFrame: (frame: StreamFrame) => void) => {
      if (typeof chunk === "string") {
        bufferRef.current += chunk;
      } else {
        if (!decoderRef.current) {
          decoderRef.current = new TextDecoder("utf-8");
        }
        bufferRef.current += decoderRef.current.decode(chunk, { stream: true });
      }

      // Split on SSE message boundaries (\n\n or \r\n\r\n)
      const parts = bufferRef.current.split(/\r?\n\r?\n/);
      // The last element is either empty (if ended on boundary) or the incomplete remainder
      bufferRef.current = parts.pop() || "";

      for (let i = 0; i < parts.length; i++) {
        const rawPart = parts[i];
        const lines = rawPart.split(/\r?\n/);
        const dataLines: string[] = [];

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          dataLines.push(trimmed.replace(/^data:\s*/, ""));
        }

        if (dataLines.length === 0) continue;

        const jsonPayload = dataLines.join("\n");
        if (!jsonPayload || jsonPayload === "[DONE]") continue;

        try {
          const raw = JSON.parse(jsonPayload);
          let frame: StreamFrame | null = null;

          if (raw.type) {
            frame = raw as StreamFrame;
          } else if (raw.token !== undefined) {
            frame = { type: "token", token: String(raw.token) };
          } else if (raw.widget !== undefined) {
            frame = { type: "widget", widget: raw.widget };
          } else if (raw.action_confirmation !== undefined) {
            frame = {
              type: "action_confirmation",
              action_confirmation: raw.action_confirmation,
            };
          } else if (raw.tool_call !== undefined) {
            frame = { type: "tool_call", tool_call: raw.tool_call };
          } else if (raw.canvas_sync !== undefined) {
            frame = { type: "canvas_sync", canvas_sync: raw.canvas_sync };
          } else if (raw.done === true) {
            frame = { type: "done", ...raw };
          } else if (raw.error !== undefined) {
            frame = {
              type: "error",
              code: raw.code || "UNKNOWN_ERROR",
              message:
                typeof raw.error === "string"
                  ? raw.error
                  : JSON.stringify(raw.error),
            };
          }

          if (frame) {
            onFrame(frame);
          }
        } catch {
          // If parsing fails, preserve buffer state for this and subsequent parts
          const unparsed = parts.slice(i);
          bufferRef.current =
            unparsed.join("\n\n") +
            (bufferRef.current ? "\n\n" + bufferRef.current : "");
          break;
        }
      }
    },
    [],
  );

  return { parseChunk, reset };
}
