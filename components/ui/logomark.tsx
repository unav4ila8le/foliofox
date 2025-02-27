export function Logomark({
  width,
  height,
}: {
  width?: number;
  height?: number;
}) {
  // Ensure at least one dimension is provided
  if (!width && !height) {
    height = 24; // Default height if neither is provided
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 128 128"
      height={height}
      width={width}
      className="text-foreground"
      preserveAspectRatio="xMidYMid meet"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M46.5455 104.727C59.3986 104.727 69.8182 94.3077 69.8182 81.4545C69.8182 68.6014 59.3986 58.1818 46.5455 58.1818C33.6923 58.1818 23.2727 68.6014 23.2727 81.4545C23.2727 94.3077 33.6923 104.727 46.5455 104.727ZM46.5455 128C72.2518 128 93.0909 107.161 93.0909 81.4545C93.0909 55.7482 72.2518 34.9091 46.5455 34.9091C20.8391 34.9091 0 55.7482 0 81.4545C0 107.161 20.8391 128 46.5455 128Z"
        fill="currentColor"
      />
      <path
        d="M104.727 81.4545C104.727 49.3216 78.6783 23.2727 46.5454 23.2727V0C91.5315 0 128 36.4684 128 81.4545H116.364H104.727Z"
        fill="#7F56D9"
      />
    </svg>
  );
}
