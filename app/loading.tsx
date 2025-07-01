import { LoaderCircle } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex h-screen items-center justify-center">
      <LoaderCircle className="size-8 animate-spin" />
    </div>
  );
}
