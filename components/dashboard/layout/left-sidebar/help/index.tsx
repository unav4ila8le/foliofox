"use client";

import { useState } from "react";
import Link from "next/link";
import { CircleHelp, MessageCircleQuestionMark, Newspaper } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/custom/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/custom/sidebar";
import { DiscordIcon } from "@/components/ui/logos/discord-icon";

import { FeedbackForm } from "./form";

export function HelpButton() {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const { isMobile } = useSidebar();

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                tooltip="Help"
                className="text-muted-foreground data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground cursor-pointer justify-center"
              >
                <CircleHelp />
                <span className="group-data-[collapsible=icon]:hidden">
                  Help
                </span>
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              onCloseAutoFocus={(event) => event.preventDefault()}
              className="min-w-56"
              side={isMobile ? "top" : "right"}
              align="end"
              sideOffset={4}
            >
              <DropdownMenuGroup>
                <DropdownMenuItem onSelect={() => setFeedbackOpen(true)}>
                  <MessageCircleQuestionMark />
                  Feedback
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    href="/changelog"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Newspaper />
                    Changelog
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    href="/discord"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <DiscordIcon />
                    Discord
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
      <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send feedback</DialogTitle>
            <DialogDescription>
              Share an issue, an idea, or anything else about Foliofox.
            </DialogDescription>
          </DialogHeader>
          <FeedbackForm onSuccess={() => setFeedbackOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
