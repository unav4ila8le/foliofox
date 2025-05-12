import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { NewHoldingForm } from "./form";

export function NewHolding() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus />
          New Holding
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Holding</DialogTitle>
          <DialogDescription>Add a new holding.</DialogDescription>
        </DialogHeader>
        <NewHoldingForm />
      </DialogContent>
    </Dialog>
  );
}
