import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mt-8 grid w-full grid-cols-6 gap-4">
      <div className="col-span-6">
        <Skeleton />
      </div>
      <div className="col-span-6 md:col-span-3">
        <Skeleton />
      </div>
      <div className="col-span-6 md:col-span-3">
        <Skeleton />
      </div>
      <div className="col-span-6">
        <Skeleton />
      </div>
    </div>
  );
}
