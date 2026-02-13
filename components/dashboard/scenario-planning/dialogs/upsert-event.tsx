"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/custom/dialog";
import { UpsertEventForm } from "../forms/upsert-event";

import type { ScenarioEvent } from "@/lib/scenario-planning";

export function UpsertEventDialog({
  open,
  onOpenChange,
  existingEvents = [],
  event = null,
  eventIndex = null,
  onSuccess,
  currency,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingEvents?: ScenarioEvent[];
  event?: ScenarioEvent | null;
  eventIndex?: number | null;
  onSuccess: (event: ScenarioEvent, index?: number) => void;
  currency: string;
}) {
  const isEditing = event !== null && eventIndex !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Event" : "New Event"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the event details"
              : "Add a new event to your scenario planning"}
          </DialogDescription>
        </DialogHeader>
        <UpsertEventForm
          onCancel={() => onOpenChange(false)}
          onSuccess={onSuccess}
          existingEvents={existingEvents}
          event={event}
          eventIndex={eventIndex}
          currency={currency}
        />
      </DialogContent>
    </Dialog>
  );
}
