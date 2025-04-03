import { Asset, columns } from "@/components/dashboard/assets/table/columns";
import { DataTable } from "@/components/dashboard/assets/table/data-table";

interface AssetsTablesProps {
  data: Asset[];
}

export function AssetsTables({ data }: AssetsTablesProps) {
  // Group assets by type
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
    <>
      {Object.entries(groupedAssets).map(([assetType, assets]) => (
        <DataTable
          key={assetType}
          columns={columns}
          data={assets}
          title={assetType}
          count={assets.length}
        />
      ))}
    </>
  );
}
