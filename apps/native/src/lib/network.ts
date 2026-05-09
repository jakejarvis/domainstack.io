import * as Network from "expo-network";

export async function assertOnline(): Promise<void> {
  const state = await Network.getNetworkStateAsync();
  if (!state.isConnected || state.isInternetReachable === false) {
    throw new Error("A network connection is required for this action.");
  }
}
