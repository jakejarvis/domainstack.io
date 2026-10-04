/**
 * "Global Preferences" card description. `email` is a node so the loading
 * skeleton can render the static copy with a placeholder in its place.
 */
export function GlobalPreferencesDescription({ email }: { email: React.ReactNode }) {
  return (
    <>
      Alerts will be sent to <span className="font-semibold">{email}</span>. You can change it on
      the Account tab.
    </>
  );
}
