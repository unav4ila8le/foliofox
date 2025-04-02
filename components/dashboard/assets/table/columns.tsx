"use client";

import { ColumnDef } from "@tanstack/react-table";

import { formatCurrency } from "@/lib/number/format";

// This type is used to define the shape of our data.
// You can use a Zod schema here if you want.
export type Payment = {
  id: string;
  amount: number;
  status: "pending" | "processing" | "success" | "failed";
  email: string;
};

export const columns: ColumnDef<Payment>[] = [
  {
    accessorKey: "status",
    header: "Status",
  },
  {
    accessorKey: "email",
    header: "Email",
  },
  {
    accessorKey: "amount",
    header: () => <div className="text-right">Amount</div>,
    cell: ({ row }) => {
      const amount = row.getValue("amount") as number;
      const formatted = formatCurrency(amount, "USD", { display: "symbol" });

      return <div className="text-right font-medium">{formatted}</div>;
    },
  },
];
