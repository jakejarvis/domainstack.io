import { beforeEach, describe, expect, it } from "vitest";

import { usePortfolioStore } from "./portfolio-store";

function reset() {
  usePortfolioStore.setState({
    query: "",
    selection: { ids: new Set<string>(), mode: "idle" },
    sort: "name",
    status: "all",
  });
}

describe("portfolio store selection", () => {
  beforeEach(() => {
    reset();
  });

  it("enterSelection switches mode and seeds the initial id", () => {
    usePortfolioStore.getState().enterSelection("abc");
    const state = usePortfolioStore.getState().selection;
    expect(state.mode).toBe("selecting");
    expect(Array.from(state.ids)).toEqual(["abc"]);
  });

  it("enterSelection without an id starts an empty selection", () => {
    usePortfolioStore.getState().enterSelection();
    const state = usePortfolioStore.getState().selection;
    expect(state.mode).toBe("selecting");
    expect(state.ids.size).toBe(0);
  });

  it("toggle adds and removes ids", () => {
    const store = usePortfolioStore.getState();
    store.enterSelection();
    store.toggle("a");
    store.toggle("b");
    expect(Array.from(usePortfolioStore.getState().selection.ids).sort()).toEqual(["a", "b"]);
    store.toggle("a");
    expect(Array.from(usePortfolioStore.getState().selection.ids)).toEqual(["b"]);
  });

  it("clear empties the selection but stays in selecting mode", () => {
    const store = usePortfolioStore.getState();
    store.enterSelection("a");
    store.toggle("b");
    store.clear();
    const state = usePortfolioStore.getState().selection;
    expect(state.mode).toBe("selecting");
    expect(state.ids.size).toBe(0);
  });

  it("selectAll replaces the selection set", () => {
    const store = usePortfolioStore.getState();
    store.enterSelection("a");
    store.selectAll(["x", "y", "z"]);
    const state = usePortfolioStore.getState().selection;
    expect(Array.from(state.ids).sort()).toEqual(["x", "y", "z"]);
    expect(state.mode).toBe("selecting");
  });

  it("exitSelection returns to idle and clears ids", () => {
    const store = usePortfolioStore.getState();
    store.enterSelection("a");
    store.toggle("b");
    store.exitSelection();
    const state = usePortfolioStore.getState().selection;
    expect(state.mode).toBe("idle");
    expect(state.ids.size).toBe(0);
  });

  it("toggle preserves immutability of the prior Set reference", () => {
    const store = usePortfolioStore.getState();
    store.enterSelection("a");
    const before = usePortfolioStore.getState().selection.ids;
    store.toggle("b");
    const after = usePortfolioStore.getState().selection.ids;
    expect(after).not.toBe(before);
    expect(before.has("b")).toBe(false);
    expect(after.has("b")).toBe(true);
  });
});
