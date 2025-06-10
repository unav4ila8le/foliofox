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

import { fetchSingleHolding } from "@/server/holdings/fetch-single";

export function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean).slice(1);
  const [holdingName, setHoldingName] = useState<string | null>(null);

  // Check if we're on a holding page
  const isHoldingPage =
    segments[0] === "assets" && segments[1] && segments[1] !== "archived";
  const holdingId = isHoldingPage ? segments[1] : null;

  useEffect(() => {
    if (holdingId) {
      fetchSingleHolding(holdingId)
        .then((holding) => setHoldingName(holding.name))
        .catch(() => setHoldingName("Unknown Holding"));
    }
  }, [holdingId]);

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
            // Use holding name if this is the holding segment
            const label =
              segment === holdingId && holdingName
                ? holdingName
                : segment.charAt(0).toUpperCase() + segment.slice(1);

            return (
              <React.Fragment key={href}>
                <BreadcrumbItem>
                  {isLast ? (
                    <BreadcrumbPage>{label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link href={href}>{label}</Link>
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
