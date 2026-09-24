import {
  ResponsiveTooltip,
  ResponsiveTooltipContent,
  ResponsiveTooltipTrigger,
} from "@domainstack/ui/responsive-tooltip";

/**
 * "Global Preferences" card description. `email` is a node so the loading
 * skeleton can render the static copy with a placeholder in its place.
 */
export function GlobalPreferencesDescription({ email }: { email: React.ReactNode }) {
  return (
    <>
      Alerts will be sent to <span className="font-semibold">{email}</span>.{" "}
      <ResponsiveTooltip>
        <ResponsiveTooltipTrigger
          render={
            <span className="cursor-help text-muted-foreground underline decoration-dotted underline-offset-3" />
          }
        >
          (Why can&rsquo;t I change this?)
        </ResponsiveTooltipTrigger>
        <ResponsiveTooltipContent>
          <div className="space-y-2">
            <p>
              This is the email address that was verified with the linked account provider you chose
              at sign up.
            </p>
            <p>
              To change it, sign in with a different external account or{" "}
              <a
                href="/help#contact"
                className="underline underline-offset-3"
                target="_blank"
                rel="noopener"
              >
                contact support
              </a>
              .
            </p>
          </div>
        </ResponsiveTooltipContent>
      </ResponsiveTooltip>
    </>
  );
}
