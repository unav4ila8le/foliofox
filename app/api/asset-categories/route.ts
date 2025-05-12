import { NextResponse } from "next/server";

import { fetchAssetCategories } from "@/server/asset-categories/actions";

export async function GET() {
  try {
    const categories = await fetchAssetCategories();
    return NextResponse.json(categories);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    );
  }
}
