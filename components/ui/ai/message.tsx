import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { UIMessage } from "ai";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps, HTMLAttributes } from "react";

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: UIMessage["role"];
};

export const Message = ({ className, from, ...props }: MessageProps) => (
  <div
    className={cn(
      "group flex w-full items-end justify-end gap-2 py-3",
      from === "user"
        ? "is-user pe-2"
        : "is-assistant flex-row-reverse justify-end",
      className,
    )}
    {...props}
  />
);

const messageContentVariants = cva(
  "is-user:dark flex flex-col gap-2 overflow-hidden rounded-lg text-sm",
  {
    variants: {
      variant: {
        contained: [
          "max-w-[90%] px-3 py-2.5",
          "group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground",
          "group-[.is-assistant]:bg-secondary group-[.is-assistant]:text-foreground",
        ],
        flat: [
          "group-[.is-user]:max-w-[90%] group-[.is-user]:bg-secondary group-[.is-user]:px-4 group-[.is-user]:py-3 group-[.is-user]:text-foreground",
          "group-[.is-assistant]:text-foreground",
        ],
      },
    },
    defaultVariants: {
      variant: "contained",
    },
  },
);

export type MessageContentProps = HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof messageContentVariants>;

export const MessageContent = ({
  children,
  className,
  variant,
  ...props
}: MessageContentProps) => (
  <div
    className={cn(messageContentVariants({ variant, className }))}
    {...props}
  >
    {children}
  </div>
);

export type MessageAvatarProps = ComponentProps<typeof Avatar> & {
  src: string;
  name?: string;
};

export const MessageAvatar = ({
  src,
  name,
  className,
  ...props
}: MessageAvatarProps) => (
  <Avatar className={cn("ring-border size-8 ring-1", className)} {...props}>
    <AvatarImage alt="" className="bg-muted mt-0 mb-0" src={src} />
    <AvatarFallback className="uppercase">
      {name?.slice(0, 1) || "?"}
    </AvatarFallback>
  </Avatar>
);

export type MessageLoadingProps = HTMLAttributes<HTMLDivElement> & {
  status: "streaming" | "submitted" | "ready" | "error";
};

export const MessageLoading = ({ status, className }: MessageLoadingProps) => (
  <div className={cn("flex flex-row items-center gap-3 text-sm", className)}>
    <span className="relative flex size-2.5 items-center justify-center">
      <span className="bg-brand absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"></span>
      <span className="bg-brand relative inline-flex size-2 rounded-full"></span>
    </span>
    {status === "streaming" ? "Responding..." : "Thinking..."}
  </div>
);
