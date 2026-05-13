import { vi } from "vitest";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    clear: async () => undefined,
    getAllKeys: async (): Promise<string[]> => [],
    getItem: async (): Promise<string | null> => null,
    multiGet: async (): Promise<Array<[string, string | null]>> => [],
    multiRemove: async () => undefined,
    multiSet: async () => undefined,
    removeItem: async () => undefined,
    setItem: async () => undefined,
  },
}));
