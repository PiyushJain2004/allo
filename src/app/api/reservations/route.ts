import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

const RESERVATION_WINDOW_MINUTES = 10;

type ReservationRequest = {
  productId: string;
  warehouseId: string;
  quantity: number;
};

function isValidRequest(body: ReservationRequest) {
  return (
    typeof body.productId === "string" &&
    typeof body.warehouseId === "string" &&
    typeof body.quantity === "number" &&
    Number.isInteger(body.quantity) &&
    body.quantity > 0
  );
}

export async function POST(request: Request) {
  const body = (await request.json()) as ReservationRequest;

  if (!isValidRequest(body)) {
    return NextResponse.json(
      { error: "Invalid reservation request." },
      { status: 400 }
    );
  }

  const expiresAt = new Date(Date.now() + RESERVATION_WINDOW_MINUTES * 60 * 1000);

  try {
    const reservation = await prisma.$transaction(async (tx) => {
      const updated = await tx.$executeRaw`
        UPDATE "InventoryStock"
        SET "reservedUnits" = "reservedUnits" + ${body.quantity}
        WHERE "productId" = ${body.productId}
          AND "warehouseId" = ${body.warehouseId}
          AND "reservedUnits" + ${body.quantity} <= "totalUnits"
      `;

      if (updated === 0) {
        return null;
      }

      return tx.reservation.create({
        data: {
          productId: body.productId,
          warehouseId: body.warehouseId,
          quantity: body.quantity,
          expiresAt,
        },
      });
    });

    if (!reservation) {
      return NextResponse.json(
        { error: "Insufficient available stock." },
        { status: 409 }
      );
    }

    return NextResponse.json({ data: reservation }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to create reservation." },
      { status: 500 }
    );
  }
}
