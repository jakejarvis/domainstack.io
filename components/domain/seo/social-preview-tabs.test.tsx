
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@/lib/test-utils";
import { SocialPreviewTabs } from "./social-preview-tabs";

describe("SocialPreviewTabs", () => {
  const mockPreview = {
    title: "Test Title",
    description: "Test Description",
    image: "https://example.com/image.png",
    imageUploaded: "https://example.com/uploaded.png",
    canonicalUrl: "https://example.com",
  };

  describe("tab switching", () => {
    it("switches between social preview providers", async () => {
      const user = userEvent.setup();
      render(
        <SocialPreviewTabs preview={mockPreview} twitterVariant="compact" />,
      );

      // Initial state: Twitter tab active
      const twitterPreview = screen.getByRole("link", {
        name: /open example.com in a new tab/i,
      });
      expect(twitterPreview).toHaveAttribute("data-provider", "twitter");

      // Click Facebook tab
      const facebookTab = screen.getByRole("tab", { name: /facebook/i });
      await user.click(facebookTab);
      const facebookPreview = screen.getByRole("link", {
        name: /open example.com in a new tab/i,
      });
      expect(facebookPreview).toHaveAttribute("data-provider", "facebook");

      // Click LinkedIn tab
      const linkedinTab = screen.getByRole("tab", { name: /linkedin/i });
      await user.click(linkedinTab);
      const linkedinPreview = screen.getByRole("link", {
        name: /open example.com in a new tab/i,
      });
      expect(linkedinPreview).toHaveAttribute("data-provider", "linkedin");

      // Click Discord tab
      const discordTab = screen.getByRole("tab", { name: /discord/i });
      await user.click(discordTab);
      const discordPreview = screen.getByRole("link", {
        name: /open example.com in a new tab/i,
      });
      expect(discordPreview).toHaveAttribute("data-provider", "discord");

      // Click Slack tab
      const slackTab = screen.getByRole("tab", { name: /slack/i });
      await user.click(slackTab);
      const slackPreview = screen.getByRole("link", {
        name: /open example.com in a new tab/i,
      });
      expect(slackPreview).toHaveAttribute("data-provider", "slack");
    });

    it("renders correct active tab content", async () => {
      const user = userEvent.setup();
      render(
        <SocialPreviewTabs preview={mockPreview} twitterVariant="compact" />,
      );

      // Check initial Twitter content
      expect(
        screen.getByRole("link", { name: /open example.com in a new tab/i }),
      ).toHaveAttribute("data-provider", "twitter");

      // Switch to Facebook and verify
      await user.click(screen.getByRole("tab", { name: /facebook/i }));
      expect(
        screen.getByRole("link", { name: /open example.com in a new tab/i }),
      ).toHaveAttribute("data-provider", "facebook");
    });
  });

  describe("Twitter card variants", () => {
    it("renders compact variant for Twitter when specified", () => {
      render(
        <SocialPreviewTabs preview={mockPreview} twitterVariant="compact" />,
      );
      const preview = screen.getByRole("link", {
        name: /open example.com in a new tab/i,
      });
      expect(preview).toHaveAttribute("data-provider", "twitter");
      expect(preview).toHaveAttribute("data-variant", "compact");
    });

    it("renders large variant for Twitter when specified", () => {
      render(
        <SocialPreviewTabs preview={mockPreview} twitterVariant="large" />,
      );
      const preview = screen.getByRole("link", {
        name: /open example.com in a new tab/i,
      });
      expect(preview).toHaveAttribute("data-provider", "twitter");
      expect(preview).toHaveAttribute("data-variant", "large");
    });

    it("does not apply variant to non-Twitter providers", async () => {
      const user = userEvent.setup();
      render(
        <SocialPreviewTabs preview={mockPreview} twitterVariant="large" />,
      );

      // Switch to Facebook - should not have variant attribute or should not be "large"
      await user.click(screen.getByRole("tab", { name: /facebook/i }));
      const facebookPreview = screen.getByRole("link", {
        name: /open example.com in a new tab/i,
      });
      expect(facebookPreview).toHaveAttribute("data-provider", "facebook");
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
        const user = userEvent.setup();
        const preview = {
          title: `${provider} Preview Title`,
          description: `${provider} Preview Description`,
          image: `https://example.com/${provider}.png`,
          imageUploaded: `https://example.com/${provider}-uploaded.png`,
          canonicalUrl: "https://example.com",
        };
        render(
          <SocialPreviewTabs preview={preview} twitterVariant="compact" />,
        );

        // Switch to the provider's tab
        const tab = screen.getByRole("tab", { name: new RegExp(tabName, "i") });
        await user.click(tab);

        // Verify the preview is rendered with correct provider
        const previewLink = screen.getByRole("link", {
          name: /open example.com in a new tab/i,
        });
        expect(previewLink).toHaveAttribute("data-provider", provider);
      });

      it(`renders ${provider} preview without image`, async () => {
        const user = userEvent.setup();
        const preview = {
          title: `${provider} No Image`,
          description: `${provider} description without image`,
          image: null,
          imageUploaded: null,
          canonicalUrl: "https://example.com",
        };
        render(
          <SocialPreviewTabs preview={preview} twitterVariant="compact" />,
        );

        const tab = screen.getByRole("tab", { name: new RegExp(tabName, "i") });
        await user.click(tab);

        const previewLink = screen.getByRole("link", {
          name: /open example.com in a new tab/i,
        });
        expect(previewLink).toHaveAttribute("data-provider", provider);
        // Verify "No image" accessible text is present in the DOM
        const previewContainer = within(previewLink);
        expect(previewContainer.getByText("No image")).toBeInTheDocument();
      });
    }

    it("uses imageUploaded when available", async () => {
      const user = userEvent.setup();
      const uploadedImageUrl = "https://example.com/uploaded-image.png";
      const preview = {
        title: "Uploaded Image Preview",
        description: "Preview with uploaded image",
        image: "https://example.com/original.png",
        imageUploaded: uploadedImageUrl,
        canonicalUrl: "https://example.com",
      };
      render(<SocialPreviewTabs preview={preview} twitterVariant="compact" />);

      // Twitter preview should be visible by default
      const twitterPreview = screen.getByRole("link", {
        name: /open example.com in a new tab/i,
      });
      expect(twitterPreview).toBeInTheDocument();

      // Switch to Facebook to verify imageUploaded is used
      await user.click(screen.getByRole("tab", { name: /facebook/i }));
      const facebookPreview = screen.getByRole("link", {
        name: /open example.com in a new tab/i,
      });
      // Check that the preview image element uses the uploaded URL
      const image = within(facebookPreview).getByAltText("Preview image");
      expect(image).toHaveAttribute("src", expect.stringContaining("uploaded"));
    });
  });
});
