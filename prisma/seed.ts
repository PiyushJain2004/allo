import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const products = [
  {
    name: "Aster Running Shoes",
    sku: "AST-RUN-001",
    description: "Lightweight daily trainers with breathable mesh.",
  },
  {
    name: "Signal Hoodie",
    sku: "SIG-HOOD-002",
    description: "Midweight fleece hoodie with a relaxed fit.",
  },
  {
    name: "Nimbus Water Bottle",
    sku: "NIM-BTL-003",
    description: "Insulated bottle, 750ml, keeps drinks cold.",
  },
];

const warehouses = [
  {
    name: "Mumbai Central",
    location: "Mumbai, IN",
  },
  {
    name: "Bangalore East",
    location: "Bengaluru, IN",
  },
  {
    name: "Delhi NCR",
    location: "Gurugram, IN",
  },
];

const stockMatrix = [
  { sku: "AST-RUN-001", warehouse: "Mumbai Central", totalUnits: 12 },
  { sku: "AST-RUN-001", warehouse: "Bangalore East", totalUnits: 8 },
  { sku: "SIG-HOOD-002", warehouse: "Mumbai Central", totalUnits: 20 },
  { sku: "SIG-HOOD-002", warehouse: "Delhi NCR", totalUnits: 14 },
  { sku: "NIM-BTL-003", warehouse: "Bangalore East", totalUnits: 25 },
  { sku: "NIM-BTL-003", warehouse: "Delhi NCR", totalUnits: 18 },
];

async function main() {
  const productRecords = await Promise.all(
    products.map((product) =>
      prisma.product.upsert({
        where: { sku: product.sku },
        update: { name: product.name, description: product.description ?? null },
        create: product,
      })
    )
  );

  const warehouseRecords = await Promise.all(
    warehouses.map((warehouse) =>
      prisma.warehouse.upsert({
        where: { name: warehouse.name },
        update: { location: warehouse.location ?? null },
        create: warehouse,
      })
    )
  );

  const productBySku = new Map(productRecords.map((product) => [product.sku, product]));
  const warehouseByName = new Map(
    warehouseRecords.map((warehouse) => [warehouse.name, warehouse])
  );

  await Promise.all(
    stockMatrix.map((stock) => {
      const product = productBySku.get(stock.sku);
      const warehouse = warehouseByName.get(stock.warehouse);

      if (!product || !warehouse) {
        throw new Error("Seed data references missing product or warehouse.");
      }

      return prisma.inventoryStock.upsert({
        where: {
          productId_warehouseId: {
            productId: product.id,
            warehouseId: warehouse.id,
          },
        },
        update: {
          totalUnits: stock.totalUnits,
          reservedUnits: 0,
        },
        create: {
          productId: product.id,
          warehouseId: warehouse.id,
          totalUnits: stock.totalUnits,
          reservedUnits: 0,
        },
      });
    })
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
