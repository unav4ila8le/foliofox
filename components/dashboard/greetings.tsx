"use client";

import { useState } from "react";

import { getTimeBasedGreetings } from "@/lib/time-based-greetings";

export function Greetings({ username }: { username: string }) {
  const [greeting] = useState(() => getTimeBasedGreetings());

  return (
    <h1 className="text-2xl font-semibold">
      {greeting || "Welcome back"}, {username}
    </h1>
  );
}
