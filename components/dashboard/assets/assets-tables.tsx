"use client";

import { useState } from "react";
import { Asset, columns } from "@/components/dashboard/assets/table/columns";
import { DataTable } from "@/components/dashboard/assets/table/data-table";
import { Input } from "@/components/ui/input";

interface AssetsTablesProps {
  data: Asset[];
}

export function AssetsTables({ data }: AssetsTablesProps) {
  const [filterValue, setFilterValue] = useState("");

  // Group assets by type without filtering (TanStack will handle filtering)
  const groupedAssets = data.reduce(
    (acc, asset) => {
      const { asset_type } = asset;
      if (!acc[asset_type]) {
        acc[asset_type] = [];
      }
      acc[asset_type].push(asset);
      return acc;
    },
    {} as Record<string, Asset[]>,
  );

  return (
    <div className="flex flex-col gap-4">
      <Input
        placeholder="Search assets..."
        value={filterValue}
        onChange={(e) => setFilterValue(e.target.value)}
        className="max-w-sm"
      />
      {Object.entries(groupedAssets).map(([assetType, assets]) => (
        <DataTable
          key={assetType}
          columns={columns}
          data={assets}
          title={assetType}
          filterValue={filterValue}
        />
      ))}
    </div>
  );
}
