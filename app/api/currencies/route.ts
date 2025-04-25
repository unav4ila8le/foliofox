import { NextResponse } from "next/server";

import { fetchCurrencies } from "@/lib/currencies/actions";

export async function GET() {
  try {
    const currencies = await fetchCurrencies();
    return NextResponse.json(currencies);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    );
  }
}
