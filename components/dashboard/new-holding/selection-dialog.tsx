import { ChartLine, Globe, PencilLine, Sparkles } from "lucide-react";

import { FormDialog } from "./form-dialog";
import { useNewHoldingDialog } from "./index";
import { useImportHoldingsDialog } from "@/components/dashboard/holdings/import";

import type { ComponentType } from "react";
import type { SelectionType } from "./index";

function SelectionCard({
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
    <div
      className="bg-card hover:bg-muted cursor-pointer space-y-3 rounded-md border p-4"
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="leading-none font-semibold">{title}</p>
        <Icon className="size-4.5" />
      </div>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  );
}

export function SelectionDialog() {
  const { setOpenFormDialog, setSelectedType } = useNewHoldingDialog();
  const { setOpen: setOpenImportDialog } = useImportHoldingsDialog();

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
        <SelectionCard
          title="Domains"
          description="Check for your domains valuation and track them in your portfolio"
          icon={Globe}
          onClick={() => handleSelect("domain")}
        />
        <SelectionCard
          title="Custom"
          description="Enter quantity and value to add a custom holding to your portfolio"
          icon={PencilLine}
          onClick={() => handleSelect("custom")}
        />
        <SelectionCard
          title="Import CSV/AI"
          description="Import your holdings from a files or screenshots"
          icon={Sparkles}
          onClick={() => setOpenImportDialog(true)}
        />
      </div>

      <FormDialog />
    </>
  );
}
