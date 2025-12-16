"use client";

import { useState } from "react";
import { Search, Plus } from "lucide-react";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
} from "@/components/ui/input-group";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/dashboard/tables/base/data-table";
import { columns, type ScenarioEventWithId } from "./columns";

import type { ScenarioEvent } from "@/lib/scenario-planning";

interface EventsTableProps {
  events: ScenarioEvent[];
  onEventClick: (event: ScenarioEvent, index: number) => void;
  onDelete: (index: number) => void;
  onAddEvent: () => void;
}

export function EventsTable({
  events,
  onEventClick,
  onDelete,
  onAddEvent,
}: EventsTableProps) {
  const [filterValue, setFilterValue] = useState("");

  // Add id to events for DataTable
  const eventsWithId: ScenarioEventWithId[] = events.map((event, index) => ({
    ...event,
    id: `${index}-${event.name}`,
  }));

  return (
    <div className="space-y-4">
      <h2 className="mb-2 text-lg font-semibold">Events</h2>
      {/* Toolbar */}
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
        <Button onClick={onAddEvent} variant="outline">
          <Plus />
          New Event
        </Button>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={eventsWithId}
        filterValue={filterValue}
        filterColumnId="name"
        meta={{
          onEdit: onEventClick,
          onDelete: onDelete,
        }}
      />

      {/* Event count */}
      <p className="text-muted-foreground text-end text-sm">
        {events.length} active event(s)
      </p>
    </div>
  );
}
