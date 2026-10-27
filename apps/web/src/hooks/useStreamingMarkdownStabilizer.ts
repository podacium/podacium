import { useMemo } from "react";

/**
 * Normalizes incomplete markdown buffers during SSE token streaming
 * to maintain consistent AST parsing and eliminate layout shifts / visual flickering.
 */
export function stabilizeStreamingMarkdown(
  raw: string,
  isStreaming: boolean,
): string {
  if (!isStreaming || !raw) return raw;

  let stabilized = raw;

  // 1. Repair Unclosed Code Fences (```lang ... ```)
  const fenceRegex = /^( {0,3}```)(.*)$/gm;
  const fenceMatches = Array.from(stabilized.matchAll(fenceRegex));
  if (fenceMatches.length % 2 !== 0) {
    // Odd number of fences means an open code block
    stabilized += "\n```";
  } else {
    // 2. Repair Unclosed Inline Code (`code`) outside of fences
    const textWithoutFences = stabilized.replace(/```[\s\S]*?```/g, "");
    const inlineTickMatches = textWithoutFences.match(/(?<!\\)`/g);
    if (inlineTickMatches && inlineTickMatches.length % 2 !== 0) {
      stabilized += "`";
    }

    // 3. Repair Unclosed Double Asterisks (**bold**) outside of fences
    const boldMatches = textWithoutFences.match(/(?<!\\)\*\*/g);
    if (boldMatches && boldMatches.length % 2 !== 0) {
      stabilized += "**";
    }
  }

  // 4. Repair Incomplete Markdown Table Rows via O(1) last-line slice
  const lastNl = stabilized.lastIndexOf("\n");
  const lastLine = lastNl === -1 ? stabilized : stabilized.slice(lastNl + 1);
  const trimmed = lastLine.trim();
  if (trimmed.startsWith("|") && !trimmed.endsWith("|")) {
    stabilized += " |";
  }

  return stabilized;
}

export function useStreamingMarkdownStabilizer(
  content: string,
  isStreaming: boolean,
): string {
  return useMemo(
    () => stabilizeStreamingMarkdown(content, isStreaming),
    [content, isStreaming],
  );
}
