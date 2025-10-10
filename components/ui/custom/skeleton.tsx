import { Skeleton as ShadcnSkeleton } from "@/components/ui/skeleton";

interface SkeletonProps extends React.ComponentProps<"div"> {
  /**
   * Number of skeleton items to render
   * @default 1
   */
  count?: number;
}

function Skeleton({ className, count = 1, ...props }: SkeletonProps) {
  if (count === 1) {
    return <ShadcnSkeleton className={className} {...props} />;
  }

  return (
    <div className="space-y-3">
      {[...Array(count)].map((_, i) => (
        <ShadcnSkeleton key={i} className={className} {...props} />
      ))}
    </div>
  );
}

export { Skeleton };
