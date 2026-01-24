"use client";

import { useState } from "react";
import { MessageCircleQuestionMark } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";

import { FeedbackForm } from "./form";

export function FeedbackButton() {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline">
          <MessageCircleQuestionMark />
          <span className="hidden lg:inline">Feedback</span>
          <span className="sr-only">Send feedback</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end">
        <FeedbackForm onSuccess={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}
