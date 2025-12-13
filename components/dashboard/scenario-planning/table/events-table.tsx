"use client";

import { useState, useCallback } from "react";
import { Search } from "lucide-react";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
} from "@/components/ui/input-group";
import { DataTable } from "@/components/dashboard/tables/base/data-table";
import { columns, type ScenarioEventWithId } from "./columns";
import type { ScenarioEvent } from "@/lib/scenario-planning";

interface EventsTableProps {
  events: ScenarioEvent[];
  onEventClick: (event: ScenarioEvent, index: number) => void;
  onDelete: (index: number) => void;
}

export function EventsTable({
  events,
  onEventClick,
  onDelete,
}: EventsTableProps) {
  const [filterValue, setFilterValue] = useState("");

  // Add id to events for DataTable
  const eventsWithId: ScenarioEventWithId[] = events.map((event, index) => ({
    ...event,
    id: `${index}-${event.name}`,
  }));

  // Handle row click
  const handleRowClick = useCallback(
    (eventWithId: ScenarioEventWithId) => {
      // Find the original index
      const index = events.findIndex((e) => e.name === eventWithId.name);
      if (index !== -1) {
        onEventClick(events[index], index);
      }
    },
    [events, onEventClick],
  );

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border py-12 text-center">
        <p className="text-muted-foreground">No events yet</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Create your first event to start planning
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Search */}
      <div className="flex items-center justify-between gap-2">
        <InputGroup className="max-w-sm">
          <InputGroupInput
            placeholder="Search events..."
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
          />
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
        </InputGroup>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={eventsWithId}
        filterValue={filterValue}
        filterColumnId="name"
        onRowClick={handleRowClick}
        meta={{
          onEdit: onEventClick,
          onDelete: onDelete,
        }}
      />

      {/* Event count */}
      <p className="text-muted-foreground text-end text-sm">
        {events.length} event{events.length !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
