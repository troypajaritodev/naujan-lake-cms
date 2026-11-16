"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, QrCode } from "lucide-react";
import QRCode from "qrcode";
import type { Inquiry } from "@/lib/inquiries";
import { isBoardableStatus } from "@/lib/inquiries-shared";

export function buildVerifyPath(inquiry: Inquiry): string {
  const params = new URLSearchParams({
    ref: inquiry.reference,
  });
  return `/verify?${params.toString()}`;
}

export default function BookingQrPass({
  inquiry,
  size = 132,
  showDownload = true,
}: {
  inquiry: Inquiry;
  size?: number;
  showDownload?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fallbackPath = useMemo(() => buildVerifyPath(inquiry), [inquiry]);
  const [signedState, setSignedState] = useState<{
    key: string;
    path: string;
  } | null>(null);
  const isBoardable = isBoardableStatus(inquiry.status);
  const signKey = `${inquiry.id}:${inquiry.reference}:${inquiry.status}:${inquiry.paymentStatus ?? ""}`;

  useEffect(() => {
    if (!isBoardable) return;

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/passes/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: inquiry.id, reference: inquiry.reference }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { verifyPath?: string };
        if (!cancelled && data.verifyPath) {
          setSignedState({ key: signKey, path: data.verifyPath });
        }
      } catch {
        // Keep safe reference path fallback when offline.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [inquiry.id, inquiry.reference, isBoardable, signKey]);

  const verifyPath =
    isBoardable && signedState?.key === signKey ? signedState.path : fallbackPath;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const fullUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}${verifyPath}`
        : verifyPath;

    void QRCode.toCanvas(canvas, fullUrl, {
      width: size,
      margin: 1,
      errorCorrectionLevel: "M",
      color: {
        dark: "#103b42",
        light: "#ffffff",
      },
    });
  }, [verifyPath, size]);

  function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `${inquiry.reference.toLowerCase()}-qr-pass.png`;
    link.click();
  }

  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-ink/10 bg-white p-3 text-center">
      <div className="flex items-center gap-1 text-[9.5px] font-semibold tracking-[0.14em] text-lake-800 uppercase">
        <QrCode className="size-3" strokeWidth={2.2} />
        Scan at jetty
      </div>
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        aria-label={`QR verification code for ${inquiry.reference}`}
        className="rounded-lg"
      />
      <p className="font-mono text-[10px] font-semibold text-sand-700">
        {inquiry.reference}
      </p>
      {showDownload ? (
        <button
          type="button"
          onClick={handleDownload}
          className="inline-flex items-center gap-1 rounded-full bg-sand-100 px-2.5 py-1 text-[10.5px] font-medium text-ink transition hover:bg-sand-200 print:hidden"
        >
          <Download className="size-3" strokeWidth={2} />
          Save QR
        </button>
      ) : null}
    </div>
  );
}
