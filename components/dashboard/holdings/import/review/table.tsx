"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { HoldingRow } from "@/lib/import/types";
import { Upload, LoaderCircle } from "lucide-react";

interface HoldingsReviewTableProps {
  initialHoldings: HoldingRow[];
  onCancel: () => void;
  onImport: (holdings: HoldingRow[]) => void;
  isImporting?: boolean;
}

export function HoldingsImportReviewTable({
  initialHoldings,
  onCancel,
  onImport,
  isImporting = false,
}: HoldingsReviewTableProps) {
  const [holdings, setHoldings] = useState<HoldingRow[]>(() =>
    structuredClone(initialHoldings),
  );

  const updateField =
    (index: number, field: keyof HoldingRow) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setHoldings((prev) => {
        const next = [...prev];
        const row = { ...next[index] };

        // Handle different field types
        if (field === "current_unit_value" || field === "cost_basis_per_unit") {
          row[field] = value === "" ? null : Number(value);
        } else if (field === "symbol_id" || field === "description") {
          row[field] = value === "" ? null : value;
        } else if (field === "current_quantity") {
          row[field] = Number(value);
        } else {
          row[field] = value;
        }

        next[index] = row;
        return next;
      });
    };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Unit Value</TableHead>
              <TableHead>Cost Basis</TableHead>
              <TableHead>Symbol</TableHead>
              <TableHead>Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {holdings.map((holding, index) => (
              <TableRow key={index}>
                <TableCell>
                  <Input
                    value={holding.name}
                    onChange={updateField(index, "name")}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={holding.category_code}
                    onChange={updateField(index, "category_code")}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={holding.currency}
                    onChange={updateField(index, "currency")}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={holding.current_quantity}
                    onChange={updateField(index, "current_quantity")}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={holding.current_unit_value ?? ""}
                    onChange={updateField(index, "current_unit_value")}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={holding.cost_basis_per_unit ?? ""}
                    onChange={updateField(index, "cost_basis_per_unit")}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={holding.symbol_id ?? ""}
                    onChange={updateField(index, "symbol_id")}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={holding.description ?? ""}
                    onChange={updateField(index, "description")}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel} disabled={isImporting}>
          Back
        </Button>
        <Button onClick={() => onImport(holdings)} disabled={isImporting}>
          {isImporting ? (
            <>
              <LoaderCircle className="size-4 animate-spin" />
              Importing...
            </>
          ) : (
            <>
              <Upload className="size-4" />
              Import {holdings.length} holding(s)
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
