"use client";

import { Button } from "@domainstack/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@domainstack/ui/tooltip";
import { IconMessageCircleFilled } from "@tabler/icons-react";
import {
  motion,
  useAnimationFrame,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import { CHATBOT_NAME } from "@/lib/constants/ai";

const MotionButton = motion.create(Button);

interface ChatFabProps {
  onClick: () => void;
}

export function ChatFab({ onClick }: ChatFabProps) {
  const prefersReducedMotion = useReducedMotion();

  // Animated gradient positions for mesh-like effect
  const x1 = useMotionValue(20);
  const y1 = useMotionValue(30);
  const x2 = useMotionValue(80);
  const y2 = useMotionValue(70);
  const x3 = useMotionValue(60);
  const y3 = useMotionValue(20);
  const x4 = useMotionValue(40);
  const y4 = useMotionValue(80);

  useAnimationFrame((time) => {
    if (prefersReducedMotion) return;
    const t = time / 1000;
    // Each spot moves with different frequencies for organic feel
    x1.set(20 + Math.sin(t * 0.7) * 18);
    y1.set(30 + Math.cos(t * 0.9) * 18);
    x2.set(80 + Math.sin(t * 0.8 + 1) * 18);
    y2.set(70 + Math.cos(t * 0.6 + 2) * 18);
    x3.set(60 + Math.sin(t * 0.5 + 3) * 18);
    y3.set(20 + Math.cos(t * 0.7 + 4) * 18);
    x4.set(40 + Math.sin(t * 0.6 + 5) * 18);
    y4.set(80 + Math.cos(t * 0.8 + 1) * 18);
  });

  const meshGradient = useMotionTemplate`
    radial-gradient(ellipse at ${x1}% ${y1}%, rgba(56, 189, 248, 0.8) 0%, transparent 50%),
    radial-gradient(ellipse at ${x2}% ${y2}%, rgba(139, 92, 246, 0.7) 0%, transparent 55%),
    radial-gradient(ellipse at ${x3}% ${y3}%, rgba(236, 72, 153, 0.6) 0%, transparent 45%),
    radial-gradient(ellipse at ${x4}% ${y4}%, rgba(34, 197, 94, 0.5) 0%, transparent 50%)
  `;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <MotionButton
            variant="default"
            size="icon-lg"
            aria-label={`Chat with ${CHATBOT_NAME}`}
            className="fixed right-6 bottom-6 z-40 overflow-hidden rounded-full shadow-lg transition-none"
            onClick={onClick}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            whileHover={prefersReducedMotion ? undefined : "hover"}
            transition={{
              duration: 0.25,
              ease: [0.22, 1, 0.36, 1] as const,
            }}
          >
            <motion.span
              className="pointer-events-none absolute inset-[-4px] rounded-full"
              initial={{ opacity: 0 }}
              variants={{ hover: { opacity: 1 } }}
              transition={{ duration: 0.2 }}
              style={{
                background: meshGradient,
                filter: "blur(4px)",
              }}
            />
            <span className="relative z-10 flex items-center justify-center">
              <IconMessageCircleFilled className="size-5 text-background/95" />
            </span>
          </MotionButton>
        }
      />
      <TooltipContent side="left" sideOffset={8}>
        Chat with {CHATBOT_NAME}
      </TooltipContent>
    </Tooltip>
  );
}
