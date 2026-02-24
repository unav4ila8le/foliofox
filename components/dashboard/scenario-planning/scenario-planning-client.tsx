"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupText,
  InputGroupButton,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { LocalizedNumberInput } from "@/components/ui/custom/localized-number-input";

import { BalanceChart } from "./charts/balance-chart";
import { EventsTable } from "./table/events-table";
import { UpsertEventDialog } from "./dialogs/upsert-event";

import type { Scenario, ScenarioEvent } from "@/lib/scenario-planning";

import { formatNumber } from "@/lib/number-format";
import { useLocale } from "@/hooks/use-locale";
import {
  upsertScenarioEvent,
  updateScenarioInitialBalance,
} from "@/server/financial-scenarios/upsert";
import { deleteScenarioEvent } from "@/server/financial-scenarios/delete";

export function ScenarioPlanningClient({
  scenario,
  currency,
}: {
  scenario: Scenario & { id: string; initialBalance: number };
  currency: string;
}) {
  const locale = useLocale();
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

  const isBalanceDirty = initialBalance !== displayBalance.toString();
  const initialBalancePlaceholder = useMemo(
    () => `E.g., ${formatNumber(100000, { locale })}`,
    [locale],
  );

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
      const result = await upsertScenarioEvent(scenario.id, event, index);

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
      const result = await deleteScenarioEvent(scenario.id, index);

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
    const trimmedBalance = initialBalance.trim();

    if (trimmedBalance === "") {
      toast.error("Please enter a valid number");
      return;
    }

    const balance = Number(trimmedBalance);

    if (!Number.isFinite(balance)) {
      toast.error("Please enter a valid number");
      return;
    }

    setIsUpdatingBalance(true);
    try {
      const result = await updateScenarioInitialBalance(scenario.id, balance);

      if (!result.success) {
        throw new Error(result.message || "Failed to update initial balance");
      }

      setDisplayBalance(balance);
      setInitialBalance(balance.toString());
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
      <div className="space-y-2 md:max-w-80">
        <Label htmlFor="initial-balance">Initial balance</Label>
        <InputGroup>
          <LocalizedNumberInput
            mode="input-group-input"
            id="initial-balance"
            placeholder={initialBalancePlaceholder}
            min={0}
            name="initial-balance"
            value={initialBalance}
            onValueChange={(nextValue) => setInitialBalance(nextValue)}
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
        currency={currency}
      />
    </div>
  );
}
