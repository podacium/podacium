"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { useLocalParticipant, useDataChannel } from "@livekit/components-react";
import type { ReceivedDataMessage } from "@livekit/components-core";
import { useTranslations, useBidi } from "@/lib/i18n";
import {
  Pencil,
  Highlighter,
  Eraser,
  Square,
  Circle,
  Minus,
  Type,
  Undo2,
  Redo2,
  Trash2,
  Download,
} from "lucide-react";

interface Point {
  x: number;
  y: number;
}

type ToolType =
  "pen" | "highlighter" | "eraser" | "rectangle" | "circle" | "line" | "text";

interface ShapeData {
  tool: ToolType;
  points: Point[];
  color: string;
  width: number;
  text?: string;
}

interface WhiteboardMessage {
  action: "draw" | "undo" | "redo" | "clear";
  data?: ShapeData;
}

const COLORS = [
  "#ffffff",
  "#93c5fd",
  "#a855f7",
  "#ef4444",
  "#22c55e",
  "#f59e0b",
  "#1e293b",
];

const STROKE_WIDTHS = [2, 4, 8];

interface Props {
  isHost: boolean;
  className?: string;
}

export function Whiteboard({ isHost, className = "" }: Props) {
  const t = useTranslations("live");
  const { dir } = useBidi();
  const { localParticipant } = useLocalParticipant();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [history, setHistory] = useState<ShapeData[]>([]);
  const [redoStack, setRedoStack] = useState<ShapeData[]>([]);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);

  const [activeTool, setActiveTool] = useState<ToolType>("pen");
  const [color, setColor] = useState(COLORS[1]);
  const [strokeWidth, setStrokeWidth] = useState(STROKE_WIDTHS[0]);

  const { send } = useDataChannel(
    "whiteboard",
    useCallback((msg: ReceivedDataMessage) => {
      try {
        const payload: WhiteboardMessage = JSON.parse(
          new TextDecoder().decode(msg.payload),
        );
        if (payload.action === "draw" && payload.data) {
          setHistory((prev) => [...prev, payload.data!]);
          setRedoStack([]);
        } else if (payload.action === "undo") {
          setHistory((prev) => {
            if (prev.length === 0) return prev;
            const popped = prev[prev.length - 1];
            setRedoStack((r) => [...r, popped]);
            return prev.slice(0, -1);
          });
        } else if (payload.action === "redo") {
          setRedoStack((prevRedo) => {
            if (prevRedo.length === 0) return prevRedo;
            const nextItem = prevRedo[prevRedo.length - 1];
            setHistory((h) => [...h, nextItem]);
            return prevRedo.slice(0, -1);
          });
        } else if (payload.action === "clear") {
          setHistory([]);
          setRedoStack([]);
        }
      } catch (e) {
        console.error("Whiteboard message decode error:", e);
      }
    }, []),
  );

  const broadcastAction = async (
    action: "draw" | "undo" | "redo" | "clear",
    data?: ShapeData,
  ) => {
    try {
      await send(new TextEncoder().encode(JSON.stringify({ action, data })), {
        reliable: true,
      });
    } catch (e) {
      console.error("Whiteboard broadcast error:", e);
    }
  };

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr =
      typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const canvasWidth = container.clientWidth;
    const canvasHeight = container.clientHeight;

    if (canvasWidth === 0 || canvasHeight === 0) return;

    if (
      canvas.width !== canvasWidth * dpr ||
      canvas.height !== canvasHeight * dpr
    ) {
      canvas.width = canvasWidth * dpr;
      canvas.height = canvasHeight * dpr;
      canvas.style.width = `${canvasWidth}px`;
      canvas.style.height = `${canvasHeight}px`;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    const renderShape = (shape: ShapeData) => {
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = shape.color;
      ctx.fillStyle = shape.color;
      ctx.lineWidth = shape.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (shape.tool === "highlighter") {
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = shape.width * 3;
      }

      if (shape.tool === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.lineWidth = shape.width * 4;
      }

      if (
        shape.tool === "pen" ||
        shape.tool === "highlighter" ||
        shape.tool === "eraser"
      ) {
        if (shape.points.length === 1) {
          ctx.arc(
            shape.points[0].x * canvasWidth,
            shape.points[0].y * canvasHeight,
            Math.max(1, shape.width / 2),
            0,
            2 * Math.PI,
          );
          ctx.fill();
        } else if (shape.points.length > 1) {
          ctx.moveTo(
            shape.points[0].x * canvasWidth,
            shape.points[0].y * canvasHeight,
          );
          for (let i = 1; i < shape.points.length; i++) {
            ctx.lineTo(
              shape.points[i].x * canvasWidth,
              shape.points[i].y * canvasHeight,
            );
          }
          ctx.stroke();
        }
      } else if (shape.tool === "rectangle" && shape.points.length >= 2) {
        const start = shape.points[0];
        const end = shape.points[shape.points.length - 1];
        const sx = start.x * canvasWidth;
        const sy = start.y * canvasHeight;
        const ex = end.x * canvasWidth;
        const ey = end.y * canvasHeight;
        ctx.strokeRect(sx, sy, ex - sx, ey - sy);
      } else if (shape.tool === "circle" && shape.points.length >= 2) {
        const start = shape.points[0];
        const end = shape.points[shape.points.length - 1];
        const sx = start.x * canvasWidth;
        const sy = start.y * canvasHeight;
        const ex = end.x * canvasWidth;
        const ey = end.y * canvasHeight;
        const cx = (sx + ex) / 2;
        const cy = (sy + ey) / 2;
        const rx = Math.abs(ex - sx) / 2;
        const ry = Math.abs(ey - sy) / 2;
        if (rx > 0 && ry > 0) {
          ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
          ctx.stroke();
        }
      } else if (shape.tool === "line" && shape.points.length >= 2) {
        const start = shape.points[0];
        const end = shape.points[shape.points.length - 1];
        ctx.moveTo(start.x * canvasWidth, start.y * canvasHeight);
        ctx.lineTo(end.x * canvasWidth, end.y * canvasHeight);
        ctx.stroke();
      } else if (
        shape.tool === "text" &&
        shape.text &&
        shape.points.length > 0
      ) {
        ctx.font = "14px Inter, sans-serif";
        ctx.fillText(
          shape.text,
          shape.points[0].x * canvasWidth,
          shape.points[0].y * canvasHeight,
        );
      }

      ctx.restore();
    };

    history.forEach(renderShape);

    if (currentPoints.length > 0) {
      renderShape({
        tool: activeTool,
        points: currentPoints,
        color,
        width: strokeWidth,
      });
    }

    ctx.restore();
  }, [history, currentPoints, activeTool, color, strokeWidth]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;

    const resizeObserver = new ResizeObserver(() => {
      redraw();
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [redraw]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const getCanvasPoint = (
    e: React.MouseEvent | React.TouchEvent,
  ): Point | null => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    let clientX = 0;
    let clientY = 0;
    if ("touches" in e) {
      const touch = e.touches[0];
      if (!touch) return null;
      clientX = touch.clientX;
      clientY = touch.clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const rawX = clientX - rect.left;
    const rawY = clientY - rect.top;
    return {
      x: Math.max(0, Math.min(1, rawX / rect.width)),
      y: Math.max(0, Math.min(1, rawY / rect.height)),
    };
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const pt = getCanvasPoint(e);
    if (!pt) return;

    if (activeTool === "text") {
      const text = prompt(t("room.whiteboard.enterText"));
      if (text) {
        const shape: ShapeData = {
          tool: "text",
          points: [pt],
          color,
          width: strokeWidth,
          text,
        };
        setHistory((prev) => [...prev, shape]);
        broadcastAction("draw", shape);
      }
      return;
    }

    setIsDrawing(true);
    setCurrentPoints([pt]);
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || currentPoints.length === 0) return;
    e.preventDefault();
    const pt = getCanvasPoint(e);
    if (!pt) return;

    if (
      activeTool === "rectangle" ||
      activeTool === "circle" ||
      activeTool === "line"
    ) {
      setCurrentPoints((prev) => (prev[0] ? [prev[0], pt] : [pt]));
    } else {
      setCurrentPoints((prev) => [...prev, pt]);
    }
  };

  const handleEnd = async (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    setIsDrawing(false);

    if (currentPoints.length === 0) return;

    const shape: ShapeData = {
      tool: activeTool,
      points: currentPoints,
      color,
      width: strokeWidth,
    };

    setHistory((prev) => [...prev, shape]);
    setRedoStack([]);
    setCurrentPoints([]);
    await broadcastAction("draw", shape);
  };

  const handleUndo = async () => {
    if (history.length === 0) return;
    const popped = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, popped]);
    await broadcastAction("undo");
  };

  const handleRedo = async () => {
    if (redoStack.length === 0) return;
    const nextItem = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setHistory((prev) => [...prev, nextItem]);
    await broadcastAction("redo");
  };

  const handleClear = async () => {
    setHistory([]);
    setRedoStack([]);
    await broadcastAction("clear");
  };

  const handleExportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `whiteboard-${Date.now()}.png`;
    link.href = url;
    link.click();
  };

  return (
    <div className={`flex flex-col h-full bg-slate-950 ${className}`}>
      {/* Whiteboard Toolbar */}
      <div className="px-3 py-2 border-b border-white/10 bg-slate-900/90 flex flex-wrap items-center justify-between gap-1.5 shrink-0">
        {/* Tool selectors */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTool("pen")}
            className={`p-1.5 rounded-lg transition-colors ${
              activeTool === "pen"
                ? "bg-purple-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
            title={t("room.whiteboard.pen")}
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => setActiveTool("highlighter")}
            className={`p-1.5 rounded-lg transition-colors ${
              activeTool === "highlighter"
                ? "bg-purple-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
            title={t("room.whiteboard.highlighter")}
          >
            <Highlighter className="h-4 w-4" />
          </button>
          <button
            onClick={() => setActiveTool("eraser")}
            className={`p-1.5 rounded-lg transition-colors ${
              activeTool === "eraser"
                ? "bg-purple-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
            title={t("room.whiteboard.eraser")}
          >
            <Eraser className="h-4 w-4" />
          </button>

          <div className="w-px h-4 bg-white/20 mx-0.5" />

          {/* Shapes */}
          <button
            onClick={() => setActiveTool("rectangle")}
            className={`p-1.5 rounded-lg transition-colors ${
              activeTool === "rectangle"
                ? "bg-purple-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
            title={t("room.whiteboard.rectangle")}
          >
            <Square className="h-4 w-4" />
          </button>
          <button
            onClick={() => setActiveTool("circle")}
            className={`p-1.5 rounded-lg transition-colors ${
              activeTool === "circle"
                ? "bg-purple-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
            title={t("room.whiteboard.circle")}
          >
            <Circle className="h-4 w-4" />
          </button>
          <button
            onClick={() => setActiveTool("line")}
            className={`p-1.5 rounded-lg transition-colors ${
              activeTool === "line"
                ? "bg-purple-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
            title={t("room.whiteboard.line")}
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            onClick={() => setActiveTool("text")}
            className={`p-1.5 rounded-lg transition-colors ${
              activeTool === "text"
                ? "bg-purple-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
            title={t("room.whiteboard.text")}
          >
            <Type className="h-4 w-4" />
          </button>
        </div>

        {/* Colors & Widths */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-4 h-4 rounded-full border-2 transition-transform ${
                  color === c
                    ? "scale-125 border-purple-400"
                    : "border-transparent"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          <div className="w-px h-4 bg-white/20 mx-0.5" />

          <div className="flex items-center gap-1">
            {STROKE_WIDTHS.map((sw) => (
              <button
                key={sw}
                onClick={() => setStrokeWidth(sw)}
                className={`w-5 h-5 flex items-center justify-center rounded-md ${
                  strokeWidth === sw
                    ? "bg-white/20 text-white font-bold"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <span
                  className="rounded-full bg-current"
                  style={{ width: sw * 2, height: sw * 2 }}
                />
              </button>
            ))}
          </div>

          <div className="w-px h-4 bg-white/20 mx-0.5" />

          {/* Undo / Redo / Clear / Export */}
          <button
            onClick={handleUndo}
            disabled={history.length === 0}
            className="p-1 rounded-lg text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
            title={t("room.whiteboard.undo")}
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className="p-1 rounded-lg text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
            title={t("room.whiteboard.redo")}
          >
            <Redo2 className="h-4 w-4" />
          </button>
          <button
            onClick={handleClear}
            disabled={history.length === 0}
            className="p-1 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/20 disabled:opacity-30 transition-colors"
            title={t("room.whiteboard.clear")}
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            onClick={handleExportPNG}
            className="p-1 rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20 transition-colors"
            title={t("room.whiteboard.exportPNG")}
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div
        ref={containerRef}
        className="flex-1 relative cursor-crosshair overflow-hidden touch-none bg-slate-950"
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
          className="absolute inset-0 block w-full h-full"
        />
      </div>
    </div>
  );
}
