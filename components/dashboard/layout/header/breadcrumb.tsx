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

import { fetchSingleHolding } from "@/server/holdings/fetch";
import { Skeleton } from "@/components/ui/custom/skeleton";

// Separate component for holding name fetching
function HoldingName({ holdingId }: { holdingId: string }) {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    fetchSingleHolding(holdingId)
      .then((holding) => setName(holding.name))
      .catch(() => setName("Unknown Holding"));
  }, [holdingId]);

  if (!name) {
    return <Skeleton className="h-4 w-24" />;
  }

  return <>{name}</>;
}

// Main breadcrumb component
export function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean).slice(1);

  // Check if we're on a holding page
  const isHoldingPage =
    segments[0] === "holdings" && segments[1] && segments[1] !== "archived";
  const holdingId = isHoldingPage ? segments[1] : null;

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
            const isHoldingSegment = segment === holdingId;

            return (
              <React.Fragment key={href}>
                <BreadcrumbItem>
                  {isLast ? (
                    <BreadcrumbPage>
                      {isHoldingSegment && holdingId ? (
                        <HoldingName holdingId={holdingId} />
                      ) : (
                        segment.charAt(0).toUpperCase() + segment.slice(1)
                      )}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link href={href}>
                        {isHoldingSegment && holdingId ? (
                          <HoldingName holdingId={holdingId} />
                        ) : (
                          segment.charAt(0).toUpperCase() + segment.slice(1)
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
