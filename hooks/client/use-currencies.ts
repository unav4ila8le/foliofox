"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/supabase/client";

import type { Currency } from "@/types/global.types";

export function useCurrencies() {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchCurrencies() {
      // Supabase client
      const supabase = createClient();

      // Get currencies
      const { data, error } = await supabase
        .from("currencies")
        .select("alphabetic_code, name")
        .order("alphabetic_code", { ascending: true });

      // Throw error
      if (error) {
        throw new Error("Error fetching currencies:", error);
      }

      setCurrencies(data);
      setIsLoading(false);
    }

    fetchCurrencies();
  }, []);

  return { currencies, isLoading };
}
