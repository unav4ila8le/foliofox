import { MoreHorizontal, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useImportPortfolioRecordsDialog } from "@/components/dashboard/portfolio-records/import";

export function TableActionsDropdown() {
  const { setOpen: setOpenImportPortfolioRecordsDialog } =
    useImportPortfolioRecordsDialog();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <span className="sr-only">Open menu</span>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onSelect={() => setOpenImportPortfolioRecordsDialog(true)}
        >
          <Upload className="size-4" /> Import records
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
