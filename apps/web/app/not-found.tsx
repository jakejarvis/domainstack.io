import { msg } from "@lingui/core/macro";
import { IconFileX } from "@tabler/icons-react";
import type { Metadata } from "next";

import { SearchClient } from "@/components/search/search-client";
import { getI18n } from "@/lib/i18n-server";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@domainstack/ui/empty";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await getI18n();
  return {
    title: i18n._(msg`Not Found`),
    description: i18n._(msg`The page you’re looking for doesn’t exist.`),
  };
}

export default async function NotFound() {
  const i18n = await getI18n();

  return (
    <div className="container mx-auto my-auto flex items-center justify-center px-6">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconFileX />
          </EmptyMedia>
          <EmptyTitle>{i18n._(msg`404 — Not Found`)}</EmptyTitle>
          <EmptyDescription>
            <p>{i18n._(msg`The page you’re looking for doesn’t exist.`)}</p>{" "}
            <p>{i18n._(msg`Try searching for a domain below.`)}</p>
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="w-full">
          <SearchClient variant="lg" />
        </EmptyContent>
      </Empty>
    </div>
  );
}
