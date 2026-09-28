'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useMotionValue, animate, motion, AnimationPlaybackControls } from 'motion/react';
import useMeasure from 'react-use-measure';
import { cn } from '@/lib/utils';

export type InfiniteSliderProps = {
  children: React.ReactNode;
  gap?: number;
  speed?: number;
  speedOnHover?: number;
  direction?: 'horizontal' | 'vertical';
  reverse?: boolean;
  className?: string;
  trackClassName?: string;
  paused?: boolean;
  onHoverChange?: (isHovering: boolean) => void;
};

export function InfiniteSlider({
  children,
  gap = 16,
  speed = 35,
  speedOnHover = 0,
  direction = 'horizontal',
  reverse = false,
  className,
  trackClassName,
  paused = false,
  onHoverChange,
}: InfiniteSliderProps) {
  const [isInteracting, setIsInteracting] = useState(false);
  const [ref, { width, height }] = useMeasure();
  const translation = useMotionValue(0);
  const controlsRef = useRef<AnimationPlaybackControls | null>(null);

  // Aksesibilitas: Hormati preferensi kurangi gerak (prefers-reduced-motion)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const size = direction === 'horizontal' ? width : height;

  useEffect(() => {
    if (size <= 0) return;

    const contentSize = size + gap;
    const from = reverse ? -contentSize / 2 : 0;
    const to = reverse ? 0 : -contentSize / 2;
    const distanceToTravel = Math.abs(to - from);
    const duration = distanceToTravel / Math.max(1, speed);

    translation.set(from);

    const controls = animate(translation, [from, to], {
      ease: 'linear',
      duration,
      repeat: Infinity,
      repeatType: 'loop',
      repeatDelay: 0,
      onRepeat: () => {
        translation.set(from);
      },
    });

    controlsRef.current = controls;

    return () => {
      controls.stop();
      controlsRef.current = null;
    };
  }, [size, gap, speed, direction, reverse, translation]);

  // Kelola kecepatan saat hover / fokus / jeda manual / reduced motion
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    if (prefersReducedMotion || paused || (isInteracting && speedOnHover === 0)) {
      controls.pause();
    } else if (isInteracting && typeof speedOnHover === 'number' && speedOnHover > 0) {
      controls.play();
      controls.speed = speedOnHover / Math.max(1, speed);
    } else {
      controls.play();
      controls.speed = 1;
    }
  }, [isInteracting, speedOnHover, speed, paused, prefersReducedMotion]);

  const handlePointerEnter = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') {
      setIsInteracting(true);
      onHoverChange?.(true);
    }
  };

  const handlePointerLeave = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') {
      setIsInteracting(false);
      onHoverChange?.(false);
    }
  };

  const handleFocus = () => {
    setIsInteracting(true);
    onHoverChange?.(true);
  };

  const handleBlur = (e: React.FocusEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setIsInteracting(false);
      onHoverChange?.(false);
    }
  };

  return (
    <div
      className={cn('overflow-hidden', className)}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      <motion.div
        className={cn('nav-track flex w-max', trackClassName)}
        style={{
          ...(direction === 'horizontal' ? { x: translation } : { y: translation }),
          gap: `${gap}px`,
          flexDirection: direction === 'horizontal' ? 'row' : 'column',
          willChange: 'transform',
        }}
        ref={ref}
      >
        {React.Children.map(children, (child, idx) => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child, {
              key: `orig-${child.key ?? idx}`,
            });
          }
          return child;
        })}
        {React.Children.map(children, (child, idx) => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child, {
              key: `dup-${child.key ?? idx}`,
              'aria-hidden': true,
              tabIndex: -1,
            } as React.HTMLAttributes<HTMLElement>);
          }
          return child;
        })}
      </motion.div>
    </div>
  );
}
