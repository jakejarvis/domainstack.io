import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type Step = {
  title: string;
};

export type StepperProps = {
  steps: Step[];
  currentStep: number; // 1-indexed
  className?: string;
};

export function Stepper({ steps, currentStep, className }: StepperProps) {
  return (
    <div
      className={cn("flex w-full items-center", className)}
      role="group"
      aria-label={`Step ${currentStep} of ${steps.length}: ${steps[currentStep - 1]?.title}`}
    >
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const isActive = stepNumber === currentStep;
        const isCompleted = stepNumber < currentStep;
        const isLast = stepNumber === steps.length;

        return (
          <div key={stepNumber} className="contents">
            {/* Circle with tooltip */}
            <Tooltip>
              <TooltipTrigger
                render={
                  <div
                    className={cn(
                      "flex size-8 shrink-0 cursor-default items-center justify-center rounded-full font-medium text-sm transition-all duration-300",
                      isActive || isCompleted
                        ? "bg-primary text-primary-foreground"
                        : "border-2 border-muted-foreground/40 text-muted-foreground",
                    )}
                    aria-current={isActive ? "step" : undefined}
                  >
                    {stepNumber}
                  </div>
                }
              />
              <TooltipContent>
                <p>{step.title}</p>
              </TooltipContent>
            </Tooltip>

            {/* Line */}
            {!isLast && (
              <div
                className={cn(
                  "mx-3 h-px flex-1",
                  isCompleted ? "bg-primary" : "bg-border",
                )}
                aria-hidden="true"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
