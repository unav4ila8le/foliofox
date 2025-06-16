import { Logo } from "@/components/ui/logos/logo";

export function Branding() {
  return (
    <div className="flex flex-col items-center gap-2">
      <Logo height={24} />
      <p className="text-muted-foreground truncate text-center text-xs">
        Copyright © {new Date().getFullYear()}. All rights reserved.
      </p>
    </div>
  );
}
