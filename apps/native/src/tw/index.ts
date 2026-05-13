import { useUnstableNativeVariable } from "nativewind";

export function useCSSVariable(name: `--${string}`): string {
  const readVariable = useUnstableNativeVariable as unknown as (variableName: string) => unknown;
  return readVariable(name) as string;
}
