"use client";

import { useEffect, useRef } from "react";
import { ChartLine, FileUp, Landmark, PencilLine } from "lucide-react";

import { SelectionCard } from "@/components/dashboard/new-asset/selection-dialog";
import { FormDialog } from "@/components/dashboard/new-asset/form-dialog";
import { useNewAssetDialog } from "@/components/dashboard/new-asset";
import { useImportPositionsDialog } from "@/components/dashboard/positions/import";
import { useBrokerImportDialog } from "@/components/dashboard/broker-import";
import { useDashboardData } from "@/components/dashboard/providers/dashboard-data-provider";

import { listSupportedBrokerDisplayNames } from "@/lib/import/broker-transactions/registry";

import type { SelectionType } from "@/components/dashboard/new-asset";

interface FirstPositionStepProps {
  /** Called once the first position lands, to finish and leave onboarding. */
  onPositionAdded: () => void;
}

export function FirstPositionStep({ onPositionAdded }: FirstPositionStepProps) {
  const { hasActivePositions, refreshDashboardData } = useDashboardData();
  const { openFormDialog, setOpenFormDialog, setSelectedType } =
    useNewAssetDialog();
  const {
    open: isImportOpen,
    reviewOpen: isImportReviewOpen,
    setOpen: setOpenImportDialog,
  } = useImportPositionsDialog();
  const { open: isBrokerOpen, setOpen: setOpenBrokerDialog } =
    useBrokerImportDialog();

  const isAnyDialogOpen =
    openFormDialog || isImportOpen || isImportReviewOpen || isBrokerOpen;

  // The add-position actions revalidate /dashboard, which does not cover this
  // route, so refetch when whichever dialog was open closes. A cancelled dialog
  // just costs one refetch.
  const wasAnyDialogOpen = useRef(false);
  useEffect(() => {
    if (wasAnyDialogOpen.current && !isAnyDialogOpen) refreshDashboardData();
    wasAnyDialogOpen.current = isAnyDialogOpen;
  }, [isAnyDialogOpen, refreshDashboardData]);

  // Helping with the first position is the whole job of this step, so leave as
  // soon as one exists. Positions that were already there when the step mounted
  // do not count, or a returning user would be bounced straight out.
  const hadPositionsOnMount = useRef(hasActivePositions);
  const hasLeft = useRef(false);
  useEffect(() => {
    if (hasLeft.current || hadPositionsOnMount.current) return;
    if (!hasActivePositions) return;
    hasLeft.current = true;
    onPositionAdded();
  }, [hasActivePositions, onPositionAdded]);

  const handleSelect = (type: SelectionType) => {
    setSelectedType(type);
    setOpenFormDialog(true);
  };

  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <p className="text-sm font-medium">Add one holding</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SelectionCard
            title="Ticker symbol"
            description="Search for a stock, ETF, crypto or fund and add it by its ticker"
            icon={ChartLine}
            onClick={() => handleSelect("symbol")}
          />
          <SelectionCard
            title="Custom asset"
            description="Cash, property, or anything else without a ticker symbol"
            icon={PencilLine}
            onClick={() => handleSelect("custom")}
          />
        </div>
      </div>

      <div className="grid gap-3">
        <p className="text-sm font-medium">Bring what you already have</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SelectionCard
            title="File or screenshot"
            description="Import a CSV or spreadsheet, or let AI read a PDF or image"
            icon={FileUp}
            onClick={() => setOpenImportDialog(true)}
          />
          <SelectionCard
            title="Broker import"
            description={`Upload a transaction export from ${new Intl.ListFormat("en", { type: "disjunction" }).format(listSupportedBrokerDisplayNames())}`}
            icon={Landmark}
            onClick={() => setOpenBrokerDialog(true)}
          />
        </div>
      </div>

      {/*
        FormDialog normally rides along inside SelectionDialog, which only
        mounts while the New Asset selection dialog is open. Onboarding skips
        that dialog, so it has to mount FormDialog itself or the ticker and
        custom cards would set context and render nothing. The import and
        broker providers each render their own Dialog, so they need none.
      */}
      <FormDialog />
    </div>
  );
}
