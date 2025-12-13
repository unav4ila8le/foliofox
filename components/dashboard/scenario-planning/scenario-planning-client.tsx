"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { UpsertEventDialog } from "./dialogs/upsert-event";
import { EventsTable } from "./table/events-table";
import {
  upsertEvent,
  deleteEvent,
  updateInitialBalance,
} from "@/server/financial-scenarios/actions";
import type { Scenario, ScenarioEvent } from "@/lib/scenario-planning";
import { BalanceChart } from "./charts/balance-chart";

export function ScenarioPlanningClient({
  scenario,
  currency,
}: {
  scenario: Scenario & { id: string; initialBalance: number };
  currency: string;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<{
    event: ScenarioEvent;
    index: number;
  } | null>(null);
  const [initialBalance, setInitialBalance] = useState(
    scenario.initialBalance.toString(),
  );
  const [isUpdatingBalance, setIsUpdatingBalance] = useState(false);

  const handleEventClick = (event: ScenarioEvent, index: number) => {
    setEditingEvent({ event, index });
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setTimeout(() => {
      setEditingEvent(null);
    }, 200);
  };

  const handleSuccess = async (event: ScenarioEvent, index?: number) => {
    try {
      const result = await upsertEvent(scenario.id, event, index);

      if (!result.success) {
        throw new Error(result.message || "Failed to save event");
      }

      toast.success(index !== undefined ? "Event updated" : "Event created");
      handleDialogClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save event",
      );
    }
  };

  const handleDelete = async (index: number) => {
    try {
      const result = await deleteEvent(scenario.id, index);

      if (!result.success) {
        throw new Error(result.message || "Failed to delete event");
      }

      toast.success("Event deleted");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete event",
      );
    }
  };

  const handleInitialBalanceUpdate = async () => {
    const balance = parseFloat(initialBalance);

    if (isNaN(balance)) {
      toast.error("Please enter a valid number");
      return;
    }

    setIsUpdatingBalance(true);
    try {
      const result = await updateInitialBalance(scenario.id, balance);

      if (!result.success) {
        throw new Error(result.message || "Failed to update initial balance");
      }

      toast.success("Initial balance updated");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update initial balance",
      );
    } finally {
      setIsUpdatingBalance(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Initial Balance Input */}
      <div className="flex items-end gap-4">
        <div className="max-w-xs flex-1">
          <Label htmlFor="initial-balance">Initial balance</Label>
          <Input
            id="initial-balance"
            type="number"
            step="any"
            value={initialBalance}
            onChange={(e) => setInitialBalance(e.target.value)}
            onBlur={handleInitialBalanceUpdate}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleInitialBalanceUpdate();
              }
            }}
            disabled={isUpdatingBalance}
            placeholder="0"
            className="mt-1"
          />
        </div>
      </div>

      <BalanceChart
        scenario={scenario}
        currency={currency}
        initialBalance={parseFloat(initialBalance) || 0}
        onAddEvent={() => setDialogOpen(true)}
      />

      {scenario.events.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Events</h2>
              <p className="text-muted-foreground text-sm">
                {scenario.events.length} event
                {scenario.events.length > 1 ? "s" : ""} configured
              </p>
            </div>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Event
            </Button>
          </div>

          <EventsTable
            events={scenario.events}
            onEventClick={handleEventClick}
            onDelete={handleDelete}
          />
        </>
      )}

      <UpsertEventDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        existingEvents={scenario.events}
        event={editingEvent?.event || null}
        eventIndex={editingEvent?.index ?? null}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
