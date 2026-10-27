/**
 * Bézier curve math for SVG workflow connectors.
 * Computes smooth cubic Bézier paths between node anchor points.
 */

export interface Point {
  x: number;
  y: number;
}

export interface BezierCurveResult {
  path: string;
  midX: number;
  midY: number;
  lengthEstimate: number;
}

/**
 * Computes a smooth horizontal S-curve cubic Bézier between (x1, y1) and (x2, y2).
 * Source port is typically on the right of the source node; target port is on the left.
 */
export function computeCubicBezierPath(
  source: Point,
  target: Point,
  curvature: number = 0.5,
): BezierCurveResult {
  const dx = target.x - source.x;
  const dy = target.y - source.y;

  // Ensure minimum control point offset even when nodes are vertically aligned or close
  const minOffset = 40;
  const horizontalOffset = Math.max(Math.abs(dx) * curvature, minOffset);

  // If target is to the left of source, loop gracefully
  const cp1x = source.x + horizontalOffset;
  const cp1y = source.y;
  const cp2x = target.x - horizontalOffset;
  const cp2y = target.y;

  const path = `M ${source.x.toFixed(1)} ${source.y.toFixed(1)} C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${target.x.toFixed(1)} ${target.y.toFixed(1)}`;

  // Parametric midpoint at t = 0.5 for cubic Bézier: B(0.5) = 0.125*P0 + 0.375*P1 + 0.375*P2 + 0.125*P3
  const midX =
    0.125 * source.x + 0.375 * cp1x + 0.375 * cp2x + 0.125 * target.x;
  const midY =
    0.125 * source.y + 0.375 * cp1y + 0.375 * cp2y + 0.125 * target.y;

  // Euclidean distance as lower-bound length estimate
  const lengthEstimate = Math.sqrt(dx * dx + dy * dy);

  return {
    path,
    midX,
    midY,
    lengthEstimate,
  };
}
