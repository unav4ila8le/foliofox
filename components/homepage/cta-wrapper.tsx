"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/supabase/client";

export function CTAWrapper() {
  const [label, setLabel] = useState("Get started");

  useEffect(() => {
    const supabase = createClient();

    const refreshLabel = async () => {
      const { data } = await supabase.auth.getClaims();
      setLabel(data?.claims ? "Dashboard" : "Get started");
    };

    refreshLabel();
  }, []);

  return label;
}
