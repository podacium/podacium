// Design System Component Exports
// All components follow consistent patterns: variants via CVA, accessibility via ARIA, dark mode support

// Core UI Components
export { default as PodaciumButton, buttonVariants } from "./PodaciumButton";
export { default as PodaciumCard } from "./PodaciumCard";
export {
  default as PodaciumSpotlightCard,
  spotlightCardVariants,
  type SpotlightCardProps,
} from "./PodaciumSpotlightCard";
export { PodaciumBadge, badgeVariants } from "./PodaciumBadge";
export { default as PodaciumInput, inputVariants } from "./PodaciumInput";
export {
  default as PodaciumOTPInput,
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
  OTPInputContext,
  REGEXP_ONLY_DIGITS,
  REGEXP_ONLY_CHARS,
  REGEXP_ONLY_DIGITS_AND_CHARS,
  type PodaciumOTPInputProps,
  type InputOTPProps,
} from "./PodaciumOTPInput";
export { default as PodaciumSelect } from "./PodaciumSelect";
export { default as PodaciumTextarea } from "./PodaciumTextarea";
export { default as PodaciumModal } from "./PodaciumModal";
export {
  default as PodaciumConfirmDialog,
  type PodaciumConfirmDialogProps,
} from "./PodaciumConfirmDialog";
export { default as PodaciumTabs } from "./PodaciumTabs";
export { default as PodaciumSwitch } from "./PodaciumSwitch";
export {
  default as PodaciumCheckbox,
  checkboxVariants,
} from "./PodaciumCheckbox";
export {
  default as PodaciumDrawer,
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
  type DrawerPosition,
  type DrawerSide,
  type DrawerSize,
  type DrawerVariant,
  type DrawerSnapPoint,
} from "./PodaciumDrawer";
export { default as PodaciumAvatar } from "./PodaciumAvatar";
export { default as PodaciumTooltip } from "./PodaciumTooltip";
export { PodaciumToast, PodaciumToastContainer } from "./PodaciumToast";
export { DirectionalIcon, type DirectionalIconProps } from "./DirectionalIcon";

// Motion & Activity
export {
  PodaciumMotionGrid,
  PodaciumMotionGridCells,
  type PodaciumMotionGridProps,
  type PodaciumMotionGridCellProps,
  type MotionGridCellRenderProps,
  type Frames,
} from "./PodaciumMotionGrid";
export {
  PodaciumMotionStatus,
  type PodaciumMotionStatusProps,
  type MotionStatusState,
  type MotionStatusTone,
} from "./PodaciumMotionStatus";
export {
  MOTION_GRID_STATES,
  MOTION_STATUS_FALLBACK_LABELS,
  getRestingFrame,
  type MotionGridStateConfig,
} from "./motion-grid-frames";

// Loading & Feedback
export { default as PodaciumLoadingScreen } from "./PodaciumLoadingScreen";
export { default as PodaciumProgressRing } from "./PodaciumProgressRing";
export { default as PodaciumSkeleton } from "./PodaciumSkeleton";

// Layout Components
export { PageLayout } from "../PageLayout";
export { PageHeader } from "../PageHeader";

// Section Components
export {
  SectionCard,
  StatCard,
  ProgressBar,
  EmptyState,
  LoadingState,
} from "../SectionComponents";
