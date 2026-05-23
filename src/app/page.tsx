"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type WarehouseStock = {
  id: string;
  name: string;
  location: string | null;
  totalUnits: number;
  reservedUnits: number;
  availableUnits: number;
};

type Product = {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  warehouses: WarehouseStock[];
};

type ReservationResponse = {
  data: {
    id: string;
    expiresAt: string;
    status: "pending" | "confirmed" | "released";
  };
};

function makeKey(productId: string, warehouseId: string) {
  return `${productId}:${warehouseId}`;
}

export default function Home() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [errorByKey, setErrorByKey] = useState<Record<string, string>>({});
  const [successByKey, setSuccessByKey] = useState<
    Record<string, { id: string; expiresAt: string }>
  >({});

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setPageError(null);

    try {
      const response = await fetch("/api/products");
      if (!response.ok) {
        throw new Error("Failed to load products.");
      }
      const payload = (await response.json()) as { data: Product[] };
      setProducts(payload.data ?? []);
    } catch (error) {
      console.error(error);
      setPageError("Unable to load inventory. Try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProducts();
  }, [fetchProducts]);

  const reserve = useCallback(
    async (productId: string, warehouseId: string) => {
      const key = makeKey(productId, warehouseId);
      const quantity = quantities[key] ?? 1;

      setPendingKey(key);
      setErrorByKey((prev) => ({ ...prev, [key]: "" }));

      try {
        const response = await fetch("/api/reservations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId, warehouseId, quantity }),
        });

        if (response.status === 409) {
          const payload = (await response.json()) as { error?: string };
          setErrorByKey((prev) => ({
            ...prev,
            [key]: payload.error ?? "Insufficient stock available.",
          }));
          return;
        }

        if (!response.ok) {
          throw new Error("Reservation failed.");
        }

        const payload = (await response.json()) as ReservationResponse;
        router.push(`/reservations/${payload.data.id}`);
        setSuccessByKey((prev) => ({
          ...prev,
          [key]: { id: payload.data.id, expiresAt: payload.data.expiresAt },
        }));
        await fetchProducts();
      } catch (error) {
        console.error(error);
        setErrorByKey((prev) => ({
          ...prev,
          [key]: "Something went wrong. Please retry.",
        }));
      } finally {
        setPendingKey(null);
      }
    },
    [fetchProducts, quantities]
  );

  const content = useMemo(() => {
    if (loading) {
      return <p className="text-sm text-slate-500">Loading inventory...</p>;
    }

    if (pageError) {
      return <p className="text-sm text-rose-600">{pageError}</p>;
    }

    return (
      <div className="space-y-6">
        {products.map((product) => (
          <section
            key={product.id}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">
                    {product.name}
                  </h2>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    {product.sku}
                  </p>
                </div>
              </div>
              {product.description ? (
                <p className="text-sm text-slate-600">{product.description}</p>
              ) : null}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {product.warehouses.map((warehouse) => {
                const key = makeKey(product.id, warehouse.id);
                const quantity = quantities[key] ?? 1;
                const errorMessage = errorByKey[key];
                const success = successByKey[key];

                return (
                  <div
                    key={warehouse.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">
                          {warehouse.name}
                        </h3>
                        <p className="text-xs text-slate-500">
                          {warehouse.location ?? "Location TBD"}
                        </p>
                      </div>
                      <div className="text-right text-xs text-slate-500">
                        <p>
                          Available:{" "}
                          <span className="font-semibold text-slate-900">
                            {warehouse.availableUnits}
                          </span>
                        </p>
                        <p>Total: {warehouse.totalUnits}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <label className="text-xs font-medium text-slate-600">
                        Qty
                        <input
                          type="number"
                          min={1}
                          max={warehouse.availableUnits}
                          value={quantity}
                          onChange={(event) => {
                            const nextValue = Number(event.target.value);
                            setQuantities((prev) => ({
                              ...prev,
                              [key]: Number.isNaN(nextValue) ? 1 : nextValue,
                            }));
                          }}
                          className="mt-1 w-20 rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-900"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => reserve(product.id, warehouse.id)}
                        disabled={
                          pendingKey === key ||
                          warehouse.availableUnits === 0 ||
                          quantity <= 0
                        }
                        className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {pendingKey === key ? "Reserving..." : "Reserve"}
                      </button>
                    </div>

                    {errorMessage ? (
                      <p className="mt-3 text-xs text-rose-600">{errorMessage}</p>
                    ) : null}

                    {success ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-emerald-600">
                        <span>
                          Reserved #{success.id.slice(0, 8)} until{" "}
                          {new Date(success.expiresAt).toLocaleTimeString()}
                        </span>
                        <Link
                          href={`/reservations/${success.id}`}
                          className="font-semibold text-slate-700 hover:text-slate-900"
                        >
                          Continue to checkout
                        </Link>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    );
  }, [errorByKey, loading, pageError, pendingKey, products, quantities, reserve, successByKey]);

  return (
    <div className="min-h-screen bg-slate-100 px-6 py-12">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">
            Allo Inventory
          </p>
          <h1 className="text-3xl font-semibold text-slate-900">
            Reserve stock before checkout
          </h1>
          <p className="max-w-2xl text-sm text-slate-600">
            Choose a warehouse and reserve inventory for 10 minutes while payment
            completes.
          </p>
        </header>
        {content}
      </div>
    </div>
  );
}
