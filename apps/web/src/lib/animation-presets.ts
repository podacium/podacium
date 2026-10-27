export const SPRING = {
  GENTLE: { type: "spring" as const, stiffness: 200, damping: 25, mass: 1 },
  BOUNCY: { type: "spring" as const, stiffness: 400, damping: 15, mass: 1 },
  SMOOTH: { type: "spring" as const, stiffness: 300, damping: 30, mass: 1 },
} as const;

export const EASING = {
  ENTER: {
    duration: 0.6,
    ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
  },
  STANDARD: {
    duration: 0.3,
    ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
  },
  BOUNCE: {
    duration: 0.6,
    ease: [0.68, -0.55, 0.265, 1.55] as [number, number, number, number],
  },
} as const;

export const STAGGER = {
  FAST: 0.05,
  NORMAL: 0.1,
  SLOW: 0.2,
} as const;

export const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

export const fadeInScale = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
};

export const slideInLeft = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
};

export const slideInRight = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
};

export const hoverLift = {
  whileHover: { y: -8 },
};

export const hoverLiftScale = {
  whileHover: { y: -8, scale: 1.02 },
  whileTap: { scale: 0.98 },
};

// =============================================================================
// Premium presets — shared by marketing + product surfaces
// =============================================================================

/** Parent + child reveal: drop `initial="hidden" animate="visible"` on a parent and
 *  `variants={premiumStaggerItem}` on each child. */
export const premiumStagger = {
  hidden: {},
  visible: {
    transition: { staggerChildren: STAGGER.NORMAL, delayChildren: 0.05 },
  },
} as const;

export const premiumStaggerItem = {
  hidden: { opacity: 0, y: 24, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: EASING.ENTER },
} as const;

/** Scroll-triggered single-element reveal */
export const premiumReveal = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: EASING.ENTER,
} as const;

/** Hero-tier entrance with blur-in for display text */
export const premiumHero = {
  initial: { opacity: 0, y: 32, filter: "blur(8px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  transition: {
    duration: 0.8,
    ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
  },
} as const;

/** Gentle infinite float for decorative orbs/badges */
export const premiumFloat = {
  animate: { y: [0, -12, 0] },
  transition: { duration: 7, repeat: Infinity, ease: "easeInOut" as const },
} as const;

/** Slow ambient drift for aurora/gradient blobs */
export const premiumDrift = {
  animate: { opacity: [0.55, 0.85, 0.55] },
  transition: { duration: 9, repeat: Infinity, ease: "easeInOut" as const },
} as const;

/** Card hover lift used across grid surfaces */
export const premiumCardHover = {
  whileHover: { y: -6, scale: 1.015 },
  whileTap: { scale: 0.99 },
  transition: { type: "spring" as const, stiffness: 300, damping: 22 },
} as const;

/** Count-up-style entrance for stat values */
export const premiumStat = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  transition: { type: "spring" as const, stiffness: 260, damping: 18 },
} as const;

// =============================================================================
// Video & Media Player Motion Tokens
// =============================================================================

export const DOCK_SPRING = {
  type: "spring" as const,
  stiffness: 380,
  damping: 26,
  mass: 0.8,
};

export const floatingDockVariants = {
  hidden: {
    opacity: 0,
    y: 20,
    scale: 0.98,
    transition: { duration: 0.2, ease: [0.4, 0, 1, 1] as const },
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: DOCK_SPRING,
  },
};

export const modalPanelVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 16 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 340, damping: 28 },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: 12,
    transition: { duration: 0.18, ease: "easeIn" as const },
  },
};

export const providerCardVariants = {
  initial: { scale: 1 },
  hover: {
    y: -4,
    scale: 1.01,
    transition: { type: "spring" as const, stiffness: 350, damping: 22 },
  },
  tap: { scale: 0.99 },
};
