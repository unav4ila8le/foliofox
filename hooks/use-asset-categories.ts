import { useEffect, useState } from "react";

import type { AssetCategory } from "@/types/global.types";

export function useAssetCategories() {
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAssetCategories() {
      setLoading(true);
      const res = await fetch("/api/asset-categories");
      const data = await res.json();
      setCategories(data);
      setLoading(false);
    }
    fetchAssetCategories();
  }, []);

  return { categories, loading };
}
