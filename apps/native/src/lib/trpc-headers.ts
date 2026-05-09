export function buildTrpcHeaders(cookieHeader: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "x-trpc-source": "expo-react-native",
  };

  if (cookieHeader) {
    headers.Cookie = cookieHeader;
  }

  return headers;
}
