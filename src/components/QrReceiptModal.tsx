"use client";

import React, { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Download, CheckCircle2, QrCode, ShieldCheck, Sparkles, ArrowRight, X, Clock } from "lucide-react";

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

    // Generate high-resolution QR code onto canvas
    QRCode.toCanvas(
      canvasRef.current,
      receipt.rawToken,
      {
        width: 250,
        margin: 2,
        color: {
          dark: "#0b0e14", // Deep rich obsidian
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-md rounded-[2.5rem] bg-slate-900 border border-white/15 shadow-2xl p-6 sm:p-8 text-slate-100 my-8">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white transition cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Ticket Header */}
        <div className="text-center pt-2">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-lg shadow-emerald-500/10">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3.5 py-1 text-xs font-black text-emerald-400 border border-emerald-500/30 shadow-sm">
            <Sparkles className="h-3 w-3" /> PAYMENT VERIFIED & PREPARED
          </span>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-white">Your Pickup Pass</h2>
          <p className="text-xs text-slate-400 mt-1">
            Present this QR code at the counter scanner for rapid tray collection
          </p>
        </div>

        {/* QR Code Canvas Card (Ticket Style with Cutout Notches) */}
        <div className="mt-6 flex flex-col items-center justify-center rounded-3xl bg-white p-6 shadow-2xl border-4 border-orange-500/20">
          <canvas ref={canvasRef} className="rounded-xl" />
          
          <div className="mt-3 text-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">ORDER PASS CODE</span>
            <span className="font-mono text-2xl font-black text-slate-900 tracking-wider">
              {receipt.orderCode}
            </span>
          </div>

          <div className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>HMAC-SHA256 Cryptographic Token</span>
          </div>
        </div>

        {/* Ticket Details Box */}
        <div className="mt-6 rounded-3xl bg-slate-950/80 p-5 border border-white/10 space-y-3">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400">Customer:</span>
            <span className="font-bold text-white">{receipt.customerName || "Walk-in Student"}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400">Paid Amount:</span>
            <span className="font-black text-orange-400 text-sm">₹{receipt.totalAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400">Payment Ref:</span>
            <span className="font-mono text-[11px] text-slate-300">{receipt.paymentRef}</span>
          </div>

          {/* Items breakdown */}
          <div className="border-t border-white/10 pt-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
              Items Ordered
            </span>
            <div className="space-y-1">
              {receipt.items.map((i, idx) => (
                <div key={idx} className="flex justify-between text-xs text-slate-200">
                  <span>
                    {i.quantity}x {i.name}
                  </span>
                  <span className="font-medium text-slate-400">₹{i.subtotal.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 space-y-2.5">
          <button
            onClick={handleDownloadImage}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-slate-800 py-3 text-xs font-bold text-slate-200 hover:bg-slate-700 hover:text-white transition shadow cursor-pointer border border-white/10"
          >
            <Download className="h-4 w-4" />
            <span>{downloadSuccess ? "Downloaded Successfully!" : "Save Pass as Image"}</span>
          </button>

          {/* Test on Staff Scanner Bridge */}
          {onTestScan && (
            <button
              onClick={() => {
                onClose();
                onTestScan(receipt.rawToken);
              }}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 py-3.5 text-xs font-black text-white shadow-xl shadow-orange-500/30 hover:opacity-95 active:scale-98 transition cursor-pointer"
            >
              <span>Test Counter Verification with this QR</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>

        {isSavedLocally && (
          <p className="mt-4 text-center text-[10px] text-emerald-400/90 font-medium">
            ✓ Cached to this device • Viewable offline from &quot;My Saved Passes&quot;
          </p>
        )}
      </div>
    </div>
  );
};
