import { MessageCircleQuestionMark } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";

import { FeedbackForm } from "./form";

export function FeedbackButton() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon">
          <MessageCircleQuestionMark />
          <span className="sr-only">Send feedback</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end">
        <FeedbackForm />
      </PopoverContent>
    </Popover>
  );
}
