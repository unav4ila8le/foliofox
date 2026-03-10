"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/custom/search-input";
import { DataTable } from "@/components/dashboard/tables/base/data-table";
import { UpsertEventDialog } from "../upsert-event/dialog";
import { columns, type ScenarioEventWithId } from "./columns";

import type { ScenarioEvent } from "@/lib/planning/scenario/engine";
import { deleteScenarioEvent } from "@/server/financial-scenarios/delete";

interface ScenarioEventsTableProps {
  scenarioId: string;
  events: ScenarioEvent[];
  currency: string;
}

export function ScenarioEventsTable({
  scenarioId,
  events,
  currency,
}: ScenarioEventsTableProps) {
  const router = useRouter();
  const [filterValue, setFilterValue] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<{
    event: ScenarioEvent;
    index: number;
  } | null>(null);

  const handleEventClick = (event: ScenarioEvent, index: number) => {
    setEditingEvent({ event, index });
    setIsDialogOpen(true);
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (open) {
      if (!isDialogOpen) {
        // Open triggered by "New Event" button should reset edit context.
        setEditingEvent(null);
      }
      setIsDialogOpen(true);
      return;
    }

    setIsDialogOpen(false);
    setEditingEvent(null);
  };

  const handleDelete = async (index: number) => {
    try {
      const result = await deleteScenarioEvent(scenarioId, index);
      if (!result.success) {
        throw new Error(result.message || "Failed to delete event");
      }

      toast.success("Event deleted successfully");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete event",
      );
    }
  };

  // Add id to events for DataTable
  const eventsWithId: ScenarioEventWithId[] = events.map((event, index) => ({
    ...event,
    id: `${index}-${event.name}`,
  }));

  return (
    <div className="space-y-4">
      <h2 className="mb-2 text-lg font-semibold">Events</h2>
      <div className="flex items-center justify-between gap-2">
        <SearchInput
          className="max-w-sm"
          placeholder="Search events..."
          value={filterValue}
          onChange={(event) => setFilterValue(event.target.value)}
        />
        <UpsertEventDialog
          open={isDialogOpen}
          onOpenChange={handleDialogOpenChange}
          scenarioId={scenarioId}
          existingEvents={events}
          event={editingEvent?.event || null}
          eventIndex={editingEvent?.index ?? null}
          onSuccess={() => handleDialogOpenChange(false)}
          currency={currency}
          trigger={
            <Button variant="outline">
              <Plus />
              New Event
            </Button>
          }
        />
      </div>

      {events.length > 0 ? (
        <>
          <DataTable
            columns={columns}
            data={eventsWithId}
            filterValue={filterValue}
            filterColumnId="name"
            meta={{
              onEdit: handleEventClick,
              onDelete: handleDelete,
            }}
          />

          <p className="text-muted-foreground text-end text-sm">
            {events.length} active event(s)
          </p>
        </>
      ) : (
        <p className="text-muted-foreground text-sm">
          No events yet. Add your first event to start projecting your scenario.
        </p>
      )}
    </div>
  );
}
