"use client";

import { useEffect, useSyncExternalStore } from "react";
import { motion, useAnimation } from "framer-motion";

/**
 * Animated "searching" skeleton: a grid of placeholder tour cards with a
 * magnifier that hops between them. Adapted to the WhatToDo palette (green).
 * Shown while the itinerary engine checks tours, prices and availability.
 */

interface GridConfig {
  numCards: number;
  cols: number;
  xBase: number;
  yBase: number;
  xStep: number;
  yStep: number;
}

function subscribe(cb: () => void) {
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
}

function getGridConfig(width: number): GridConfig {
  return {
    numCards: 6,
    cols: width >= 1024 ? 3 : width >= 640 ? 2 : 1,
    xBase: 40,
    yBase: 60,
    xStep: 210,
    yStep: 230,
  };
}

function generateSearchPath(config: GridConfig) {
  const { numCards, cols, xBase, yBase, xStep, yStep } = config;
  const rows = Math.ceil(numCards / cols);
  const positions: { x: number; y: number }[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (row * cols + col < numCards)
        positions.push({ x: xBase + col * xStep, y: yBase + row * yStep });
    }
  }
  const shuffled = positions.sort(() => Math.random() - 0.5).slice(0, 4);
  shuffled.push(shuffled[0]);
  return {
    x: shuffled.map((p) => p.x),
    y: shuffled.map((p) => p.y),
    scale: Array(shuffled.length).fill(1.2),
    transition: {
      duration: shuffled.length * 2,
      repeat: Infinity,
      ease: [0.4, 0, 0.2, 1] as const,
      times: shuffled.map((_, i) => i / (shuffled.length - 1)),
    },
  };
}

const frameVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5 } },
};

const cardVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: (i: number) => ({
    y: 0,
    opacity: 1,
    transition: { delay: i * 0.1, duration: 0.4 },
  }),
};

const glowVariants = {
  animate: {
    boxShadow: [
      "0 0 20px rgba(21, 128, 61, 0.2)",
      "0 0 35px rgba(21, 128, 61, 0.45)",
      "0 0 20px rgba(21, 128, 61, 0.2)",
    ],
    scale: [1, 1.1, 1],
    transition: { duration: 1, repeat: Infinity, ease: "easeInOut" as const },
  },
};

const shimmer = {
  animate: { background: ["#f3f4f6", "#e5e7eb", "#f3f4f6"] },
  transition: { duration: 1.5, repeat: Infinity },
};

export default function AnimatedLoadingSkeleton({ label }: { label?: string }) {
  const controls = useAnimation();
  // Hydration-safe window width (0 on the server, real width on the client).
  const windowWidth = useSyncExternalStore(
    subscribe,
    () => window.innerWidth,
    () => 0,
  );

  useEffect(() => {
    if (windowWidth === 0) return;
    void controls.start(generateSearchPath(getGridConfig(windowWidth)));
  }, [windowWidth, controls]);

  const config = getGridConfig(windowWidth || 1024);

  return (
    <motion.div
      className="w-full rounded-card border border-line bg-white p-4 shadow-sm sm:p-6"
      variants={frameVariants}
      initial="hidden"
      animate="visible"
      aria-busy
      aria-label={label}
    >
      <div className="relative overflow-hidden rounded-card bg-surface p-6 sm:p-8">
        <motion.div
          className="pointer-events-none absolute z-10"
          animate={controls}
          style={{ left: 24, top: 24 }}
        >
          <motion.div
            className="rounded-full bg-primary/15 p-3 backdrop-blur-sm"
            variants={glowVariants}
            animate="animate"
          >
            <svg
              className="h-6 w-6 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </motion.div>
        </motion.div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: config.numCards }).map((_, i) => (
            <motion.div
              key={i}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              custom={i}
              className="rounded-card bg-white p-4 shadow-sm"
            >
              <motion.div className="mb-3 h-32 rounded-md bg-gray-200" {...shimmer} />
              <motion.div className="mb-2 h-3 w-3/4 rounded bg-gray-200" {...shimmer} />
              <motion.div className="h-3 w-1/2 rounded bg-gray-200" {...shimmer} />
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
