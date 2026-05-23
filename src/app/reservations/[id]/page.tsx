"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

const REFRESH_INTERVAL_MS = 1000;

function formatDuration(ms: number) {
  const totalSeconds = Math.max(Math.floor(ms / 1000), 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

type ReservationDetails = {
  id: string;
  status: "pending" | "confirmed" | "released";
  expiresAt: string;
  product: {
    name: string;
    sku: string;
  };
  warehouse: {
    name: string;
    location: string | null;
  };
  quantity: number;
};

export default function ReservationPage() {
  const params = useParams<{ id?: string }>();
  const reservationId = typeof params?.id === "string" ? params.id : "";
  const [details, setDetails] = useState<ReservationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState(false);
  const [now, setNow] = useState(Date.now());

  const fetchDetails = useCallback(async () => {
    if (!reservationId) {
      setError("Reservation not found.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/reservations/${reservationId}`);
      if (response.status === 404) {
        setError("Reservation not found.");
        return;
      }
      if (!response.ok) {
        throw new Error("Unable to load reservation.");
      }
      const payload = (await response.json()) as { data: ReservationDetails };
      setDetails(payload.data);
    } catch (err) {
      console.error(err);
      setError("Unable to load reservation.");
    } finally {
      setLoading(false);
    }
  }, [reservationId]);

  useEffect(() => {
    void fetchDetails();
  }, [fetchDetails]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const timeRemaining = useMemo(() => {
    if (!details) {
      return 0;
    }
    return new Date(details.expiresAt).getTime() - now;
  }, [details, now]);

  const confirmReservation = useCallback(async () => {
    if (!details) return;
    setPendingAction(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const response = await fetch(`/api/reservations/${details.id}/confirm`, {
        method: "POST",
      });

      if (response.status === 410) {
        const payload = (await response.json()) as { error?: string };
        setActionError(payload.error ?? "Reservation expired.");
        await fetchDetails();
        return;
      }

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        setActionError(payload.error ?? "Unable to confirm reservation.");
        return;
      }

      setActionSuccess("Reservation confirmed.");
      await fetchDetails();
    } catch (err) {
      console.error(err);
      setActionError("Unable to confirm reservation.");
    } finally {
      setPendingAction(false);
    }
  }, [details, fetchDetails]);

  const releaseReservation = useCallback(async () => {
    if (!details) return;
    setPendingAction(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const response = await fetch(`/api/reservations/${details.id}/release`, {
        method: "POST",
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        setActionError(payload.error ?? "Unable to release reservation.");
        return;
      }

      setActionSuccess("Reservation released.");
      await fetchDetails();
    } catch (err) {
      console.error(err);
      setActionError("Unable to release reservation.");
    } finally {
      setPendingAction(false);
    }
  }, [details, fetchDetails]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 px-6 py-12">
        <p className="text-sm text-slate-500">Loading reservation...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-100 px-6 py-12">
        <p className="text-sm text-rose-600">{error}</p>
        <Link className="mt-4 inline-flex text-sm text-slate-600" href="/">
          Back to inventory
        </Link>
      </div>
    );
  }

  if (!details) {
    return null;
  }

  const isExpired = timeRemaining <= 0;

  return (
    <div className="min-h-screen bg-slate-100 px-6 py-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">
            Reservation
          </p>
          <h1 className="text-3xl font-semibold text-slate-900">
            {details.product.name}
          </h1>
          <p className="text-sm text-slate-600">
            {details.product.sku} · {details.warehouse.name}
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Time remaining
              </p>
              <p className="text-3xl font-semibold text-slate-900">
                {formatDuration(timeRemaining)}
              </p>
            </div>
            <div className="text-right text-sm text-slate-600">
              <p>
                Status: <span className="font-semibold">{details.status}</span>
              </p>
              <p>
                Quantity: <span className="font-semibold">{details.quantity}</span>
              </p>
              <p>
                Location:{" "}
                <span className="font-semibold">
                  {details.warehouse.location ?? "Location TBD"}
                </span>
              </p>
            </div>
          </div>

          {isExpired && details.status === "pending" ? (
            <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              This reservation expired. Refreshing status...
            </p>
          ) : null}
        </section>

        <section className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={confirmReservation}
            disabled={
              pendingAction ||
              details.status !== "pending" ||
              isExpired
            }
            className="rounded-full bg-slate-900 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Confirm purchase
          </button>
          <button
            type="button"
            onClick={releaseReservation}
            disabled={pendingAction || details.status !== "pending"}
            className="rounded-full border border-slate-300 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:text-slate-400"
          >
            Cancel reservation
          </button>
          <Link
            href="/"
            className="inline-flex items-center text-xs font-semibold uppercase tracking-wide text-slate-500"
          >
            Back to inventory
          </Link>
        </section>

        {actionError ? (
          <p className="text-sm text-rose-600">{actionError}</p>
        ) : null}
        {actionSuccess ? (
          <p className="text-sm text-emerald-600">{actionSuccess}</p>
        ) : null}
      </div>
    </div>
  );
}
