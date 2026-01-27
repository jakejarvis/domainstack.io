import { Button } from "@domainstack/ui/button";
import { SiGithub } from "@icons-pack/react-simple-icons";
import { REPOSITORY_SLUG, USER_AGENT } from "@/lib/constants/app";

async function fetchRepoStars(): Promise<number | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPOSITORY_SLUG}`, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": USER_AGENT,
        // token is optional but allows for more frequent/reliable API calls
        ...(process.env.GITHUB_TOKEN
          ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
          : {}),
      },
      next: {
        revalidate: 3600, // 1 hour
      },
    });

    if (!res.ok) return null;

    const json = (await res.json()) as { stargazers_count?: number };

    return typeof json.stargazers_count === "number"
      ? json.stargazers_count
      : null;
  } catch {
    return null;
  }
}

export async function GithubStars() {
  const stars = await fetchRepoStars();
  const label =
    stars === null
      ? "0"
      : new Intl.NumberFormat("en-US", {
          notation: "compact",
          compactDisplay: "short",
        }).format(stars);

  return (
    <Button
      variant="ghost"
      size="sm"
      nativeButton={false}
      render={
        <a
          href={`https://github.com/${REPOSITORY_SLUG}`}
          target="_blank"
          rel="noopener"
          className="group inline-flex shrink-0 items-center gap-2"
          aria-label="Open GitHub repository"
        >
          <SiGithub className="flex size-3.5 shrink-0 transition-colors group-hover:text-foreground" />
          <span className="relative inline-block font-mono text-[13px] text-muted-foreground leading-none transition-colors group-hover:text-foreground">
            {label}
          </span>
        </a>
      }
    />
  );
}
