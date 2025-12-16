"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupText,
  InputGroupButton,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";

import { BalanceChart } from "./charts/balance-chart";
import { EventsTable } from "./table/events-table";
import { UpsertEventDialog } from "./dialogs/upsert-event";

import type { Scenario, ScenarioEvent } from "@/lib/scenario-planning";

import {
  upsertEvent,
  deleteEvent,
  updateInitialBalance,
} from "@/server/financial-scenarios/actions";

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
  const [displayBalance, setDisplayBalance] = useState(scenario.initialBalance);
  const [isUpdatingBalance, setIsUpdatingBalance] = useState(false);

  const isBalanceDirty = initialBalance !== scenario.initialBalance.toString();

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

      toast.success(
        index !== undefined
          ? "Event updated successfully"
          : "Event created successfully",
      );
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

      toast.success("Event deleted successfully");
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

      setDisplayBalance(balance);
      toast.success("Initial balance updated successfully");
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
    <div className="space-y-4">
      {/* Initial Balance Input */}
      <div className="space-y-2">
        <Label htmlFor="initial-balance">Initial balance</Label>
        <InputGroup className="md:max-w-80">
          <InputGroupInput
            id="initial-balance"
            placeholder="E.g., 100,000"
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={initialBalance}
            onChange={(e) => setInitialBalance(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleInitialBalanceUpdate();
              }
            }}
            disabled={isUpdatingBalance}
          />
          <InputGroupAddon align="inline-start">
            <InputGroupText>{currency}</InputGroupText>
          </InputGroupAddon>
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              variant="secondary"
              disabled={!isBalanceDirty || isUpdatingBalance}
              onClick={handleInitialBalanceUpdate}
            >
              Update
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </div>

      {/* Chart */}
      <BalanceChart
        scenario={scenario}
        currency={currency}
        initialBalance={displayBalance}
        onAddEvent={() => setDialogOpen(true)}
      />

      {/* Events */}
      {scenario.events.length > 0 && (
        <EventsTable
          events={scenario.events}
          onEventClick={handleEventClick}
          onDelete={handleDelete}
          onAddEvent={() => setDialogOpen(true)}
        />
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
