import { FileQuestionMark } from "lucide-react";
import type { Metadata } from "next";
import { DomainSearch } from "@/components/domain/domain-search";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export const metadata: Metadata = {
  title: "Not Found",
  description: "The page you're looking for doesn't exist.",
};

export default function NotFound() {
  return (
    <div className="container mx-auto my-auto flex items-center justify-center px-6">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileQuestionMark />
          </EmptyMedia>
          <EmptyTitle>404 - Not Found</EmptyTitle>
          <EmptyDescription>
            <p>The page you&apos;re looking for doesn&apos;t exist.</p>{" "}
            <p>Try searching for a domain below.</p>
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="w-full">
          <DomainSearch variant="lg" />
        </EmptyContent>
      </Empty>
    </div>
  );
}
