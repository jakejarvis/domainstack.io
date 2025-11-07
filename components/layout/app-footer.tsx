import { HeartAnimated } from "@/components/heart";

export function AppFooter() {
  return (
    <footer className="px-4 py-6 text-center text-muted-foreground text-xs leading-relaxed sm:px-6 [&_a]:text-foreground/85 [&_a]:hover:text-foreground/60 [&_a]:hover:no-underline [&_svg]:inline-block [&_svg]:size-4 [&_svg]:px-[1px] [&_svg]:align-text-bottom">
      <p>
        Made with{" "}
        <HeartAnimated className="fill-destructive stroke-destructive" /> and{" "}
        <a href="https://nextjs.org/" target="_blank" rel="noopener">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="0"
            viewBox="0 0 24 24"
            className="top-px"
            aria-hidden
          >
            <path d="M18.665 21.978C16.758 23.255 14.465 24 12 24 5.377 24 0 18.623 0 12S5.377 0 12 0s12 5.377 12 12c0 3.583-1.574 6.801-4.067 9.001L9.219 7.2H7.2v9.596h1.615V9.251l9.85 12.727Zm-3.332-8.533 1.6 2.061V7.2h-1.6v6.245Z" />
          </svg>
          <span className="sr-only">Next.js</span>
        </a>{" "}
        by{" "}
        <a href="https://jarv.is/" target="_blank" rel="noopener">
          @jakejarvis
        </a>
        .
      </p>
      <p>
        Brick logo by{" "}
        <a
          href="https://thenounproject.com/creator/arypst/"
          target="_blank"
          rel="noopener"
        >
          Ary Prasetyo
        </a>{" "}
        from{" "}
        <a href="https://thenounproject.com/" target="_blank" rel="noopener">
          Noun Project
        </a>{" "}
        (CC BY 3.0).
      </p>
    </footer>
  );
}
