import {
  ChartLine,
  // Globe, // Sunset 2026-09-22: Domains card below is commented out.
  PencilLine,
  Sparkles,
} from "lucide-react";

import { FormDialog } from "./form-dialog";
import { useNewAssetDialog } from "./index";
import { useImportPositionsDialog } from "@/components/dashboard/positions/import";

import type { ComponentType } from "react";
import type { SelectionType } from "./index";

export function SelectionCard({
  title,
  description,
  icon,
  onClick,
}: {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  onClick: () => void;
}) {
  const Icon = icon;

  return (
    <button
      type="button"
      className="bg-card hover:bg-muted focus-visible:border-ring focus-visible:ring-ring/50 w-full space-y-3 rounded-md border p-4 text-left outline-none focus-visible:ring-3"
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-base leading-none font-medium">{title}</p>
        <Icon className="size-4.5" />
      </div>
      <p className="text-muted-foreground text-sm">{description}</p>
    </button>
  );
}

export function SelectionDialog() {
  const { setOpenFormDialog, setSelectedType } = useNewAssetDialog();
  const { setOpen: setOpenImportDialog } = useImportPositionsDialog();

  const handleSelect = (type: SelectionType) => {
    setSelectedType(type);
    setOpenFormDialog(true);
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SelectionCard
          title="Ticker Symbol"
          description="Search for a stock, ETF, crypto, mutual fund and more by its ticker symbol"
          icon={ChartLine}
          onClick={() => handleSelect("symbol")}
        />
        {/*
          Sunset 2026-09-22: new domain positions are closed. Positions that
          already have domain_id keep HumbleWorth valuation. To restore,
          uncomment this card, the DomainForm branch in form-dialog.tsx, and
          the domain_id guard in server/positions/create.ts.
        <SelectionCard
          title="Domains"
          description="Check for your domains valuation and track them in your portfolio"
          icon={Globe}
          onClick={() => handleSelect("domain")}
        />
        */}
        <SelectionCard
          title="Custom"
          description="Enter quantity and value to add a custom asset to your portfolio"
          icon={PencilLine}
          onClick={() => handleSelect("custom")}
        />
        <SelectionCard
          title="Import CSV/AI"
          description="Import your assets from files or screenshots"
          icon={Sparkles}
          onClick={() => setOpenImportDialog(true)}
        />
      </div>

      <FormDialog />
    </>
  );
}
