import { View } from "react-native";
import { useCSSVariable } from "uniwind";

import { Spinner } from "@/components/spinner";
import { Symbol } from "@/components/symbol";
import { Text } from "@/components/text";
import { cn } from "@/lib/cn";

type StepState = "completed" | "active" | "pending";

function stepState(step: number, current: number): StepState {
  if (step < current) return "completed";
  if (step === current) return "active";
  return "pending";
}

function StepDot({ state, label, loading }: { state: StepState; label: number; loading: boolean }) {
  const accentBlue = useCSSVariable("--color-accent-blue") as string;
  const containerClass = cn(
    "size-7 items-center justify-center rounded-full border",
    state === "completed" && "border-accent-blue/40 bg-accent-blue/15",
    state === "active" && "border-primary bg-primary",
    state === "pending" && "border-border bg-muted",
  );

  return (
    <View className={containerClass}>
      {loading ? (
        <Spinner variant={state === "pending" ? "muted" : "default"} />
      ) : state === "completed" ? (
        <Symbol color={accentBlue} name={{ android: "check", ios: "checkmark" }} size={16} />
      ) : (
        <Text
          className={cn(
            "text-xs font-semibold",
            state === "active" ? "text-primary-foreground" : "text-muted-foreground",
          )}
        >
          {label}
        </Text>
      )}
    </View>
  );
}

export function StepIndicator({
  current,
  loadingStep,
}: {
  current: 1 | 2 | 3;
  loadingStep?: 1 | 2 | 3;
}) {
  const steps: Array<{ step: 1 | 2 | 3; label: string }> = [
    { step: 1, label: "Enter" },
    { step: 2, label: "Verify" },
    { step: 3, label: "Done" },
  ];

  return (
    <View className="gap-2">
      <View className="flex-row items-center">
        {steps.map((entry, index) => {
          const state = stepState(entry.step, current);
          const nextState = steps[index + 1] ? stepState(steps[index + 1].step, current) : null;
          const separatorActive = state === "completed";
          return (
            <View className="flex-row items-center" key={entry.step} style={{ flex: 1 }}>
              <StepDot label={entry.step} loading={loadingStep === entry.step} state={state} />
              {nextState !== null ? (
                <View
                  className={cn("h-px flex-1", separatorActive ? "bg-accent-blue/50" : "bg-border")}
                />
              ) : null}
            </View>
          );
        })}
      </View>
      <View className="flex-row items-center">
        {steps.map((entry) => {
          const state = stepState(entry.step, current);
          return (
            <View key={entry.step} style={{ flex: 1 }}>
              <Text
                className={cn(
                  "text-xs",
                  state === "active" ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {entry.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
