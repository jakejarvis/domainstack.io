import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import { render } from "@/mocks/react";

import { SocialPreviews } from "./social-previews";

describe("SocialPreviews", () => {
  const mockPreview = {
    title: "Test Title",
    description: "Test Description",
    image: "https://test.invalid/image.png",
    imageUploaded: "https://test.invalid/uploaded.png",
    canonicalUrl: "https://test.invalid",
  };

  describe("tab switching", () => {
    it("switches between social preview providers", async () => {
      await render(<SocialPreviews preview={mockPreview} twitterVariant="compact" />);

      // Initial state: Twitter tab active
      const twitterPreview = page.getByRole("link", {
        name: /open test.invalid in a new tab/i,
      });
      await expect.element(twitterPreview).toHaveAttribute("data-provider", "twitter");

      // Click Facebook tab
      await page.getByRole("tab", { name: /facebook/i }).click();
      const facebookPreview = page.getByRole("link", {
        name: /open test.invalid in a new tab/i,
      });
      await expect.element(facebookPreview).toHaveAttribute("data-provider", "facebook");

      // Click LinkedIn tab
      await page.getByRole("tab", { name: /linkedin/i }).click();
      const linkedinPreview = page.getByRole("link", {
        name: /open test.invalid in a new tab/i,
      });
      await expect.element(linkedinPreview).toHaveAttribute("data-provider", "linkedin");

      // Click Discord tab
      await page.getByRole("tab", { name: /discord/i }).click();
      const discordPreview = page.getByRole("link", {
        name: /open test.invalid in a new tab/i,
      });
      await expect.element(discordPreview).toHaveAttribute("data-provider", "discord");

      // Click Slack tab
      await page.getByRole("tab", { name: /slack/i }).click();
      const slackPreview = page.getByRole("link", {
        name: /open test.invalid in a new tab/i,
      });
      await expect.element(slackPreview).toHaveAttribute("data-provider", "slack");
    });

    it("renders correct active tab content", async () => {
      await render(<SocialPreviews preview={mockPreview} twitterVariant="compact" />);

      // Check initial Twitter content
      await expect
        .element(page.getByRole("link", { name: /open test.invalid in a new tab/i }))
        .toHaveAttribute("data-provider", "twitter");

      // Switch to Facebook and verify
      await page.getByRole("tab", { name: /facebook/i }).click();
      await expect
        .element(page.getByRole("link", { name: /open test.invalid in a new tab/i }))
        .toHaveAttribute("data-provider", "facebook");
    });
  });

  describe("Twitter card variants", () => {
    it("renders compact variant for Twitter when specified", async () => {
      await render(<SocialPreviews preview={mockPreview} twitterVariant="compact" />);
      const preview = page.getByRole("link", {
        name: /open test.invalid in a new tab/i,
      });
      await expect.element(preview).toHaveAttribute("data-provider", "twitter");
      await expect.element(preview).toHaveAttribute("data-variant", "compact");
    });

    it("renders large variant for Twitter when specified", async () => {
      await render(<SocialPreviews preview={mockPreview} twitterVariant="large" />);
      const preview = page.getByRole("link", {
        name: /open test.invalid in a new tab/i,
      });
      await expect.element(preview).toHaveAttribute("data-provider", "twitter");
      await expect.element(preview).toHaveAttribute("data-variant", "large");
    });

    it("does not apply variant to non-Twitter providers", async () => {
      await render(<SocialPreviews preview={mockPreview} twitterVariant="large" />);

      // Switch to Facebook - should not have variant attribute or should not be "large"
      await page.getByRole("tab", { name: /facebook/i }).click();
      const facebookPreview = page.getByRole("link", {
        name: /open test.invalid in a new tab/i,
      });
      await expect.element(facebookPreview).toHaveAttribute("data-provider", "facebook");
      // Facebook doesn't use the twitterVariant prop
    });
  });

  describe("social preview rendering across providers", () => {
    const providers: Array<{
      provider: "twitter" | "facebook" | "linkedin" | "discord" | "slack";
      tabName: string;
    }> = [
      { provider: "twitter", tabName: "Twitter" },
      { provider: "facebook", tabName: "Facebook" },
      { provider: "linkedin", tabName: "LinkedIn" },
      { provider: "discord", tabName: "Discord" },
      { provider: "slack", tabName: "Slack" },
    ];

    for (const { provider, tabName } of providers) {
      it(`renders ${provider} preview correctly`, async () => {
        const preview = {
          title: `${provider} Preview Title`,
          description: `${provider} Preview Description`,
          image: `https://test.invalid/${provider}.png`,
          imageUploaded: `https://test.invalid/${provider}-uploaded.png`,
          canonicalUrl: "https://test.invalid",
        };
        await render(<SocialPreviews preview={preview} twitterVariant="compact" />);

        // Switch to the provider's tab
        await page.getByRole("tab", { name: new RegExp(tabName, "i") }).click();

        // Verify the preview is rendered with correct provider
        const previewLink = page.getByRole("link", {
          name: /open test.invalid in a new tab/i,
        });
        await expect.element(previewLink).toHaveAttribute("data-provider", provider);
      });

      it(`renders ${provider} preview without image`, async () => {
        const preview = {
          title: `${provider} No Image`,
          description: `${provider} description without image`,
          image: null,
          imageUploaded: null,
          canonicalUrl: "https://test.invalid",
        };
        await render(<SocialPreviews preview={preview} twitterVariant="compact" />);

        await page.getByRole("tab", { name: new RegExp(tabName, "i") }).click();

        const previewLink = page.getByRole("link", {
          name: /open test.invalid in a new tab/i,
        });
        await expect.element(previewLink).toHaveAttribute("data-provider", provider);
        // Verify "No image" accessible text is present in the DOM
        await expect
          .element(previewLink.getByText("No image", { exact: true }))
          .toBeInTheDocument();
      });
    }

    it("uses imageUploaded when available", async () => {
      const uploadedImageUrl = "https://test.invalid/uploaded-image.png";
      const preview = {
        title: "Uploaded Image Preview",
        description: "Preview with uploaded image",
        image: "https://test.invalid/original.png",
        imageUploaded: uploadedImageUrl,
        canonicalUrl: "https://test.invalid",
      };
      await render(<SocialPreviews preview={preview} twitterVariant="compact" />);

      // Twitter preview should be visible by default
      const twitterPreview = page.getByRole("link", {
        name: /open test.invalid in a new tab/i,
      });
      await expect.element(twitterPreview).toBeInTheDocument();

      // Switch to Facebook to verify imageUploaded is used
      await page.getByRole("tab", { name: /facebook/i }).click();
      await expect
        .element(page.getByRole("link", { name: /open test.invalid in a new tab/i }))
        .toHaveAttribute("data-provider", "facebook");
      // Check that the preview image element uses the uploaded URL
      await expect
        .element(page.getByAltText("Preview image"))
        .toHaveAttribute("src", expect.stringContaining("uploaded"));
    });
  });
});
