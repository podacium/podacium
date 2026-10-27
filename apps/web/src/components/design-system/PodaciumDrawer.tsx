"use client";

import React, {
  Children,
  Fragment,
  cloneElement,
  createContext,
  forwardRef,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { X } from "lucide-react";
import { cva } from "class-variance-authority";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useBidi, useTranslations } from "@/lib/i18n";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Where the panel is anchored.
 *
 * `start`/`end` are logical: `start` is the left edge in LTR and the right edge
 * in RTL (and vice versa for `end`). Prefer the logical aliases so a single
 * call site reads correctly in every locale.
 */
export type DrawerPosition =
  "left" | "right" | "top" | "bottom" | "start" | "end";

/** Physical edge the panel ended up anchored to, after resolving direction. */
export type DrawerSide = "left" | "right" | "top" | "bottom";

/** Extent of the panel along its axis. */
export type DrawerSize = "auto" | "sm" | "md" | "lg" | "xl" | "full";

/**
 * - `modal` — blocks the page: overlay, focus trap, scroll lock.
 * - `dismissible` — same as modal, but reads as a lighter, gesture-driven sheet.
 * - `persistent` — non-modal docked panel: no overlay, no focus trap, page stays usable.
 */
export type DrawerVariant = "modal" | "dismissible" | "persistent";

/**
 * Panel extent along its axis, in pixels, or `"auto"` to hug the content.
 * Ordered largest → smallest: dragging past the last point closes the drawer.
 */
export type DrawerSnapPoint = number | "auto";

interface DrawerContextValue {
  side: DrawerSide;
  isVertical: boolean;
  variant: DrawerVariant;
  size: DrawerSize;
  isOpen: boolean;
  onClose: () => void;
  onOpen?: () => void;
  showSwipeHandle: boolean;
  dragToDismiss: boolean;
  snapPoints: DrawerSnapPoint[];
  titleId: string;
  descriptionId: string;
  /** Explicit `aria-labelledby` target, for headings rendered outside the panel. */
  labelledBy?: string;
  hasTitle: boolean;
  hasDescription: boolean;
  registerTitle: () => () => void;
  registerDescription: () => () => void;
}

const DrawerContext = createContext<DrawerContextValue | null>(null);

function useDrawerContext(): DrawerContextValue {
  const context = useContext(DrawerContext);
  if (!context) {
    throw new Error(
      "Drawer sub-components must be used within a PodaciumDrawer",
    );
  }
  return context;
}

// ============================================================================
// CONSTANTS & HELPERS
// ============================================================================

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Drag velocity (px/s) above which a gesture dismisses regardless of distance. */
const DISMISS_VELOCITY = 500;
/** Fraction of the panel extent that must be dragged for a dismissal. */
const DISMISS_FRACTION = 0.25;

const SIDE_AXIS: Record<DrawerSide, "x" | "y"> = {
  left: "x",
  right: "x",
  top: "y",
  bottom: "y",
};

/** Converts a raw drag offset into "distance travelled toward the closing edge". */
const CLOSING_SIGN: Record<DrawerSide, 1 | -1> = {
  left: -1,
  right: 1,
  top: -1,
  bottom: 1,
};

/** Off-screen transform the panel animates from/into. */
function getOffscreenTransform(side: DrawerSide) {
  switch (side) {
    case "left":
      return { x: "-100%" };
    case "right":
      return { x: "100%" };
    case "top":
      return { y: "-100%" };
    case "bottom":
      return { y: "100%" };
  }
}

function resolveSide(position: DrawerPosition, isRTL: boolean): DrawerSide {
  switch (position) {
    case "start":
      return isRTL ? "right" : "left";
    case "end":
      return isRTL ? "left" : "right";
    default:
      return position;
  }
}

// Static class strings: Tailwind only generates classes it can see in source.
const PANEL_SIZE_CLASSES: Record<
  DrawerSize,
  { horizontal: string; vertical: string }
> = {
  auto: {
    horizontal: "w-auto max-w-[90vw]",
    vertical: "h-auto max-h-[85dvh]",
  },
  sm: {
    horizontal: "w-[280px] max-w-[90vw]",
    vertical: "h-[280px] max-h-[85dvh]",
  },
  md: {
    horizontal: "w-[360px] max-w-[90vw]",
    vertical: "h-[360px] max-h-[85dvh]",
  },
  lg: {
    horizontal: "w-[480px] max-w-[92vw]",
    vertical: "h-[480px] max-h-[85dvh]",
  },
  xl: {
    horizontal: "w-[600px] max-w-[94vw]",
    vertical: "h-[600px] max-h-[85dvh]",
  },
  full: {
    horizontal: "w-full max-w-full",
    vertical: "h-full max-h-full",
  },
};

// ============================================================================
// CVA VARIANTS
// ============================================================================

const OVERLAY_CLASSES = "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm";

// ── Modal background isolation ───────────────────────────────────────────────
// Screen readers, find-in-page and browser UI can still reach the page behind a
// modal panel unless it is made inert. Layers are counted so nested drawers
// compose and only the last close restores the page.
const INERT_MARKER = "data-podacium-inert";
let inertLayerCount = 0;
const inertedElements = new Set<HTMLElement>();

function isolateBackground(portal: HTMLElement | null): void {
  if (typeof document === "undefined") return;

  inertLayerCount += 1;
  for (const element of Array.from(document.body.children)) {
    // Never hide the drawer's own portal, and don't claim nodes another
    // overlay already owns.
    if (element === portal || !(element instanceof HTMLElement)) continue;
    if (element.hasAttribute(INERT_MARKER)) continue;

    element.setAttribute("inert", "");
    element.setAttribute(INERT_MARKER, "");
    inertedElements.add(element);
  }
}

function restoreBackground(): void {
  inertLayerCount = Math.max(0, inertLayerCount - 1);
  if (inertLayerCount > 0) return;

  for (const element of inertedElements) {
    element.removeAttribute("inert");
    element.removeAttribute(INERT_MARKER);
  }
  inertedElements.clear();
}

/**
 * Tracks `prefers-reduced-motion` locally instead of pulling another framer
 * hook, so consumers can partially mock framer-motion. Defaults to `false`.
 */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);

    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return reduced;
}

const panelVariants = cva(
  "fixed z-50 flex flex-col overflow-hidden bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 border-gray-200 dark:border-slate-800 shadow-2xl focus:outline-none",
  {
    variants: {
      side: {
        left: "inset-y-0 left-0 border-e rounded-e-2xl",
        right: "inset-y-0 right-0 border-s rounded-s-2xl",
        top: "inset-x-0 top-0 border-b rounded-b-2xl",
        bottom: "inset-x-0 bottom-0 border-t rounded-t-2xl",
      },
    },
    defaultVariants: { side: "right" },
  },
);

const swipeHandleVariants = cva(
  "flex shrink-0 select-none items-center justify-center text-gray-300 dark:text-slate-600",
  {
    variants: {
      side: {
        left: "h-full w-6 cursor-grab active:cursor-grabbing",
        right: "h-full w-6 cursor-grab active:cursor-grabbing",
        top: "h-6 w-full cursor-grab active:cursor-grabbing",
        bottom: "h-6 w-full cursor-grab active:cursor-grabbing",
      },
    },
    defaultVariants: { side: "right" },
  },
);

const swipeHandleBarVariants = cva(
  "rounded-full bg-gray-300 dark:bg-slate-600",
  {
    variants: {
      side: {
        left: "h-10 w-1.5",
        right: "h-10 w-1.5",
        top: "h-1.5 w-10",
        bottom: "h-1.5 w-10",
      },
    },
    defaultVariants: { side: "right" },
  },
);

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/**
 * Standalone overlay. `PodaciumDrawer`/`DrawerContent` already render one, so
 * this is only needed when composing a custom surface.
 */
export interface DrawerOverlayProps {
  /** Extra classes merged onto the overlay. */
  className?: string;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
}

const DrawerOverlay = forwardRef<HTMLDivElement, DrawerOverlayProps>(
  ({ className, onClick }, ref) => (
    <motion.div
      ref={ref}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      className={cn(OVERLAY_CLASSES, className)}
      aria-hidden="true"
      data-testid="drawer-overlay"
    />
  ),
);
DrawerOverlay.displayName = "PodaciumDrawerOverlay";

/** Grab affordance for pointer-driven drawers. Purely decorative. */
export interface DrawerSwipeHandleProps {
  className?: string;
}

const DrawerSwipeHandle = forwardRef<HTMLDivElement, DrawerSwipeHandleProps>(
  ({ className }, ref) => {
    const { side, variant } = useDrawerContext();
    if (variant === "persistent") return null;

    return (
      <div
        ref={ref}
        className={cn(swipeHandleVariants({ side }), className)}
        aria-hidden="true"
        data-testid="drawer-swipe-handle"
      >
        <span className={swipeHandleBarVariants({ side })} />
      </div>
    );
  },
);
DrawerSwipeHandle.displayName = "PodaciumDrawerSwipeHandle";

export interface DrawerTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Render the caller's element instead of a `<button>`, merging the open
   * handler onto it (useful for `PodaciumButton`).
   */
  asChild?: boolean;
}

/** Opens the drawer. Requires the `onOpen` prop on `PodaciumDrawer`. */
const DrawerTrigger = forwardRef<HTMLButtonElement, DrawerTriggerProps>(
  ({ asChild, children, className, onClick, ...props }, ref) => {
    const { onOpen } = useDrawerContext();

    useEffect(() => {
      if (!onOpen && process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.warn(
          "PodaciumDrawer: <DrawerTrigger> needs an `onOpen` prop on <PodaciumDrawer> to work.",
        );
      }
    }, [onOpen]);

    if (asChild && isValidElement(children)) {
      const child = children as ReactElement<{
        className?: string;
        onClick?: React.MouseEventHandler<HTMLElement>;
      }>;
      return cloneElement(child, {
        className: cn(child.props.className, className),
        onClick: (event: React.MouseEvent<HTMLElement>) => {
          onOpen?.();
          child.props.onClick?.(event);
        },
      });
    }

    return (
      <button
        ref={ref}
        type="button"
        onClick={(event) => {
          onOpen?.();
          onClick?.(event);
        }}
        className={cn("inline-flex items-center justify-center", className)}
        {...props}
      >
        {children}
      </button>
    );
  },
);
DrawerTrigger.displayName = "PodaciumDrawerTrigger";

export interface DrawerCloseProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Replacement for the default close icon. Its text becomes the accessible name. */
  children?: ReactNode;
}

/** Closes the drawer. Falls back to the localized "close" label and an icon. */
const DrawerClose = forwardRef<HTMLButtonElement, DrawerCloseProps>(
  ({ children, className, "aria-label": ariaLabel, ...props }, ref) => {
    const { onClose } = useDrawerContext();
    const t = useTranslations("common");
    const hasTextChildren =
      typeof children === "string" && children.trim().length > 0;

    return (
      <button
        ref={ref}
        type="button"
        onClick={onClose}
        className={cn(
          "shrink-0 rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200",
          className,
        )}
        aria-label={hasTextChildren ? undefined : (ariaLabel ?? t("close"))}
        {...props}
      >
        {children ?? (
          <X
            className="h-5 w-5"
            aria-hidden="true"
            data-testid="drawer-close-icon"
          />
        )}
      </button>
    );
  },
);
DrawerClose.displayName = "PodaciumDrawerClose";

export type DrawerHeaderProps = React.HTMLAttributes<HTMLDivElement>;

const DrawerHeader = forwardRef<HTMLDivElement, DrawerHeaderProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex shrink-0 items-start justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-slate-800",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  ),
);
DrawerHeader.displayName = "PodaciumDrawerHeader";

/** Scrollable region of the panel. */
export type DrawerBodyProps = React.HTMLAttributes<HTMLDivElement>;

const DrawerBody = forwardRef<HTMLDivElement, DrawerBodyProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("min-h-0 flex-1 overflow-y-auto px-5 py-4", className)}
      {...props}
    >
      {children}
    </div>
  ),
);
DrawerBody.displayName = "PodaciumDrawerBody";

export type DrawerFooterProps = React.HTMLAttributes<HTMLDivElement>;

const DrawerFooter = forwardRef<HTMLDivElement, DrawerFooterProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-gray-200 px-5 py-4 dark:border-slate-800",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  ),
);
DrawerFooter.displayName = "PodaciumDrawerFooter";

export type DrawerTitleProps = React.HTMLAttributes<HTMLHeadingElement>;

/** Panel heading. Registers itself so the panel gets `aria-labelledby`. */
const DrawerTitle = forwardRef<HTMLHeadingElement, DrawerTitleProps>(
  ({ className, children, id, ...props }, ref) => {
    const { titleId, registerTitle } = useDrawerContext();

    useEffect(() => registerTitle(), [registerTitle]);

    return (
      <h2
        ref={ref}
        id={id ?? titleId}
        className={cn(
          "text-lg font-semibold text-gray-900 dark:text-slate-100",
          className,
        )}
        {...props}
      >
        {children}
      </h2>
    );
  },
);
DrawerTitle.displayName = "PodaciumDrawerTitle";

export type DrawerDescriptionProps = React.HTMLAttributes<HTMLParagraphElement>;

/** Supporting text. Registers itself so the panel gets `aria-describedby`. */
const DrawerDescription = forwardRef<
  HTMLParagraphElement,
  DrawerDescriptionProps
>(({ className, children, id, ...props }, ref) => {
  const { descriptionId, registerDescription } = useDrawerContext();

  useEffect(() => registerDescription(), [registerDescription]);

  return (
    <p
      ref={ref}
      id={id ?? descriptionId}
      className={cn(
        "mt-1 text-sm text-gray-500 dark:text-slate-400",
        className,
      )}
      {...props}
    >
      {children}
    </p>
  );
});
DrawerDescription.displayName = "PodaciumDrawerDescription";

// ============================================================================
// SURFACE — portal, overlay, panel, focus & gesture behaviour
// ============================================================================

interface DrawerSurfaceProps {
  children: ReactNode;
  closeOnOverlay: boolean;
  closeOnEscape: boolean;
  trapFocus: boolean;
  lockScroll: boolean;
  className?: string;
  overlayClassName?: string;
  contentClassName?: string;
  /** Forwarded to the panel element. */
  panelRef?: React.Ref<HTMLDivElement>;
  /** Element that receives focus when the drawer closes. */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

const DrawerSurface: React.FC<DrawerSurfaceProps> = ({
  children,
  closeOnOverlay,
  closeOnEscape,
  trapFocus,
  lockScroll,
  className,
  overlayClassName,
  contentClassName,
  panelRef,
  returnFocusRef,
}) => {
  const {
    side,
    isVertical,
    variant,
    size,
    isOpen,
    onClose,
    showSwipeHandle,
    dragToDismiss,
    snapPoints,
    titleId,
    descriptionId,
    labelledBy,
    hasTitle,
    hasDescription,
  } = useDrawerContext();

  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
    null,
  );
  const reduceMotion = usePrefersReducedMotion();
  const internalPanelRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const [snapIndex, setSnapIndex] = useState(0);

  // Keep the internal ref (used for focus/gesture maths) and any forwarded ref in sync.
  const setPanelNode = useCallback(
    (node: HTMLDivElement | null) => {
      internalPanelRef.current = node;
      if (typeof panelRef === "function") {
        panelRef(node);
      } else if (panelRef) {
        (panelRef as React.MutableRefObject<HTMLDivElement | null>).current =
          node;
      }
    },
    [panelRef],
  );

  // Portals need a DOM node, so they only exist after mount (SSR-safe).
  useEffect(() => {
    const container = document.createElement("div");
    container.dataset.podaciumDrawerPortal = "";
    document.body.appendChild(container);
    setPortalContainer(container);
    return () => {
      container.remove();
    };
  }, []);

  // Opening resets the sheet back to its largest snap point.
  useEffect(() => {
    if (isOpen) setSnapIndex(0);
  }, [isOpen]);

  // Remember what had focus and freeze the page while open.
  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    if (lockScroll) document.body.style.overflow = "hidden";

    return () => {
      if (lockScroll) document.body.style.overflow = previousOverflow;

      const previous = previouslyFocusedRef.current;
      previouslyFocusedRef.current = null;
      const target = returnFocusRef?.current ?? previous;
      if (
        target &&
        document.contains(target) &&
        typeof target.focus === "function"
      ) {
        target.focus();
      }
    };
  }, [isOpen, lockScroll, returnFocusRef]);

  // Keep the page behind a modal panel out of the accessibility tree.
  useEffect(() => {
    if (!isOpen || variant === "persistent") return;

    isolateBackground(portalContainer);
    return restoreBackground;
  }, [isOpen, variant, portalContainer]);

  // Move focus inside once the panel exists. It is mounted a render later than
  // the portal container, so this cannot live in the effect above.
  useEffect(() => {
    if (!isOpen || !trapFocus) return;

    const panel = internalPanelRef.current;
    if (!panel) return;

    const firstFocusable = panel.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (firstFocusable ?? panel).focus();
  }, [isOpen, trapFocus, portalContainer]);

  // Escape to dismiss + Tab focus containment.
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && closeOnEscape) {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !trapFocus) return;

      const panel = internalPanelRef.current;
      if (!panel) return;

      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );

      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      const activeIsInside = active instanceof Node && panel.contains(active);

      if (event.shiftKey) {
        if (!activeIsInside || active === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (!activeIsInside || active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeOnEscape, onClose, trapFocus]);

  const usesSnapPoints = snapPoints.length > 0;
  const activeSnapPoint = usesSnapPoints
    ? snapPoints[Math.min(snapIndex, snapPoints.length - 1)]
    : undefined;

  const panelStyle: React.CSSProperties = usesSnapPoints
    ? {
        [isVertical ? "height" : "width"]:
          activeSnapPoint === "auto" ? "auto" : `${activeSnapPoint}px`,
      }
    : {};

  const handleDragEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    if (!dragToDismiss) return;

    const axis = SIDE_AXIS[side];
    const sign = CLOSING_SIGN[side];
    // Positive means "dragged toward the edge the panel came from".
    const offset = info.offset[axis] * sign;
    const velocity = info.velocity[axis] * sign;

    const panel = internalPanelRef.current;
    const extent = panel
      ? isVertical
        ? panel.offsetHeight
        : panel.offsetWidth
      : 0;

    const shouldDismiss =
      velocity > DISMISS_VELOCITY || offset > extent * DISMISS_FRACTION;

    if (usesSnapPoints) {
      if (shouldDismiss) {
        if (snapIndex >= snapPoints.length - 1) {
          onClose();
        } else {
          setSnapIndex((index) => index + 1);
        }
        return;
      }

      if (velocity < -DISMISS_VELOCITY || offset < -extent * DISMISS_FRACTION) {
        setSnapIndex((index) => Math.max(0, index - 1));
      }
      return;
    }

    if (shouldDismiss) onClose();
  };

  if (!portalContainer) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {variant !== "persistent" && (
            <DrawerOverlay
              className={overlayClassName}
              onClick={closeOnOverlay ? onClose : undefined}
            />
          )}

          <motion.div
            ref={setPanelNode}
            tabIndex={-1}
            data-testid="drawer-panel"
            initial={
              reduceMotion ? { opacity: 0 } : getOffscreenTransform(side)
            }
            animate={reduceMotion ? { opacity: 1 } : { x: 0, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : getOffscreenTransform(side)}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            drag={dragToDismiss ? SIDE_AXIS[side] : false}
            dragSnapToOrigin
            dragElastic={0.15}
            onDragEnd={handleDragEnd}
            style={panelStyle}
            className={cn(
              panelVariants({ side }),
              usesSnapPoints
                ? ""
                : PANEL_SIZE_CLASSES[size][
                    isVertical ? "vertical" : "horizontal"
                  ],
              className,
            )}
            role="dialog"
            aria-modal={variant === "persistent" ? undefined : true}
            aria-labelledby={labelledBy ?? (hasTitle ? titleId : undefined)}
            aria-describedby={hasDescription ? descriptionId : undefined}
          >
            {showSwipeHandle && <DrawerSwipeHandle />}
            <div
              className={cn(
                "flex min-h-0 flex-1 flex-col overflow-hidden",
                contentClassName,
              )}
            >
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    portalContainer,
  );
};

// ============================================================================
// CONTENT — the panel itself, portaled out of the page flow
// ============================================================================

export interface DrawerContentProps {
  children: ReactNode;
  /** Classes merged onto the panel. */
  className?: string;
  /** Classes merged onto the overlay. */
  overlayClassName?: string;
  /**
   * Classes merged onto the inner column that wraps `children`.
   * Useful for padding overrides when composing custom headers.
   */
  contentClassName?: string;
  /** Dismiss when the overlay is clicked. @default variant !== "persistent" */
  closeOnOverlay?: boolean;
  /** Dismiss on Escape. @default variant !== "persistent" */
  closeOnEscape?: boolean;
  /** Keep Tab focus inside the panel. @default variant !== "persistent" */
  trapFocus?: boolean;
  /** Freeze page scrolling while open. @default variant !== "persistent" */
  lockScroll?: boolean;
  /** Element to focus when the drawer closes. @default the element focused before opening */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

const DrawerContent = forwardRef<HTMLDivElement, DrawerContentProps>(
  (
    {
      children,
      className,
      overlayClassName,
      contentClassName,
      closeOnOverlay,
      closeOnEscape,
      trapFocus,
      lockScroll,
      returnFocusRef,
    },
    ref,
  ) => {
    const { variant } = useDrawerContext();
    const isModal = variant !== "persistent";

    return (
      <DrawerSurface
        panelRef={ref}
        returnFocusRef={returnFocusRef}
        closeOnOverlay={closeOnOverlay ?? isModal}
        closeOnEscape={closeOnEscape ?? isModal}
        trapFocus={trapFocus ?? isModal}
        lockScroll={lockScroll ?? isModal}
        className={className}
        overlayClassName={overlayClassName}
        contentClassName={contentClassName}
      >
        {children}
      </DrawerSurface>
    );
  },
);
DrawerContent.displayName = "PodaciumDrawerContent";

// ============================================================================
// ROOT
// ============================================================================

export interface PodaciumDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Required by `DrawerTrigger`; the drawer stays controlled either way. */
  onOpen?: () => void;
  /** @default "end" */
  position?: DrawerPosition;
  /** @default "md" */
  size?: DrawerSize;
  /** @default "modal" */
  variant?: DrawerVariant;
  /** Panel extents along its axis, largest → smallest. */
  snapPoints?: DrawerSnapPoint[];
  /** @default false */
  showSwipeHandle?: boolean;
  /** Convenience header title. Ignored when a `<DrawerHeader>` is composed. */
  title?: string;
  /** Convenience header description, rendered under `title`. */
  description?: string;
  /** Explicit `aria-labelledby` target, for headings rendered outside the panel. */
  labelledBy?: string;
  /** Element to focus when the drawer closes. @default the element focused before opening */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  /** Dismiss on overlay click. @default variant !== "persistent" */
  closeOnOverlay?: boolean;
  /** Dismiss on Escape. @default variant !== "persistent" */
  closeOnEscape?: boolean;
  /** Keep Tab focus inside the panel. @default variant !== "persistent" */
  trapFocus?: boolean;
  /** Freeze page scrolling while open. @default variant !== "persistent" */
  lockScroll?: boolean;
  /** Allow swipe/drag toward the anchored edge to dismiss. @default variant !== "persistent" */
  dragToDismiss?: boolean;
  /** Classes merged onto the panel. */
  className?: string;
  /** Classes merged onto the overlay. */
  overlayClassName?: string;
  /** Classes merged onto the inner column that wraps `children`. */
  contentClassName?: string;
  children: ReactNode;
}

/** Splits `<DrawerTrigger>` children out so they render where they were written. */
function useDrawerChildren(children: ReactNode) {
  return useMemo(() => {
    const triggers: ReactNode[] = [];
    const panelChildren: ReactNode[] = [];
    let hasContent = false;

    const detectContent = (node: ReactNode) => {
      Children.forEach(node, (child) => {
        if (!isValidElement(child)) return;
        if (child.type === DrawerContent) {
          hasContent = true;
          return;
        }
        if (child.type === Fragment) {
          detectContent((child.props as { children?: ReactNode }).children);
        }
      });
    };

    Children.forEach(children, (child) => {
      if (isValidElement(child) && child.type === DrawerTrigger) {
        triggers.push(child);
        return;
      }
      panelChildren.push(child);
    });

    detectContent(children);

    return { triggers, panelChildren, hasContent };
  }, [children]);
}

/**
 * Edge-anchored panel with swipe-to-dismiss, for filters, detail views, nav
 * and sheets.
 *
 * Two ways to use it:
 *
 * ```tsx
 * // Short form — the drawer builds the header from `title`/`description`.
 * <PodaciumDrawer isOpen={open} onClose={close} title="Filters" position="end">
 *   {body}
 * </PodaciumDrawer>
 *
 * // Compound form — compose the parts when you need a custom layout.
 * <PodaciumDrawer isOpen={open} onClose={close} onOpen={open_}>
 *   <DrawerTrigger asChild><PodaciumButton>Open</PodaciumButton></DrawerTrigger>
 *   <DrawerContent>
 *     <DrawerHeader>
 *       <DrawerTitle>Filters</DrawerTitle>
 *       <DrawerClose />
 *     </DrawerHeader>
 *     <DrawerBody>{body}</DrawerBody>
 *     <DrawerFooter><PodaciumButton>Apply</PodaciumButton></DrawerFooter>
 *   </DrawerContent>
 * </PodaciumDrawer>
 * ```
 */
const PodaciumDrawer = forwardRef<HTMLDivElement, PodaciumDrawerProps>(
  (
    {
      isOpen,
      onClose,
      onOpen,
      position = "end",
      size = "md",
      variant = "modal",
      snapPoints,
      showSwipeHandle = false,
      title,
      description,
      labelledBy,
      returnFocusRef,
      closeOnOverlay,
      closeOnEscape,
      trapFocus,
      lockScroll,
      dragToDismiss,
      className,
      overlayClassName,
      contentClassName,
      children,
    },
    ref,
  ) => {
    const { isRTL } = useBidi();
    const side = resolveSide(position, isRTL);
    const isVertical = side === "top" || side === "bottom";
    const isModal = variant !== "persistent";

    const generatedId = useId();
    const titleId = `${generatedId}-title`;
    const descriptionId = `${generatedId}-description`;

    const [hasTitle, setHasTitle] = useState(false);
    const [hasDescription, setHasDescription] = useState(false);

    const registerTitle = useCallback(() => {
      setHasTitle(true);
      return () => setHasTitle(false);
    }, []);

    const registerDescription = useCallback(() => {
      setHasDescription(true);
      return () => setHasDescription(false);
    }, []);

    const { triggers, panelChildren, hasContent } = useDrawerChildren(children);

    const contextValue = useMemo<DrawerContextValue>(
      () => ({
        side,
        isVertical,
        variant,
        size,
        isOpen,
        onClose,
        onOpen,
        showSwipeHandle,
        dragToDismiss: dragToDismiss ?? isModal,
        snapPoints: snapPoints ?? [],
        titleId,
        descriptionId,
        labelledBy,
        hasTitle: hasTitle || Boolean(title),
        hasDescription: hasDescription || Boolean(description),
        registerTitle,
        registerDescription,
      }),
      [
        side,
        isVertical,
        variant,
        size,
        isOpen,
        onClose,
        onOpen,
        showSwipeHandle,
        dragToDismiss,
        isModal,
        snapPoints,
        titleId,
        descriptionId,
        hasTitle,
        hasDescription,
        title,
        description,
        labelledBy,
        registerTitle,
        registerDescription,
      ],
    );

    return (
      <DrawerContext.Provider value={contextValue}>
        {/* Triggers belong at the call site, not inside the panel. */}
        {triggers}

        {hasContent ? (
          panelChildren
        ) : (
          <DrawerSurface
            panelRef={ref}
            returnFocusRef={returnFocusRef}
            closeOnOverlay={closeOnOverlay ?? isModal}
            closeOnEscape={closeOnEscape ?? isModal}
            trapFocus={trapFocus ?? isModal}
            lockScroll={lockScroll ?? isModal}
            className={className}
            overlayClassName={overlayClassName}
            contentClassName={contentClassName}
          >
            {(title || description) && (
              <DrawerHeader>
                <div className="min-w-0">
                  {title && <DrawerTitle>{title}</DrawerTitle>}
                  {description && (
                    <DrawerDescription>{description}</DrawerDescription>
                  )}
                </div>
                <DrawerClose />
              </DrawerHeader>
            )}
            <DrawerBody>{panelChildren}</DrawerBody>
          </DrawerSurface>
        )}
      </DrawerContext.Provider>
    );
  },
);
PodaciumDrawer.displayName = "PodaciumDrawer";

export {
  PodaciumDrawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
  DrawerOverlay,
  DrawerSwipeHandle,
};

export default PodaciumDrawer;
