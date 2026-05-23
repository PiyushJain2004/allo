import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET() {
  const products = await prisma.product.findMany({
    orderBy: { name: "asc" },
    include: {
      stocks: {
        include: {
          warehouse: true,
        },
      },
    },
  });

  const response = products.map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    description: product.description,
    warehouses: product.stocks.map((stock) => ({
      id: stock.warehouse.id,
      name: stock.warehouse.name,
      location: stock.warehouse.location,
      totalUnits: stock.totalUnits,
      reservedUnits: stock.reservedUnits,
      availableUnits: Math.max(stock.totalUnits - stock.reservedUnits, 0),
    })),
  }));

  return NextResponse.json({ data: response });
}
