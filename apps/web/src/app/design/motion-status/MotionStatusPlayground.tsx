"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  ArrowLeftRight,
  Check,
  Copy,
  Moon,
  Pause,
  Play,
  Sparkles,
  Sun,
} from "lucide-react";
import {
  MOTION_STATUS_FALLBACK_LABELS,
  PodaciumMotionStatus,
  type MotionStatusState,
} from "@/components/design-system";
import { useTheme } from "@/contexts/ThemeContext";
import { useMotionStatus } from "@/hooks/useMotionStatus";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const STATES: MotionStatusState[] = [
  "idle",
  "thinking",
  "searching",
  "busy",
  "saving",
  "importing",
  "syncing",
  "initializing",
  "listening",
  "success",
  "error",
];

const VARIANTS = [
  "brand",
  "glass",
  "soft",
  "outline",
  "ghost",
  "mono",
] as const;
type Variant = (typeof VARIANTS)[number];

const SIZES = ["sm", "md", "lg"] as const;
type Size = (typeof SIZES)[number];

const LAYOUTS = ["pill", "inline", "stacked"] as const;
type Layout = (typeof LAYOUTS)[number];

const SNIPPET = `import { PodaciumMotionStatus } from "@/components/design-system";
import { useMotionStatus } from "@/hooks/useMotionStatus";

const { state } = useMotionStatus({ isStreaming, isLoading });

<PodaciumMotionStatus state={state} variant="brand" />`;

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
}) {
  const uid = React.useId().replace(/:/g, "");

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex flex-wrap items-center gap-0.5 rounded-xl border border-border/70 bg-secondary/50 p-0.5"
    >
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative rounded-[10px] px-2.5 py-1.5 text-[11px] font-medium capitalize transition-colors",
              active
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId={`segment-${uid}`}
                className="absolute inset-0 rounded-[10px] bg-background shadow-sm"
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
              />
            )}
            <span className="relative z-10">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function SignalSwitch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-start text-[11px] font-medium transition-colors",
        checked
          ? "border-primary/30 bg-primary/[0.07] text-primary"
          : "border-border/70 bg-background text-muted-foreground hover:border-primary/20 hover:text-foreground",
      )}
    >
      <span className="truncate">{label}</span>
      <span
        className={cn(
          "relative h-4 w-7 shrink-0 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-muted-foreground/25",
        )}
      >
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 520, damping: 34 }}
          className={cn(
            "absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm",
            checked ? "start-3.5" : "start-0.5",
          )}
        />
      </span>
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
      {children}
    </h2>
  );
}

export function MotionStatusPlayground() {
  const t = useTranslations();
  const { resolvedTheme, setTheme } = useTheme();

  const [state, setState] = React.useState<MotionStatusState>("thinking");
  const [variant, setVariant] = React.useState<Variant>("brand");
  const [size, setSize] = React.useState<Size>("lg");
  const [layout, setLayout] = React.useState<Layout>("pill");
  const [showLabel, setShowLabel] = React.useState(true);
  const [animatedLabel, setAnimatedLabel] = React.useState(true);
  const [paused, setPaused] = React.useState(false);
  const [speed, setSpeed] = React.useState(140);
  const [rtl, setRtl] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const darkStage = resolvedTheme === "dark";

  const [signals, setSignals] = React.useState({
    isLoading: false,
    isFetching: false,
    isStreaming: true,
    tool: false,
    isListening: false,
    isSaving: false,
    isImporting: false,
    success: false,
    error: false,
  });

  const derived = useMotionStatus({
    isLoading: signals.isLoading,
    isFetching: signals.isFetching,
    isStreaming: signals.isStreaming,
    activeTool: signals.tool ? "search" : null,
    isListening: signals.isListening,
    isSaving: signals.isSaving,
    isImporting: signals.isImporting,
    success: signals.success,
    error: signals.error,
  });

  const stateLabel = (value: MotionStatusState) =>
    t(
      `component.motionStatus.${value}`,
      undefined,
      MOTION_STATUS_FALLBACK_LABELS[value],
    );

  const copySnippet = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(SNIPPET);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard can be blocked in insecure contexts; the snippet stays visible.
    }
  }, []);

  const signalItems: Array<{
    key: keyof typeof signals;
    label: string;
  }> = [
    {
      key: "isLoading",
      label: t("component.motionStatus.demo.signals.loading", "Loading"),
    },
    {
      key: "isFetching",
      label: t("component.motionStatus.demo.signals.fetching", "Fetching"),
    },
    {
      key: "isStreaming",
      label: t("component.motionStatus.demo.signals.streaming", "Streaming"),
    },
    {
      key: "tool",
      label: t("component.motionStatus.demo.signals.tool", "Tool running"),
    },
    {
      key: "isListening",
      label: t("component.motionStatus.demo.signals.listening", "Listening"),
    },
    {
      key: "isSaving",
      label: t("component.motionStatus.demo.signals.saving", "Saving"),
    },
    {
      key: "isImporting",
      label: t("component.motionStatus.demo.signals.importing", "Importing"),
    },
    {
      key: "success",
      label: t("component.motionStatus.demo.signals.success", "Success"),
    },
    {
      key: "error",
      label: t("component.motionStatus.demo.signals.error", "Error"),
    },
  ];

  return (
    <div className="space-y-8">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 opacity-30 blur-md" />
            <div className="relative rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 p-2.5 text-white shadow-lg shadow-blue-500/25">
              <Sparkles className="h-5 w-5" />
            </div>
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-foreground lg:text-3xl">
              {t("component.motionStatus.demo.title", "Motion status")}
            </h1>
            <p className="mt-1 text-muted-foreground">
              {t(
                "component.motionStatus.demo.subtitle",
                "A living dot-matrix indicator for every async moment.",
              )}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <PodaciumMotionStatus
            state="idle"
            variant="soft"
            size="sm"
            aria-live="off"
          />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        {/* ── Left column: stage + controls ─────────────────────────── */}
        <div className="min-w-0 space-y-6">
          <section className="overflow-hidden rounded-[1.75rem] border border-border/70 bg-card shadow-[0_24px_80px_-32px_rgba(0,0,0,0.28)]">
            <div
              className={cn(
                "relative flex min-h-[340px] flex-col items-center justify-center gap-6 overflow-hidden bg-background px-6 py-12",
              )}
            >
              <div aria-hidden className="pointer-events-none absolute inset-0">
                <div className="grid-light absolute inset-0 opacity-70" />
                <div className="absolute -start-20 -top-24 h-64 w-64 rounded-full bg-blue-400/20 blur-3xl animate-aurora-slow dark:bg-blue-500/15" />
                <div className="absolute -end-16 bottom-0 h-64 w-64 rounded-full bg-purple-400/20 blur-3xl animate-aurora dark:bg-purple-500/15" />
                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent" />
              </div>

              <div className="absolute start-4 top-4 z-20 flex items-center gap-1.5 rounded-full border border-border/60 bg-background/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {t("component.motionStatus.demo.preview", "Live preview")}
              </div>

              <div className="absolute end-3 top-3 z-20 flex items-center gap-0.5 rounded-full border border-border/60 bg-background/80 p-1 shadow-sm backdrop-blur-xl">
                <button
                  type="button"
                  aria-label={t("component.motionStatus.demo.light", "Light")}
                  aria-pressed={!darkStage}
                  onClick={() => setTheme("light")}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full transition-colors",
                    !darkStage
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Sun className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={t("component.motionStatus.demo.dark", "Dark")}
                  aria-pressed={darkStage}
                  onClick={() => setTheme("dark")}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full transition-colors",
                    darkStage
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Moon className="h-3.5 w-3.5" />
                </button>
                <span className="mx-0.5 h-4 w-px bg-border" />
                <button
                  type="button"
                  aria-label={t(
                    "component.motionStatus.demo.direction",
                    "Direction",
                  )}
                  aria-pressed={rtl}
                  onClick={() => setRtl((value) => !value)}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full transition-colors",
                    rtl
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <ArrowLeftRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <div
                className="relative z-10 flex flex-col items-center gap-5"
                dir={rtl ? "rtl" : "ltr"}
              >
                <div className="relative">
                  {variant === "brand" && (
                    <span
                      aria-hidden
                      className="absolute inset-x-6 top-1/2 -z-10 h-12 -translate-y-1/2 rounded-full bg-gradient-to-r from-blue-500/40 via-indigo-500/40 to-purple-500/40 blur-2xl animate-glow-pulse"
                    />
                  )}
                  <PodaciumMotionStatus
                    state={state}
                    variant={variant}
                    size={size}
                    layout={layout}
                    showLabel={showLabel}
                    animatedLabel={animatedLabel}
                    paused={paused}
                    interval={speed}
                    aria-live="off"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  <span>{state}</span>
                  <span aria-hidden>·</span>
                  <span>{speed}ms</span>
                  <span aria-hidden>·</span>
                  <span>{variant}</span>
                </div>
              </div>

              <div
                className="relative z-10 flex items-end justify-center gap-5"
                dir={rtl ? "rtl" : "ltr"}
              >
                {SIZES.map((value) => (
                  <div
                    key={value}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <PodaciumMotionStatus
                      state={state}
                      variant="glass"
                      size={value}
                      showLabel={false}
                      paused={paused}
                      interval={speed}
                      aria-live="off"
                    />
                    <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-border/70 bg-card p-5 shadow-sm sm:p-6">
            <div className="space-y-5">
              <div>
                <SectionLabel>
                  {t("component.motionStatus.demo.state", "State")}
                </SectionLabel>
                <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {STATES.map((value) => {
                    const active = state === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setState(value)}
                        className={cn(
                          "flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-start text-xs font-medium transition-all",
                          active
                            ? "border-primary/40 bg-primary/[0.08] text-primary shadow-sm"
                            : "border-border/70 bg-background text-muted-foreground hover:border-primary/20 hover:text-foreground",
                        )}
                      >
                        <span className="truncate">{stateLabel(value)}</span>
                        <span
                          className={cn(
                            "h-1.5 w-1.5 shrink-0 rounded-full transition-colors",
                            active ? "bg-primary" : "bg-muted-foreground/25",
                          )}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <SectionLabel>
                    {t("component.motionStatus.demo.variant", "Variant")}
                  </SectionLabel>
                  <Segmented
                    label={t("component.motionStatus.demo.variant", "Variant")}
                    value={variant}
                    onChange={setVariant}
                    options={VARIANTS.map((value) => ({
                      value,
                      label: value,
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <SectionLabel>
                    {t("component.motionStatus.demo.size", "Size")}
                  </SectionLabel>
                  <Segmented
                    label={t("component.motionStatus.demo.size", "Size")}
                    value={size}
                    onChange={setSize}
                    options={SIZES.map((value) => ({ value, label: value }))}
                  />
                </div>
                <div className="space-y-2">
                  <SectionLabel>
                    {t("component.motionStatus.demo.layout", "Layout")}
                  </SectionLabel>
                  <Segmented
                    label={t("component.motionStatus.demo.layout", "Layout")}
                    value={layout}
                    onChange={setLayout}
                    options={LAYOUTS.map((value) => ({
                      value,
                      label: value,
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <SectionLabel>
                    {t("component.motionStatus.demo.options", "Options")}
                  </SectionLabel>
                  <div className="flex flex-wrap gap-2">
                    <SignalSwitch
                      label={t(
                        "component.motionStatus.demo.showLabel",
                        "Show label",
                      )}
                      checked={showLabel}
                      onChange={setShowLabel}
                    />
                    <SignalSwitch
                      label={t(
                        "component.motionStatus.demo.animatedLabel",
                        "Rotate label",
                      )}
                      checked={animatedLabel}
                      onChange={setAnimatedLabel}
                    />
                    <SignalSwitch
                      label={t(
                        "component.motionStatus.demo.paused",
                        "Pause motion",
                      )}
                      checked={paused}
                      onChange={setPaused}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <SectionLabel>
                    {t("component.motionStatus.demo.speed", "Frame speed")}
                  </SectionLabel>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {speed}ms
                  </span>
                </div>
                <input
                  type="range"
                  min={60}
                  max={320}
                  step={20}
                  value={speed}
                  onChange={(event) => setSpeed(Number(event.target.value))}
                  aria-label={t(
                    "component.motionStatus.demo.speed",
                    "Frame speed",
                  )}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border accent-primary"
                />
              </div>
            </div>
          </section>

          <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-950 p-5 text-slate-300 shadow-xl shadow-black/20">
            <div
              aria-hidden
              className="pointer-events-none absolute -end-16 -top-20 h-48 w-48 rounded-full bg-indigo-500/20 blur-3xl"
            />
            <div className="relative flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {t("component.motionStatus.demo.usage", "Usage")}
              </span>
              <button
                type="button"
                onClick={() => void copySnippet()}
                aria-label={t("component.motionStatus.demo.copied", "Copied")}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
            <pre className="relative mt-3 min-w-0 overflow-x-auto font-mono text-[11px] leading-relaxed text-slate-300">
              <code>{SNIPPET}</code>
            </pre>
            <div className="relative mt-4 flex items-center gap-2 border-t border-white/10 pt-3 text-[10px] text-slate-500">
              <Pause className="h-3 w-3" />
              <span className="font-mono">prefers-reduced-motion</span>
              <span aria-hidden>·</span>
              <span className="font-mono">RTL</span>
              <span aria-hidden>·</span>
              <span className="font-mono lowercase">
                {t("component.motionStatus.demo.dark", "Dark")}
              </span>
              <Play className="ms-auto h-3 w-3" />
            </div>
          </section>
        </div>

        {/* ── Right column: binding & gallery ───────────────────────── */}
        <div className="min-w-0 space-y-6">
          <section className="rounded-3xl border border-border/70 bg-card p-5 shadow-sm sm:p-6">
            <SectionLabel>
              {t(
                "component.motionStatus.demo.dataBinding",
                "Real-time binding",
              )}
            </SectionLabel>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              {t(
                "component.motionStatus.demo.dataBindingDesc",
                "Toggle signals and watch useMotionStatus pick the right state.",
              )}
            </p>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {signalItems.map((item) => (
                <SignalSwitch
                  key={item.key}
                  label={item.label}
                  checked={signals[item.key]}
                  onChange={(checked) =>
                    setSignals((previous) => ({
                      ...previous,
                      [item.key]: checked,
                    }))
                  }
                />
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/15 bg-primary/[0.04] px-3.5 py-3 dark:bg-primary/10">
              <PodaciumMotionStatus
                state={derived.state}
                variant="soft"
                size="sm"
                aria-live="off"
              />
              <code className="font-mono text-[10px] text-muted-foreground">
                {`→ "${derived.state}"`}
              </code>
            </div>
          </section>

          <section className="rounded-3xl border border-border/70 bg-card p-5 shadow-sm sm:p-6">
            <SectionLabel>
              {t("component.motionStatus.demo.gallery", "All states")}
            </SectionLabel>
            <div className="mt-4 grid gap-2">
              {STATES.map((value) => (
                <div
                  key={value}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/60 px-3 py-2"
                >
                  <PodaciumMotionStatus
                    state={value}
                    variant="soft"
                    size="sm"
                    paused={paused}
                    interval={speed}
                    aria-live="off"
                  />
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
