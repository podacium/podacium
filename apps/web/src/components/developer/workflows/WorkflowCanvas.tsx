"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  WorkflowNode,
  WorkflowEdge,
  WorkflowNodeType,
  WorkflowExecutionState,
} from "./types";
import { computeCubicBezierPath } from "./bezierMath";
import {
  Zap,
  Play,
  GitBranch,
  Clock,
  Filter,
  Code2,
  Trash2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  AlertTriangle,
  CheckCircle2,
  Plus,
} from "lucide-react";
import { PodaciumButton } from "@/components/design-system";
import { useTranslations } from "@/lib/i18n";

interface WorkflowCanvasProps {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  selectedNodeId: string | null;
  executionState?: WorkflowExecutionState;
  hasCycle?: boolean;
  cycleNodes?: string[];
  onSelectNode: (nodeId: string | null) => void;
  onNodesChange: (nodes: WorkflowNode[]) => void;
  onEdgesChange: (edges: WorkflowEdge[]) => void;
  onAddNode: (type: WorkflowNodeType, actionType?: string) => void;
}

const NODE_WIDTH = 240;
const NODE_HEIGHT = 100;

export function WorkflowCanvas({
  nodes,
  edges,
  selectedNodeId,
  executionState,
  hasCycle,
  cycleNodes = [],
  onSelectNode,
  onNodesChange,
  onEdgesChange,
  onAddNode,
}: WorkflowCanvasProps) {
  const t = useTranslations();
  const containerRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 80, y: 80 });
  const [zoom, setZoom] = useState<number>(1);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });

  // Node drag state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });

  // Edge drawing state
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(
    null,
  );
  const [connectMousePos, setConnectMousePos] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    setZoom((prevZoom) => {
      const nextZoom = Math.min(Math.max(prevZoom * zoomFactor, 0.4), 2.2);
      return Number(nextZoom.toFixed(2));
    });
  }, []);

  // Pan handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only pan on background click
      if (
        (e.target as HTMLElement).tagName === "svg" ||
        (e.target as HTMLElement).id === "canvas-bg"
      ) {
        setIsPanning(true);
        setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
        onSelectNode(null);
      }
    },
    [pan, onSelectNode],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        setPan({
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y,
        });
      } else if (draggingNodeId) {
        const clientX = e.clientX;
        const clientY = e.clientY;
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          const canvasX = (clientX - rect.left - pan.x) / zoom;
          const canvasY = (clientY - rect.top - pan.y) / zoom;

          onNodesChange(
            nodes.map((node) => {
              if (node.id === draggingNodeId) {
                return {
                  ...node,
                  position: {
                    x: Math.round(canvasX - dragOffset.x),
                    y: Math.round(canvasY - dragOffset.y),
                  },
                };
              }
              return node;
            }),
          );
        }
      } else if (connectingSourceId && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setConnectMousePos({
          x: (e.clientX - rect.left - pan.x) / zoom,
          y: (e.clientY - rect.top - pan.y) / zoom,
        });
      }
    },
    [
      isPanning,
      panStart,
      draggingNodeId,
      dragOffset,
      nodes,
      onNodesChange,
      pan,
      zoom,
      connectingSourceId,
    ],
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    setDraggingNodeId(null);
    setConnectingSourceId(null);
    setConnectMousePos(null);
  }, []);

  // Node drag start
  const handleNodeDragStart = (e: React.MouseEvent, node: WorkflowNode) => {
    e.stopPropagation();
    onSelectNode(node.id);
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const canvasX = (e.clientX - rect.left - pan.x) / zoom;
      const canvasY = (e.clientY - rect.top - pan.y) / zoom;
      setDraggingNodeId(node.id);
      setDragOffset({
        x: canvasX - node.position.x,
        y: canvasY - node.position.y,
      });
    }
  };

  // Connection handling
  const handlePortConnectStart = (e: React.MouseEvent, sourceId: string) => {
    e.stopPropagation();
    setConnectingSourceId(sourceId);
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setConnectMousePos({
        x: (e.clientX - rect.left - pan.x) / zoom,
        y: (e.clientY - rect.top - pan.y) / zoom,
      });
    }
  };

  const handlePortConnectEnd = (e: React.MouseEvent, targetId: string) => {
    e.stopPropagation();
    if (connectingSourceId && connectingSourceId !== targetId) {
      // Check if edge already exists
      const exists = edges.some(
        (edge) =>
          edge.source === connectingSourceId && edge.target === targetId,
      );
      if (!exists) {
        const newEdge: WorkflowEdge = {
          id: `edge_${connectingSourceId}_${targetId}_${Date.now()}`,
          source: connectingSourceId,
          target: targetId,
        };
        onEdgesChange([...edges, newEdge]);
      }
    }
    setConnectingSourceId(null);
    setConnectMousePos(null);
  };

  const handleDeleteEdge = (edgeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onEdgesChange(edges.filter((edge) => edge.id !== edgeId));
  };

  const getNodeIcon = (type: WorkflowNodeType, actionType?: string) => {
    switch (type) {
      case "trigger":
        return <Zap className="w-4 h-4 text-emerald-500" />;
      case "action":
        if (actionType === "wasm_transform") {
          return <Code2 className="w-4 h-4 text-purple-500" />;
        }
        return <Play className="w-4 h-4 text-primary" />;
      case "logic":
        if (actionType === "delay") {
          return <Clock className="w-4 h-4 text-amber-500" />;
        }
        if (actionType === "filter") {
          return <Filter className="w-4 h-4 text-blue-500" />;
        }
        return <GitBranch className="w-4 h-4 text-cyan-500" />;
      default:
        return <Play className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[650px] bg-slate-950 border border-slate-800 rounded-xl overflow-hidden select-none cursor-grab active:cursor-grabbing font-sans"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      id="workflow-canvas-container"
    >
      {/* Grid Pattern and SVG Connectors */}
      <svg
        id="canvas-bg"
        className="absolute inset-0 w-full h-full pointer-events-auto"
        style={{
          width: "100%",
          height: "100%",
        }}
      >
        <defs>
          <pattern
            id="dot-grid"
            width={24 * zoom}
            height={24 * zoom}
            patternUnits="userSpaceOnUse"
            patternTransform={`translate(${pan.x}, ${pan.y})`}
          >
            <circle cx="2" cy="2" r="1.2" fill="#334155" opacity="0.45" />
          </pattern>
        </defs>

        <rect width="100%" height="100%" fill="url(#dot-grid)" />

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Render Connections */}
          {edges.map((edge) => {
            const sourceNode = nodes.find((n) => n.id === edge.source);
            const targetNode = nodes.find((n) => n.id === edge.target);
            if (!sourceNode || !targetNode) return null;

            const sourcePoint = {
              x: sourceNode.position.x + NODE_WIDTH,
              y: sourceNode.position.y + NODE_HEIGHT / 2,
            };
            const targetPoint = {
              x: targetNode.position.x,
              y: targetNode.position.y + NODE_HEIGHT / 2,
            };

            const curve = computeCubicBezierPath(sourcePoint, targetPoint);
            const isCycleEdge =
              cycleNodes.includes(edge.source) &&
              cycleNodes.includes(edge.target);

            return (
              <g key={edge.id} className="group">
                {/* Shadow path for hover detection */}
                <path
                  d={curve.path}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="18"
                  className="cursor-pointer"
                />
                {/* Main Visible Path */}
                <path
                  d={curve.path}
                  fill="none"
                  stroke={isCycleEdge ? "#ef4444" : "#6366f1"}
                  strokeWidth={isCycleEdge ? "3" : "2"}
                  strokeDasharray={isCycleEdge ? "6 4" : undefined}
                  className="transition-all duration-150 group-hover:stroke-indigo-400 group-hover:stroke-[3]"
                />
                {/* Delete button at Bézier midpoint */}
                <g
                  transform={`translate(${curve.midX}, ${curve.midY})`}
                  className="cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => handleDeleteEdge(edge.id, e)}
                >
                  <circle
                    r="11"
                    fill="#1e293b"
                    stroke="#ef4444"
                    strokeWidth="1.5"
                  />
                  <line
                    x1="-4"
                    y1="-4"
                    x2="4"
                    y2="4"
                    stroke="#ef4444"
                    strokeWidth="1.5"
                  />
                  <line
                    x1="4"
                    y1="-4"
                    x2="-4"
                    y2="4"
                    stroke="#ef4444"
                    strokeWidth="1.5"
                  />
                </g>
              </g>
            );
          })}

          {/* Render Active Temporary Dragging Edge */}
          {connectingSourceId &&
            connectMousePos &&
            (() => {
              const srcNode = nodes.find((n) => n.id === connectingSourceId);
              if (!srcNode) return null;
              const sourcePoint = {
                x: srcNode.position.x + NODE_WIDTH,
                y: srcNode.position.y + NODE_HEIGHT / 2,
              };
              const curve = computeCubicBezierPath(
                sourcePoint,
                connectMousePos,
              );
              return (
                <path
                  d={curve.path}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="2.5"
                  strokeDasharray="4 4"
                />
              );
            })()}
        </g>
      </svg>

      {/* Render Interactive Nodes */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
        }}
      >
        {nodes.map((node) => {
          const isSelected = selectedNodeId === node.id;
          const isCycle = cycleNodes.includes(node.id);
          const nodeExecution = executionState?.stepResults[node.id];

          let borderClass = "border-slate-800 hover:border-slate-700";
          if (isCycle)
            borderClass = "border-red-500 shadow-red-500/20 shadow-lg";
          else if (isSelected)
            borderClass =
              "border-indigo-500 ring-2 ring-indigo-500/40 shadow-indigo-500/20 shadow-lg";

          return (
            <div
              key={node.id}
              style={{
                position: "absolute",
                left: `${node.position.x}px`,
                top: `${node.position.y}px`,
                width: `${NODE_WIDTH}px`,
                height: `${NODE_HEIGHT}px`,
              }}
              className={`pointer-events-auto rounded-xl bg-slate-900/95 backdrop-blur-md border p-3.5 transition-shadow cursor-move flex flex-col justify-between ${borderClass}`}
              onMouseDown={(e) => handleNodeDragStart(e, node)}
              onClick={(e) => {
                e.stopPropagation();
                onSelectNode(node.id);
              }}
            >
              {/* Input Port (Left) */}
              {node.type !== "trigger" && (
                <div
                  className="absolute -start-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-900 border-2 border-indigo-400 flex items-center justify-center cursor-crosshair hover:scale-125 transition-transform"
                  title={t("developer.workflows.canvas.connectInputTitle")}
                  onMouseUp={(e) => handlePortConnectEnd(e, node.id)}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                </div>
              )}

              {/* Output Port (Right) */}
              <div
                className="absolute -end-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-900 border-2 border-emerald-400 flex items-center justify-center cursor-crosshair hover:scale-125 transition-transform"
                title={t("developer.workflows.canvas.dragConnectTitle")}
                onMouseDown={(e) => handlePortConnectStart(e, node.id)}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              </div>

              {/* Node Header */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className="p-1.5 rounded-lg bg-slate-800/80 shrink-0">
                    {getNodeIcon(node.type, node.actionType)}
                  </div>
                  <div className="truncate">
                    <span className="text-xs uppercase font-semibold tracking-wider text-slate-400 block text-[10px]">
                      {node.type}
                    </span>
                    <span className="text-sm font-medium text-slate-100 truncate block">
                      {node.name}
                    </span>
                  </div>
                </div>

                {nodeExecution && (
                  <div className="shrink-0">
                    {nodeExecution.status === "completed" && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    )}
                    {nodeExecution.status === "failed" && (
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                    )}
                    {nodeExecution.status === "running" && (
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                    )}
                  </div>
                )}
              </div>

              {/* Node Description/Footer */}
              <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800/50">
                <span className="truncate text-[11px] font-mono">
                  {node.actionType || node.triggerType || "node"}
                </span>
                {nodeExecution?.durationMs !== undefined && (
                  <span className="text-[10px] text-slate-500 font-mono">
                    {nodeExecution.durationMs}ms
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Top Floating Controls & Cycle Status */}
      <div className="absolute top-4 start-4 flex items-center gap-2 z-10">
        <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-lg p-1 shadow-lg">
          <PodaciumButton
            variant="ghost"
            size="sm"
            onClick={() => onAddNode("trigger", "contract.created")}
            className="text-xs text-slate-300 hover:text-white"
          >
            <Zap className="w-3.5 h-3.5 me-1 text-emerald-400" />
            {t("developer.workflows.canvas.addTrigger")}
          </PodaciumButton>
          <PodaciumButton
            variant="ghost"
            size="sm"
            onClick={() => onAddNode("action", "execute_webhook")}
            className="text-xs text-slate-300 hover:text-white"
          >
            <Play className="w-3.5 h-3.5 me-1 text-indigo-400" />
            {t("developer.workflows.canvas.addAction")}
          </PodaciumButton>
          <PodaciumButton
            variant="ghost"
            size="sm"
            onClick={() => onAddNode("action", "wasm_transform")}
            className="text-xs text-slate-300 hover:text-white"
          >
            <Code2 className="w-3.5 h-3.5 me-1 text-purple-400" />
            {t("developer.workflows.canvas.addWasm")}
          </PodaciumButton>
          <PodaciumButton
            variant="ghost"
            size="sm"
            onClick={() => onAddNode("logic", "filter")}
            className="text-xs text-slate-300 hover:text-white"
          >
            <GitBranch className="w-3.5 h-3.5 me-1 text-cyan-400" />
            {t("developer.workflows.canvas.addLogic")}
          </PodaciumButton>
        </div>

        {/* Validation Status Indicator */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium backdrop-blur-md ${
            hasCycle
              ? "bg-rose-950/70 border-rose-800 text-rose-300"
              : "bg-emerald-950/70 border-emerald-800 text-emerald-300"
          }`}
        >
          {hasCycle ? (
            <>
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              <span>{t("developer.workflows.canvas.cycleDetected")}</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t("developer.workflows.canvas.dagVerified")}</span>
            </>
          )}
        </div>
      </div>

      {/* Bottom Floating Canvas Navigation Controls */}
      <div className="absolute bottom-4 end-4 flex items-center gap-1 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-lg p-1 shadow-lg z-10">
        <button
          onClick={() =>
            setZoom((z) => Math.min(Number((z + 0.1).toFixed(2)), 2.2))
          }
          className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title={t("developer.workflows.canvas.zoomInTitle")}
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() =>
            setZoom((z) => Math.max(Number((z - 0.1).toFixed(2)), 0.4))
          }
          className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title={t("developer.workflows.canvas.zoomOutTitle")}
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            setZoom(1);
            setPan({ x: 80, y: 80 });
          }}
          className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-xs font-mono"
          title={t("developer.workflows.canvas.resetViewTitle")}
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <span className="text-[11px] font-mono text-slate-400 px-1">
          {Math.round(zoom * 100)}%
        </span>
      </div>
    </div>
  );
}
