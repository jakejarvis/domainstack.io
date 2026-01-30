import { getFrontmostApplication, showToast, Toast } from "@raycast/api";
import { runAppleScript } from "@raycast/utils";
import { useEffect, useState } from "react";
import { extractDomain } from "../utils/domain";

interface BrowserTabResult {
  url: string | null;
  domain: string | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * AppleScript to get URL from Safari.
 */
const SAFARI_SCRIPT = `
tell application "Safari"
  if (count of windows) > 0 then
    set currentTab to current tab of front window
    return URL of currentTab
  end if
end tell
return ""
`;

/**
 * AppleScript to get URL from Chrome-based browsers.
 */
function getChromiumScript(appName: string): string {
  return `
tell application "${appName}"
  if (count of windows) > 0 then
    set currentTab to active tab of front window
    return URL of currentTab
  end if
end tell
return ""
`;
}

/**
 * AppleScript to get URL from Firefox.
 */
const FIREFOX_SCRIPT = `
tell application "System Events"
  tell process "Firefox"
    set frontmost to true
    keystroke "l" using command down
    delay 0.1
    keystroke "c" using command down
    delay 0.1
    keystroke "w" using command down
  end tell
end tell
return the clipboard
`;

/**
 * Browser configurations with their AppleScript getters.
 */
const BROWSER_SCRIPTS: Record<string, string> = {
  Safari: SAFARI_SCRIPT,
  "Google Chrome": getChromiumScript("Google Chrome"),
  Arc: getChromiumScript("Arc"),
  "Microsoft Edge": getChromiumScript("Microsoft Edge"),
  Brave: getChromiumScript("Brave Browser"),
  "Brave Browser": getChromiumScript("Brave Browser"),
  Chromium: getChromiumScript("Chromium"),
  Vivaldi: getChromiumScript("Vivaldi"),
  Opera: getChromiumScript("Opera"),
  Firefox: FIREFOX_SCRIPT,
};

/**
 * Supported browser bundle identifiers.
 */
const SUPPORTED_BROWSERS = new Set([
  "com.apple.Safari",
  "com.google.Chrome",
  "company.thebrowser.Browser", // Arc
  "com.microsoft.edgemac",
  "com.brave.Browser",
  "org.chromium.Chromium",
  "com.vivaldi.Vivaldi",
  "com.operasoftware.Opera",
  "org.mozilla.firefox",
]);

/**
 * Hook to get the URL from the current browser tab.
 */
export function useBrowserTab(): BrowserTabResult {
  const [result, setResult] = useState<BrowserTabResult>({
    url: null,
    domain: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    async function fetchBrowserUrl() {
      try {
        const app = await getFrontmostApplication();

        if (!app.bundleId || !SUPPORTED_BROWSERS.has(app.bundleId)) {
          setResult({
            url: null,
            domain: null,
            isLoading: false,
            error: `"${app.name}" is not a supported browser. Please switch to Safari, Chrome, Arc, Edge, Brave, or Firefox.`,
          });
          return;
        }

        const script = BROWSER_SCRIPTS[app.name];
        if (!script) {
          setResult({
            url: null,
            domain: null,
            isLoading: false,
            error: `Could not get URL from "${app.name}".`,
          });
          return;
        }

        const url = await runAppleScript(script);

        if (!url || url.trim() === "") {
          setResult({
            url: null,
            domain: null,
            isLoading: false,
            error: "No URL found in the current browser tab.",
          });
          return;
        }

        const domain = extractDomain(url);

        if (!domain) {
          setResult({
            url,
            domain: null,
            isLoading: false,
            error: `Could not extract a valid domain from "${url}".`,
          });
          return;
        }

        setResult({
          url,
          domain,
          isLoading: false,
          error: null,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to get browser URL";
        await showToast({
          style: Toast.Style.Failure,
          title: "Error",
          message,
        });
        setResult({
          url: null,
          domain: null,
          isLoading: false,
          error: message,
        });
      }
    }

    void fetchBrowserUrl();
  }, []);

  return result;
}
