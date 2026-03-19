"use client";

import { type ReactNode, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/custom/dialog";

import { UpsertEventForm } from "./form";

import type { ScenarioInitialValueBasis } from "@/lib/planning/initial-value-basis";
import type { ScenarioEvent } from "@/lib/planning/scenario/engine";

export function UpsertEventDialog({
  open,
  onOpenChange,
  trigger,
  scenarioId,
  existingEvents = [],
  event = null,
  eventIndex = null,
  onSuccess,
  currency,
  initialValueBasis,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  scenarioId: string;
  existingEvents?: ScenarioEvent[];
  event?: ScenarioEvent | null;
  eventIndex?: number | null;
  onSuccess?: () => void;
  currency: string;
  initialValueBasis: ScenarioInitialValueBasis;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = open !== undefined && onOpenChange !== undefined;
  const isEditing = event !== null && eventIndex !== null;
  const isOpen = isControlled ? open : uncontrolledOpen;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!isControlled) {
      setUncontrolledOpen(nextOpen);
    }

    onOpenChange?.(nextOpen);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
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
          scenarioId={scenarioId}
          onCancel={() => handleOpenChange(false)}
          onSuccess={onSuccess}
          existingEvents={existingEvents}
          event={event}
          eventIndex={eventIndex}
          currency={currency}
          initialValueBasis={initialValueBasis}
        />
      </DialogContent>
    </Dialog>
  );
}
