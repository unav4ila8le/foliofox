import Image from "next/image";

export function Logo({
  width,
  height,
  className,
}: {
  width?: number;
  height?: number;
  className?: string;
}) {
  // Ensure at least one dimension is provided
  if (!width && !height) {
    height = 24; // Default height if neither is provided
  }

  return (
    <Image
      src="/logo.svg"
      alt="Logo"
      width={width || 0}
      height={width || 0}
      style={{ width: width || "auto", height: height || "auto" }}
      className={className}
    />
  );
}
