import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { id },
      });

      if (!reservation) {
        return { status: 404, body: { error: "Reservation not found." } };
      }

      if (reservation.status === "released") {
        return { status: 200, body: { data: reservation } };
      }

      if (reservation.status === "confirmed") {
        return { status: 409, body: { error: "Reservation already confirmed." } };
      }

      await tx.inventoryStock.update({
        where: {
          productId_warehouseId: {
            productId: reservation.productId,
            warehouseId: reservation.warehouseId,
          },
        },
        data: {
          reservedUnits: {
            decrement: reservation.quantity,
          },
        },
      });

      const updatedReservation = await tx.reservation.update({
        where: { id: reservation.id },
        data: { status: "released" },
      });

      return { status: 200, body: { data: updatedReservation } };
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to release reservation." },
      { status: 500 }
    );
  }
}
