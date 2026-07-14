import { Spinner } from "@/components/ui/spinner";

export default function Loading() {
  return (
    <div className="flex justify-center py-12">
      <Spinner className="size-8" />
    </div>
  );
}
