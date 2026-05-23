import { prisma } from "@/lib/prisma";

export async function releaseExpiredReservations(now = new Date()) {
  const expired = await prisma.reservation.findMany({
    where: {
      status: "pending",
      expiresAt: { lte: now },
    },
    select: {
      id: true,
      productId: true,
      warehouseId: true,
      quantity: true,
    },
  });

  if (expired.length === 0) {
    return 0;
  }

  await prisma.$transaction(async (tx) => {
    for (const reservation of expired) {
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

      await tx.reservation.update({
        where: { id: reservation.id },
        data: { status: "released" },
      });
    }
  });

  return expired.length;
}
