"use client";

import Image from "next/image";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

import heroLight from "@/public/images/homepage/foliofox-preview-light.png";
import heroDark from "@/public/images/homepage/foliofox-preview-dark.png";

interface Props {
  alt?: string;
  className?: string;
  priority?: boolean;
}

export function HeroImage({
  alt = "Foliofox preview",
  className,
  priority,
}: Props) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Avoid hydration mismatch: render light version until mounted
  const src = mounted && resolvedTheme === "dark" ? heroDark : heroLight;

  return (
    <Image
      src={src}
      alt={alt}
      priority={priority}
      placeholder="blur"
      className={cn(
        "mx-auto h-auto w-full max-w-5xl rounded-sm border lg:rounded-lg",
        className,
      )}
    />
  );
}
