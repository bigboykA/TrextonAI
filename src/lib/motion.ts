export const motionDurations = {
  feedback: 0.16,
  navigation: 0.22,
  view: 0.32,
  processingCycle: 0.9,
} as const;

export const motionEase = [0.22, 1, 0.36, 1] as const;

export const motionTransitions = {
  navigation: {
    duration: motionDurations.navigation,
    ease: motionEase,
  },
  view: {
    duration: motionDurations.view,
    ease: motionEase,
  },
  layout: {
    type: "spring" as const,
    stiffness: 420,
    damping: 38,
    mass: 0.8,
  },
} as const;

export const reducedMotionTransition = {
  duration: 0,
} as const;
