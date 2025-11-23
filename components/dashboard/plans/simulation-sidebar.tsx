"use client";

import { useState } from "react";
import { Plus, ChevronLeft, ChevronRight, Copy, Trash2, Edit2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Simulation } from "@/lib/simulation";

interface SimulationSidebarProps {
  simulations: Simulation[];
  activeSimulationId: string | null;
  onSelectSimulation: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onSetPrimary: (id: string) => void;
  onCreateNew: () => void;
  onClone: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, newName: string) => void;
}

export function SimulationSidebar({
  simulations,
  activeSimulationId,
  onSelectSimulation,
  onToggleVisibility,
  onSetPrimary,
  onCreateNew,
  onClone,
  onDelete,
  onRename,
}: SimulationSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const startEditing = (sim: Simulation) => {
    setEditingId(sim.id);
    setEditingName(sim.name);
  };

  const finishEditing = () => {
    if (editingId && editingName.trim()) {
      onRename(editingId, editingName.trim());
    }
    setEditingId(null);
    setEditingName("");
  };

  const visibleSimulations = simulations.filter(s => s.visible);

  if (isCollapsed) {
    return (
      <div className="w-12 border-r bg-muted/30 flex flex-col items-center py-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCollapsed(false)}
          title="Expand sidebar"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <div className="mt-4 text-xs text-muted-foreground rotate-90 whitespace-nowrap">
          Simulations
        </div>
        <div className="mt-4 space-y-2">
          {visibleSimulations.map(sim => (
            <div
              key={sim.id}
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: sim.color }}
              title={sim.name}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-72 border-r bg-muted/30 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            📊 Simulations
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(true)}
            title="Collapse sidebar"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
        <Button onClick={onCreateNew} className="w-full" size="sm">
          <Plus className="mr-2 h-4 w-4" />
          New Simulation
        </Button>
      </div>

      {/* Simulation list */}
      <div className="flex-1 overflow-auto p-2 space-y-1">
        {simulations.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8">
            No simulations yet.
            <br />
            Click "New Simulation" to start.
          </p>
        )}

        {simulations.map(sim => {
          const isActive = activeSimulationId === sim.id;
          const isEditing = editingId === sim.id;

          return (
            <div
              key={sim.id}
              className={`rounded-md border transition-all ${
                isActive
                  ? 'bg-primary/10 border-primary shadow-sm'
                  : 'bg-background hover:bg-muted/50 border-transparent'
              }`}
            >
              <div
                className="p-3 cursor-pointer"
                onClick={() => !isEditing && onSelectSimulation(sim.id)}
              >
                <div className="flex items-center gap-2 mb-2">
                  {/* Visibility checkbox */}
                  <input
                    type="checkbox"
                    checked={sim.visible}
                    onChange={(e) => {
                      e.stopPropagation();
                      onToggleVisibility(sim.id);
                    }}
                    className="w-4 h-4 cursor-pointer"
                    title={sim.visible ? "Hide from chart" : "Show on chart"}
                  />

                  {/* Color indicator */}
                  <div
                    className="w-4 h-4 rounded-full border-2 border-background shadow-sm"
                    style={{ backgroundColor: sim.color }}
                  />

                  {/* Name (editable) */}
                  {isEditing ? (
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={finishEditing}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') finishEditing();
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                      className="flex-1 h-7 text-sm"
                    />
                  ) : (
                    <span className="flex-1 text-sm font-medium truncate">
                      {sim.name}
                    </span>
                  )}

                  {/* Primary star */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSetPrimary(sim.id);
                    }}
                    className="text-lg hover:scale-110 transition-transform"
                    title={sim.isPrimary ? "Primary simulation" : "Set as primary"}
                  >
                    {sim.isPrimary ? '⭐' : '☆'}
                  </button>
                </div>

                {/* Metadata */}
                <div className="text-xs text-muted-foreground ml-10">
                  {sim.data.timeHorizon}yr projection
                  {sim.visible && (
                    <span className="ml-2 text-green-600">● Visible</span>
                  )}
                </div>
              </div>

              {/* Action buttons (show when active) */}
              {isActive && !isEditing && (
                <div className="px-3 pb-3 flex gap-1 border-t pt-2 mt-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => startEditing(sim)}
                    className="flex-1 text-xs"
                  >
                    <Edit2 className="mr-1 h-3 w-3" />
                    Rename
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onClone(sim.id)}
                    className="flex-1 text-xs"
                  >
                    <Copy className="mr-1 h-3 w-3" />
                    Clone
                  </Button>
                  {simulations.length > 1 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Delete "${sim.name}"?`)) {
                          onDelete(sim.id);
                        }
                      }}
                      className="flex-1 text-xs text-destructive hover:text-destructive"
                    >
                      <Trash2 className="mr-1 h-3 w-3" />
                      Delete
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer info */}
      <div className="p-3 border-t bg-muted/50">
        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex justify-between">
            <span>Total simulations:</span>
            <span className="font-medium">{simulations.length}</span>
          </div>
          <div className="flex justify-between">
            <span>Visible on chart:</span>
            <span className="font-medium">{visibleSimulations.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
