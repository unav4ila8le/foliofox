"use client";

import { useEffect, useState } from "react";

import { getTimeBasedGreetings } from "@/lib/date";

export function Greetings({ username }: { username: string }) {
  const [greeting, setGreeting] = useState<string>("");

  useEffect(() => {
    setGreeting(getTimeBasedGreetings());
  }, []);

  return (
    <h1 className="text-2xl font-semibold">
      {greeting}, {username}
    </h1>
  );
}
