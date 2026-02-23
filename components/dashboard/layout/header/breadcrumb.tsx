"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Breadcrumb as BreadcrumbUI,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

import { fetchSinglePosition } from "@/server/positions/fetch";
import { Skeleton } from "@/components/ui/custom/skeleton";

// Helper function to format segment names
function formatSegmentName(segment: string): string {
  // Preserve acronym casing for known route labels.
  if (segment === "ai-chat") {
    return "AI Chat";
  }

  return segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Separate component for position name fetching
function PositionName({ positionId }: { positionId: string }) {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    fetchSinglePosition(positionId, { includeArchived: true })
      .then((position) => setName(position.name))
      .catch(() => setName("Unknown Position"));
  }, [positionId]);

  if (!name) {
    return <Skeleton className="h-4 w-24" />;
  }

  return <>{name}</>;
}

// Main breadcrumb component
export function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean).slice(1);

  // Check if we're on a position page
  const isPositionPage =
    (segments[0] === "assets" || segments[0] === "liabilities") &&
    segments[1] &&
    segments[1] !== "archived";
  const positionId = isPositionPage ? segments[1] : null;

  return (
    <BreadcrumbUI>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/dashboard">Dashboard</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        {segments.length === 0 ? (
          <BreadcrumbItem>
            <BreadcrumbPage>Home</BreadcrumbPage>
          </BreadcrumbItem>
        ) : (
          segments.map((segment, index) => {
            const href = `/dashboard/${segments.slice(0, index + 1).join("/")}`;
            const isLast = index === segments.length - 1;
            const isPositionSegment = segment === positionId;

            return (
              <React.Fragment key={href}>
                <BreadcrumbItem>
                  {isLast ? (
                    <BreadcrumbPage>
                      {isPositionSegment && positionId ? (
                        <PositionName positionId={positionId} />
                      ) : (
                        formatSegmentName(segment)
                      )}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link href={href}>
                        {isPositionSegment && positionId ? (
                          <PositionName positionId={positionId} />
                        ) : (
                          formatSegmentName(segment)
                        )}
                      </Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {!isLast && <BreadcrumbSeparator />}
              </React.Fragment>
            );
          })
        )}
      </BreadcrumbList>
    </BreadcrumbUI>
  );
}
