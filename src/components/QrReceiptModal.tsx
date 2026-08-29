"use client";

import React, { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Download, CheckCircle2, QrCode, ShieldAlert, Sparkles, ArrowRight, X, Clock, AlertCircle } from "lucide-react";

export interface SavedReceipt {
  orderId: number;
  orderCode: string;
  customerName: string;
  totalAmount: number;
  paymentRef: string;
  rawToken: string;
  items: { name: string; quantity: number; unitPrice: number; subtotal: number }[];
  orderDate: string;
  createdAt: string;
  status: string;
}

interface QrReceiptModalProps {
  receipt: SavedReceipt | null;
  onClose: () => void;
  onTestScan?: (token: string) => void;
}

export const QrReceiptModal: React.FC<QrReceiptModalProps> = ({ receipt, onClose, onTestScan }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [isSavedLocally, setIsSavedLocally] = useState(false);

  useEffect(() => {
    if (!receipt || !canvasRef.current) return;

    // Generate QR code onto canvas
    // The payload is ONLY the unguessable raw token!
    // Never include trusted state like "paid=true"
    QRCode.toCanvas(
      canvasRef.current,
      receipt.rawToken,
      {
        width: 240,
        margin: 2,
        color: {
          dark: "#0f172a", // Deep slate
          light: "#ffffff",
        },
        errorCorrectionLevel: "H",
      },
      (err) => {
        if (err) console.error("QR Canvas Error:", err);
      }
    );

    // Save to local storage for offline PWA viewing
    try {
      const existing = JSON.parse(localStorage.getItem("qpass_offline_receipts") || "[]");
      const filtered = existing.filter((r: SavedReceipt) => r.orderCode !== receipt.orderCode);
      filtered.unshift(receipt);
      localStorage.setItem("qpass_offline_receipts", JSON.stringify(filtered.slice(0, 10)));
      setTimeout(() => {
        setIsSavedLocally(true);
      }, 0);
    } catch (e) {
      console.warn("Could not save to localStorage:", e);
    }
  }, [receipt]);

  if (!receipt) return null;

  const handleDownloadImage = () => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `Q-Pass-${receipt.orderCode}.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-6 text-slate-100 my-8">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-0.5 text-xs font-bold text-emerald-400 border border-emerald-500/30">
            <Sparkles className="h-3 w-3" /> PAYMENT CONFIRMED & RESERVED
          </span>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Your Pickup Pass</h2>
          <p className="text-xs text-slate-400">
            Order Code: <span className="font-mono font-bold text-orange-400">{receipt.orderCode}</span>
          </p>
        </div>

        {/* Offline Badge */}
        <div className="mt-3 flex items-center justify-between rounded-xl bg-orange-500/10 border border-orange-500/20 p-2.5 text-xs text-orange-300">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-orange-500 animate-ping" />
            <span>Zero-Login Pickup Ready</span>
          </div>
          <span className="font-semibold">Works Offline</span>
        </div>

        {/* QR Code Frame */}
        <div className="mt-4 flex flex-col items-center justify-center rounded-2xl bg-white p-4 shadow-inner">
          <canvas ref={canvasRef} className="rounded-lg shadow-sm" />
          <div className="mt-2 text-center">
            <p className="font-mono text-xs font-bold tracking-widest text-slate-900 uppercase">
              {receipt.orderCode}
            </p>
            <p className="text-[10px] text-slate-500">Show this QR to the canteen staff scanner</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={handleDownloadImage}
            className="flex items-center justify-center gap-2 rounded-xl bg-slate-800 border border-slate-700 py-2.5 px-3 text-xs font-bold text-white hover:bg-slate-700 active:scale-95 transition"
          >
            <Download className="h-4 w-4 text-orange-400" />
            {downloadSuccess ? "Saved to Device!" : "Save to Phone"}
          </button>

          {onTestScan && (
            <button
              onClick={() => {
                onTestScan(receipt.rawToken);
                onClose();
              }}
              className="flex items-center justify-center gap-2 rounded-xl bg-orange-600 py-2.5 px-3 text-xs font-bold text-white hover:bg-orange-500 active:scale-95 shadow-lg shadow-orange-600/30 transition"
            >
              <QrCode className="h-4 w-4" />
              Test Staff Scan
            </button>
          )}
        </div>

        {/* Order Details Breakdown */}
        <div className="mt-4 rounded-xl bg-slate-800/60 p-3.5 border border-slate-700/60 text-xs">
          <div className="flex justify-between border-b border-slate-700/60 pb-2 font-semibold text-slate-300">
            <span>Items Ordered</span>
            <span>Amount</span>
          </div>
          <div className="divide-y divide-slate-800/60 py-1">
            {receipt.items.map((item, idx) => (
              <div key={idx} className="flex justify-between py-1.5 text-slate-300">
                <span>
                  {item.quantity}x {item.name}
                </span>
                <span className="font-medium text-slate-200">₹{item.subtotal.toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between border-t border-slate-700/60 pt-2 font-bold text-white text-sm">
            <span>Total Paid (UPI)</span>
            <span className="text-orange-400">₹{receipt.totalAmount.toFixed(2)}</span>
          </div>
        </div>

        {/* Security Mentor Note */}
        <div className="mt-4 rounded-xl bg-slate-950/80 p-3 border border-slate-800 text-[11px] text-slate-400 space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-amber-400">
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>Cryptographic Security Invariant</span>
          </div>
          <p>
            The QR code embeds an unguessable 64-char raw token. The database only stores its SHA-256 hash. Even if a
            user alters the image, the server re-hashes and verifies payment integrity atomically.
          </p>
        </div>
      </div>
    </div>
  );
};
