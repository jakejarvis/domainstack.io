"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "../utils";

// Types
type StepperOrientation = "horizontal" | "vertical";
type StepState = "active" | "completed" | "inactive" | "loading";
type StepIndicators = {
  active?: React.ReactNode;
  completed?: React.ReactNode;
  inactive?: React.ReactNode;
  loading?: React.ReactNode;
};

interface StepperContextValue {
  activeStep: number;
  setActiveStep: (step: number) => void;
  stepsCount: number;
  orientation: StepperOrientation;
  registerTrigger: (node: HTMLButtonElement | null) => void;
  triggerNodes: HTMLButtonElement[];
  focusNext: (currentIdx: number) => void;
  focusPrev: (currentIdx: number) => void;
  focusFirst: () => void;
  focusLast: () => void;
  indicators: StepIndicators;
}

interface StepItemContextValue {
  step: number;
  state: StepState;
  isDisabled: boolean;
  isLoading: boolean;
}

const StepperContext = createContext<StepperContextValue | undefined>(
  undefined,
);
const StepItemContext = createContext<StepItemContextValue | undefined>(
  undefined,
);

function useStepper() {
  const ctx = useContext(StepperContext);
  if (!ctx) throw new Error("useStepper must be used within a Stepper");
  return ctx;
}

function useStepItem() {
  const ctx = useContext(StepItemContext);
  if (!ctx) throw new Error("useStepItem must be used within a StepperItem");
  return ctx;
}

interface StepperProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultValue?: number;
  value?: number;
  onValueChange?: (value: number) => void;
  orientation?: StepperOrientation;
  indicators?: StepIndicators;
}

function Stepper({
  defaultValue = 1,
  value,
  onValueChange,
  orientation = "horizontal",
  className,
  children,
  indicators = {},
  ...props
}: StepperProps) {
  const [activeStep, setActiveStep] = useState(defaultValue);
  const [triggerNodes, setTriggerNodes] = useState<HTMLButtonElement[]>([]);

  // Register/unregister triggers
  const registerTrigger = useCallback((node: HTMLButtonElement | null) => {
    setTriggerNodes((prev) => {
      if (node && !prev.includes(node)) {
        return [...prev, node];
      } else if (node && prev.includes(node)) {
        return prev.filter((n) => n !== node);
      } else {
        return prev;
      }
    });
  }, []);

  const handleSetActiveStep = useCallback(
    (step: number) => {
      if (value === undefined) {
        setActiveStep(step);
      }
      onValueChange?.(step);
    },
    [value, onValueChange],
  );

  const currentStep = value ?? activeStep;

  // Keyboard navigation logic
  const focusTrigger = (idx: number) => {
    if (triggerNodes[idx]) triggerNodes[idx].focus();
  };
  const focusNext = (currentIdx: number) =>
    focusTrigger((currentIdx + 1) % triggerNodes.length);
  const focusPrev = (currentIdx: number) =>
    focusTrigger((currentIdx - 1 + triggerNodes.length) % triggerNodes.length);
  const focusFirst = () => focusTrigger(0);
  const focusLast = () => focusTrigger(triggerNodes.length - 1);

  // Recursively count StepperItem components in the tree
  const countStepperItems = useCallback((node: React.ReactNode): number => {
    let count = 0;
    Children.forEach(node, (child) => {
      if (isValidElement(child)) {
        if (
          (child.type as { displayName?: string }).displayName === "StepperItem"
        ) {
          count++;
        }
        // Recurse into children (e.g., StepperNav contains StepperItems)
        if (child.props && typeof child.props === "object") {
          const props = child.props as { children?: React.ReactNode };
          if (props.children) {
            count += countStepperItems(props.children);
          }
        }
      }
    });
    return count;
  }, []);

  // Context value
  // biome-ignore lint/correctness/useExhaustiveDependencies: indicators is intentionally stable
  const contextValue = useMemo<StepperContextValue>(
    () => ({
      activeStep: currentStep,
      setActiveStep: handleSetActiveStep,
      // Each StepperTrigger registers itself, so triggerNodes.length = step count
      stepsCount: countStepperItems(children),
      orientation,
      registerTrigger,
      focusNext,
      focusPrev,
      focusFirst,
      focusLast,
      triggerNodes,
      indicators,
    }),
    [
      currentStep,
      handleSetActiveStep,
      children,
      orientation,
      registerTrigger,
      triggerNodes,
      countStepperItems,
    ],
  );

  return (
    <StepperContext.Provider value={contextValue}>
      <div
        role="tablist"
        aria-orientation={orientation}
        data-slot="stepper"
        className={cn("w-full", className)}
        data-orientation={orientation}
        {...props}
      >
        {children}
      </div>
    </StepperContext.Provider>
  );
}

Stepper.displayName = "Stepper";

interface StepperItemProps extends React.HTMLAttributes<HTMLDivElement> {
  step: number;
  completed?: boolean;
  disabled?: boolean;
  loading?: boolean;
}

function StepperItem({
  step,
  completed = false,
  disabled = false,
  loading = false,
  className,
  children,
  ...props
}: StepperItemProps) {
  const { activeStep } = useStepper();

  const state: StepState =
    completed || step < activeStep
      ? "completed"
      : activeStep === step
        ? "active"
        : "inactive";

  const isLoading = loading && step === activeStep;

  return (
    <StepItemContext.Provider
      value={{ step, state, isDisabled: disabled, isLoading }}
    >
      <div
        data-slot="stepper-item"
        className={cn(
          // For horizontal: use display:contents so children become direct grid items
          // For vertical: use flex layout
          "group/step group-data-[orientation=vertical]/stepper-nav:flex group-data-[orientation=horizontal]/stepper-nav:contents group-data-[orientation=vertical]/stepper-nav:flex-col group-data-[orientation=vertical]/stepper-nav:items-center",
          className,
        )}
        data-state={state}
        {...(isLoading ? { "data-loading": true } : {})}
        {...props}
      >
        {children}
      </div>
    </StepItemContext.Provider>
  );
}

StepperItem.displayName = "StepperItem";

interface StepperTriggerState {
  state: StepState;
  isLoading: boolean;
  isSelected: boolean;
}

interface StepperTriggerProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  render?: useRender.RenderProp<StepperTriggerState>;
  children?: React.ReactNode;
}

function StepperTrigger({
  render,
  className,
  children,
  tabIndex,
  ...props
}: StepperTriggerProps) {
  const { state, isLoading } = useStepItem();
  const stepperCtx = useStepper();
  const {
    setActiveStep,
    activeStep,
    registerTrigger,
    triggerNodes,
    focusNext,
    focusPrev,
    focusFirst,
    focusLast,
  } = stepperCtx;
  const { step, isDisabled } = useStepItem();
  const isSelected = activeStep === step;
  const id = `stepper-tab-${step}`;
  const panelId = `stepper-panel-${step}`;

  // Register this trigger for keyboard navigation
  const btnRef = useRef<HTMLButtonElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally depends on ref.current
  useEffect(() => {
    if (btnRef.current) {
      registerTrigger(btnRef.current);
    }
  }, [btnRef.current]);

  // Find our index among triggers for navigation
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally depends on ref.current
  const myIdx = useMemo(
    () =>
      triggerNodes.findIndex((n: HTMLButtonElement) => n === btnRef.current),
    [triggerNodes, btnRef.current],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        if (myIdx !== -1 && focusNext) focusNext(myIdx);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        if (myIdx !== -1 && focusPrev) focusPrev(myIdx);
        break;
      case "Home":
        e.preventDefault();
        if (focusFirst) focusFirst();
        break;
      case "End":
        e.preventDefault();
        if (focusLast) focusLast();
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        setActiveStep(step);
        break;
    }
  };

  const triggerState = useMemo<StepperTriggerState>(
    () => ({ state, isLoading, isSelected }),
    [state, isLoading, isSelected],
  );

  const defaultProps = {
    role: "tab" as const,
    id,
    "aria-selected": isSelected,
    "aria-controls": panelId,
    tabIndex: typeof tabIndex === "number" ? tabIndex : isSelected ? 0 : -1,
    "data-slot": "stepper-trigger",
    "data-state": state,
    "data-loading": isLoading,
    className: cn(
      "inline-flex select-none items-center gap-3 rounded-full outline-none focus-visible:z-10 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-60",
      className,
    ),
    onClick: () => setActiveStep(step),
    onKeyDown: handleKeyDown,
    disabled: isDisabled,
    children,
  };

  return useRender({
    defaultTagName: "button",
    render: render as useRender.RenderProp<Record<string, unknown>> | undefined,
    ref: btnRef,
    state: triggerState as unknown as Record<string, unknown>,
    props: mergeProps(defaultProps, props),
  });
}

StepperTrigger.displayName = "StepperTrigger";

function StepperIndicator({
  children,
  className,
}: React.ComponentProps<"div">) {
  const { state, isLoading } = useStepItem();
  const { indicators } = useStepper();

  return (
    <div
      data-slot="stepper-indicator"
      data-state={state}
      className={cn(
        "relative flex size-8 shrink-0 cursor-default items-center justify-center rounded-full border-2 border-muted-foreground/40 font-medium text-muted-foreground text-sm",
        "data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground",
        "data-[state=completed]:border-primary data-[state=completed]:bg-primary data-[state=completed]:text-primary-foreground",
        className,
      )}
    >
      <div className="absolute">
        {indicators &&
        ((isLoading && indicators.loading) ||
          (state === "completed" && indicators.completed) ||
          (state === "active" && indicators.active) ||
          (state === "inactive" && indicators.inactive))
          ? (isLoading && indicators.loading) ||
            (state === "completed" && indicators.completed) ||
            (state === "active" && indicators.active) ||
            (state === "inactive" && indicators.inactive)
          : children}
      </div>
    </div>
  );
}

StepperIndicator.displayName = "StepperIndicator";

function StepperSeparator({ className }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="stepper-separator"
      className={cn(
        "rounded-full bg-muted",
        // Horizontal: fill the grid column (1fr)
        "group-data-[orientation=horizontal]/stepper-nav:mx-3 group-data-[orientation=horizontal]/stepper-nav:h-0.5",
        // Vertical: fixed height
        "group-data-[orientation=vertical]/stepper-nav:mx-2 group-data-[orientation=vertical]/stepper-nav:h-12 group-data-[orientation=vertical]/stepper-nav:w-0.5",
        className,
      )}
    />
  );
}

StepperSeparator.displayName = "StepperSeparator";

function StepperTitle({ children, className }: React.ComponentProps<"span">) {
  const { state } = useStepItem();

  return (
    <span
      data-slot="stepper-title"
      data-state={state}
      className={cn("font-medium text-sm leading-none", className)}
    >
      {children}
    </span>
  );
}

StepperTitle.displayName = "StepperTitle";

function StepperDescription({
  children,
  className,
}: React.ComponentProps<"div">) {
  const { state } = useStepItem();

  return (
    <div
      data-slot="stepper-description"
      data-state={state}
      className={cn("text-muted-foreground text-sm", className)}
    >
      {children}
    </div>
  );
}

StepperDescription.displayName = "StepperDescription";

function StepperNav({ children, className }: React.ComponentProps<"nav">) {
  const { activeStep, orientation, stepsCount } = useStepper();

  // For horizontal orientation, use CSS grid with explicit columns:
  // auto (trigger) + 1fr (separator) pattern, ending with auto for last trigger
  // Example for 3 steps: "auto 1fr auto 1fr auto"
  const gridCols =
    stepsCount > 0
      ? Array.from({ length: stepsCount }, (_, i) =>
          i < stepsCount - 1 ? "auto 1fr" : "auto",
        ).join(" ")
      : undefined;

  return (
    <nav
      data-slot="stepper-nav"
      data-state={activeStep}
      data-orientation={orientation}
      className={cn(
        "group/stepper-nav",
        "data-[orientation=horizontal]:grid data-[orientation=horizontal]:w-full data-[orientation=horizontal]:items-center",
        "data-[orientation=vertical]:inline-flex data-[orientation=vertical]:flex-col",
        className,
      )}
      style={
        orientation === "horizontal" && gridCols
          ? { gridTemplateColumns: gridCols }
          : undefined
      }
    >
      {children}
    </nav>
  );
}

StepperNav.displayName = "StepperNav";

function StepperPanel({ children, className }: React.ComponentProps<"div">) {
  const { activeStep } = useStepper();

  return (
    <div
      data-slot="stepper-panel"
      data-state={activeStep}
      className={cn("w-full", className)}
    >
      {children}
    </div>
  );
}

StepperPanel.displayName = "StepperPanel";

interface StepperContentProps extends React.ComponentProps<"div"> {
  value: number;
  forceMount?: boolean;
}

function StepperContent({
  value,
  forceMount,
  children,
  className,
}: StepperContentProps) {
  const { activeStep } = useStepper();
  const isActive = value === activeStep;

  if (!forceMount && !isActive) {
    return null;
  }

  return (
    <div
      data-slot="stepper-content"
      data-state={activeStep}
      className={cn("w-full", className, !isActive && forceMount && "hidden")}
      hidden={!isActive && forceMount}
    >
      {children}
    </div>
  );
}

StepperContent.displayName = "StepperContent";

export {
  useStepper,
  useStepItem,
  Stepper,
  StepperItem,
  StepperTrigger,
  StepperIndicator,
  StepperSeparator,
  StepperTitle,
  StepperDescription,
  StepperPanel,
  StepperContent,
  StepperNav,
  type StepperProps,
  type StepperItemProps,
  type StepperTriggerProps,
  type StepperContentProps,
};
