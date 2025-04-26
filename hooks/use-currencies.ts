import { useEffect, useState } from "react";

import type { Currency } from "@/types/global.types";

export function useCurrencies() {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCurrencies() {
      setLoading(true);
      const res = await fetch("/api/currencies");
      const data = await res.json();
      setCurrencies(data);
      setLoading(false);
    }
    fetchCurrencies();
  }, []);

  return { currencies, loading };
}
