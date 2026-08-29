"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  QrCode,
  CheckCircle2,
  AlertCircle,
  Clock,
  Camera,
  RefreshCw,
  Sliders,
  Sparkles,
  Lock,
  ArrowRight,
  ShieldCheck,
  Utensils,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import confetti from "canvas-confetti";
import jsQR from "jsqr";

interface StaffViewProps {
  onRefresh: () => void;
  incomingToken?: string | null;
  onClearIncomingToken?: () => void;
}

export const StaffView: React.FC<StaffViewProps> = ({
  onRefresh,
  incomingToken,
  onClearIncomingToken,
}) => {
  // Staff Auth
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>("");
  const [authError, setAuthError] = useState<string | null>(null);

  // Scanner State
  const [rawTokenInput, setRawTokenInput] = useState<string>("");
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<any | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // Camera video stream
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameId = useRef<number | null>(null);

  // Orders Queue
  const [orders, setOrders] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [isLoadingOrders, setIsLoadingOrders] = useState<boolean>(false);
  const [orderFilter, setOrderFilter] = useState<string>("ALL");

  // Inventory Management
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [isManagingInventory, setIsManagingInventory] = useState<boolean>(false);
  const [updatingItemId, setUpdatingItemId] = useState<number | null>(null);

  const fetchStaffData = useCallback(async () => {
    setIsLoadingOrders(true);
    try {
      const [ordRes, invRes] = await Promise.all([
        fetch("/api/staff/orders"),
        fetch("/api/inventory"),
      ]);

      const ordData = await ordRes.json();
      const invData = await invRes.json();

      if (ordData.success) {
        setOrders(ordData.orders);
        setMetrics(ordData.metrics);
      }
      if (invData.success) {
        setInventoryItems(invData.items);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingOrders(false);
    }
  }, []);

  const handleVerifyToken = useCallback(async (tokenToVerify?: string) => {
    const token = (tokenToVerify || rawTokenInput).trim();
    if (!token) return;

    setIsVerifying(true);
    setScanResult(null);
    setScanError(null);

    try {
      const res = await fetch("/api/staff/scanner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          staffName: "Pickup Counter Lead",
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setScanError(data.error || "Token redemption failed.");
        setScanResult({
          status: "FAILED",
          code: data.code,
          error: data.error,
          orderCode: data.orderCode,
          previouslyServedAt: data.previouslyServedAt,
        });
      } else {
        setScanResult({
          status: "SUCCESS",
          order: data.order,
          message: data.message,
        });
        // Fire confetti for celebration
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
        fetchStaffData();
        onRefresh();
      }
    } catch (err: any) {
      setScanError(err.message || "Network error verifying token");
    } finally {
      setIsVerifying(false);
    }
  }, [rawTokenInput, fetchStaffData, onRefresh]);

  // Check if incomingToken was passed from Student test button
  useEffect(() => {
    if (incomingToken) {
      const timer = setTimeout(() => {
        setRawTokenInput(incomingToken);
        setIsAuthenticated(true); // auto unlock for dev walkthrough
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [incomingToken]);

  // Load orders & inventory when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const timer = setTimeout(() => {
        fetchStaffData();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, fetchStaffData]);

  // Auto-fill scanner when incoming token changes
  useEffect(() => {
    if (incomingToken && isAuthenticated) {
      const timer = setTimeout(() => {
        setRawTokenInput(incomingToken);
        handleVerifyToken(incomingToken);
        if (onClearIncomingToken) onClearIncomingToken();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [incomingToken, isAuthenticated, handleVerifyToken, onClearIncomingToken]);

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      const res = await fetch("/api/staff/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinInput }),
      });
      const data = await res.json();
      if (res.ok && data.authenticated) {
        setIsAuthenticated(true);
      } else {
        setAuthError(data.error || "Incorrect Staff PIN (Default is 1234)");
      }
    } catch (err: any) {
      setAuthError(err.message || "Auth error");
    }
  };


  // Camera QR code scanner loop
  const startCamera = async () => {
    setIsCameraActive(true);
    setScanError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        scanVideoFrame();
      }
    } catch (err: any) {
      setIsCameraActive(false);
      setScanError("Camera access denied or unavailable: " + err.message);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }
    setIsCameraActive(false);
  };

  const scanVideoFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;

    if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      if (ctx) {
        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });

        if (code && code.data) {
          stopCamera();
          setRawTokenInput(code.data);
          handleVerifyToken(code.data);
          return;
        }
      }
    }

    animationFrameId.current = requestAnimationFrame(scanVideoFrame);
  };


  // Change order status manually (e.g. mark READY)
  const handleUpdateOrderStatus = async (orderId: number, newStatus: string) => {
    try {
      const res = await fetch("/api/staff/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status: newStatus }),
      });
      if (res.ok) {
        fetchStaffData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Adjust Online Allocation for a Food Item
  const handleAdjustStock = async (
    foodItemId: number,
    newOnlineStock: number,
    isOnlineClosed?: boolean
  ) => {
    setUpdatingItemId(foodItemId);
    try {
      const res = await fetch("/api/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          foodItemId,
          onlineStock: newOnlineStock,
          isOnlineClosed,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || "Failed to adjust stock");
      } else {
        fetchStaffData();
        onRefresh();
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setUpdatingItemId(null);
    }
  };

  // Filter orders
  const filteredOrders = orders.filter((o) => {
    if (orderFilter === "ALL") return true;
    return o.status === orderFilter;
  });

  // Login Gate for Staff
  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-md py-12 px-4">
        <div className="rounded-3xl bg-slate-900 border border-slate-800 p-8 shadow-2xl text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-600/20 text-orange-500 border border-orange-500/30">
            <Lock className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-2xl font-black text-white">Canteen Staff Counter</h2>
          <p className="mt-1 text-xs text-slate-400">
            Zero-login applies to student pre-orders. Staff must enter the counter PIN to manage inventory and scan
            tokens.
          </p>

          <form onSubmit={handlePinSubmit} className="mt-6 space-y-4">
            <div>
              <input
                type="password"
                maxLength={8}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="Enter Staff PIN (Default: 1234)"
                className="w-full rounded-2xl bg-slate-800 border border-slate-700 py-3 text-center text-lg font-mono tracking-widest text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
              />
            </div>

            {authError && <p className="text-xs font-semibold text-red-400">{authError}</p>}

            <button
              type="submit"
              className="w-full rounded-xl bg-orange-600 py-3 text-xs font-bold text-white shadow-lg shadow-orange-600/30 hover:bg-orange-500 active:scale-98 transition"
            >
              Unlock Counter Terminal
            </button>

            <p className="text-[11px] text-slate-500">Demo counter PIN: 1234</p>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Top Metrics Row */}
      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
            <span className="text-xs text-slate-400 font-medium">Today&apos;s Online Revenue</span>
            <p className="text-xl sm:text-2xl font-black text-orange-400 mt-1">₹{metrics.totalRevenue}</p>
          </div>
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
            <span className="text-xs text-slate-400 font-medium">Orders Served</span>
            <p className="text-xl sm:text-2xl font-black text-emerald-400 mt-1">{metrics.servedCount}</p>
          </div>
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
            <span className="text-xs text-slate-400 font-medium">Awaiting Prep (PAID)</span>
            <p className="text-xl sm:text-2xl font-black text-amber-400 mt-1">{metrics.paidCount}</p>
          </div>
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
            <span className="text-xs text-slate-400 font-medium">Ready for Handover</span>
            <p className="text-xl sm:text-2xl font-black text-cyan-400 mt-1">{metrics.readyCount}</p>
          </div>
        </div>
      )}

      {/* Main Staff Scanner Section */}
      <div className="overflow-hidden rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/20 text-orange-400 border border-orange-500/30">
                <QrCode className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Fast-Pickup QR Scanner</h3>
                <p className="text-xs text-slate-400">Scan customer QR pass or verify token atomically</p>
              </div>
            </div>

            <button
              onClick={() => setIsManagingInventory(!isManagingInventory)}
              className="flex items-center gap-1.5 rounded-xl bg-slate-800 border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700"
            >
              <Sliders className="h-3.5 w-3.5" />
              <span>{isManagingInventory ? "Hide Stock Controls" : "Adjust Online Stock"}</span>
            </button>
          </div>

          {/* Scanner Input & Camera Controls */}
          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={rawTokenInput}
                  onChange={(e) => setRawTokenInput(e.target.value)}
                  placeholder="Paste or enter customer QR raw token (qp_sec_...)"
                  className="flex-1 rounded-xl bg-slate-950 border border-slate-700 px-3.5 py-2.5 text-xs font-mono text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
                />
                <button
                  onClick={() => handleVerifyToken()}
                  disabled={isVerifying || !rawTokenInput.trim()}
                  className="flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-orange-600/30 hover:bg-orange-500 active:scale-95 disabled:opacity-40 transition"
                >
                  {isVerifying ? "Verifying..." : "Redeem"}
                </button>
              </div>

              {/* Quick Test Bar for Mentor / Demo */}
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                <span className="font-semibold text-slate-300">Quick Test With Active Orders:</span>
                {orders
                  .filter((o) => o.status === "PAID" || o.status === "READY")
                  .slice(0, 3)
                  .map((o) => (
                    <button
                      key={o.id}
                      onClick={() => {
                        // For demo orders, fetch token or simulated token
                        alert(
                          `To test this order #${o.order_code}, present the QR pass from the Student Tab, or click 'Test Staff Scan' inside its receipt modal!`
                        );
                      }}
                      className="rounded-lg bg-slate-800 hover:bg-slate-700 px-2 py-1 font-mono text-orange-400 border border-slate-700"
                    >
                      {o.order_code} ({o.customer_name})
                    </button>
                  ))}
              </div>
            </div>

            {/* Camera Trigger */}
            <div>
              {!isCameraActive ? (
                <button
                  onClick={startCamera}
                  className="w-full h-full flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-700 bg-slate-950/40 p-4 text-xs text-slate-300 hover:bg-slate-950/80 hover:border-orange-500 transition"
                >
                  <Camera className="h-6 w-6 text-orange-400" />
                  <span className="font-bold">Open Camera Scanner</span>
                  <span className="text-[10px] text-slate-500">Scan student phone screen</span>
                </button>
              ) : (
                <div className="relative rounded-xl overflow-hidden bg-black border border-orange-500">
                  <video ref={videoRef} className="h-40 w-full object-cover" />
                  <canvas ref={canvasRef} className="hidden" />
                  <button
                    onClick={stopCamera}
                    className="absolute top-2 right-2 rounded-lg bg-red-600/80 px-2 py-1 text-[10px] font-bold text-white"
                  >
                    Close Camera
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Scanner Feedback Box */}
          {scanResult && (
            <div
              className={`mt-5 rounded-2xl p-4 border transition-all ${
                scanResult.status === "SUCCESS"
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-200"
                  : "bg-red-500/15 border-red-500/40 text-red-200"
              }`}
            >
              <div className="flex items-start gap-3">
                {scanResult.status === "SUCCESS" ? (
                  <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-6 w-6 text-red-400 shrink-0 mt-0.5" />
                )}

                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-black text-sm">
                      {scanResult.status === "SUCCESS"
                        ? "TOKEN VERIFIED — HAND OVER FOOD!"
                        : `SCAN REJECTED: ${scanResult.code}`}
                    </h4>
                    {scanResult.order && (
                      <span className="font-mono font-black text-white bg-emerald-600 px-2 py-0.5 rounded text-xs">
                        #{scanResult.order.orderCode}
                      </span>
                    )}
                  </div>

                  {scanResult.status === "SUCCESS" ? (
                    <div className="mt-2 space-y-2">
                      <p className="text-xs font-semibold text-white">
                        Customer: {scanResult.order.customerName} (Total Paid: ₹
                        {scanResult.order.totalAmount.toFixed(2)})
                      </p>
                      <div className="rounded-xl bg-slate-950/60 p-2.5 border border-emerald-500/20 text-xs">
                        <p className="font-bold text-emerald-400 mb-1">Assemble these items:</p>
                        <ul className="divide-y divide-slate-800">
                          {scanResult.order.items.map((i: any, idx: number) => (
                            <li key={idx} className="py-1 flex justify-between">
                              <span className="font-bold text-white">
                                {i.quantity}x {i.name}
                              </span>
                              <span className="text-slate-400 font-mono">₹{i.subtotal.toFixed(2)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <p className="text-[11px] text-emerald-300">
                        Atomically marked token as USED at {new Date(scanResult.order.servedAt).toLocaleTimeString()}
                      </p>
                    </div>
                  ) : (
                    <div className="mt-1 text-xs">
                      <p>{scanResult.error}</p>
                      {scanResult.previouslyServedAt && (
                        <p className="mt-1 text-[11px] text-red-300">
                          Previously served at:{" "}
                          {new Date(scanResult.previouslyServedAt).toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Online Inventory Modification Panel (Phase 2 & Section 2) */}
      {isManagingInventory && (
        <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-bold text-white">Same-Day Online Allocation Manager</h3>
              <p className="text-xs text-slate-400">
                Staff can adjust online stock anytime. Walk-in protected allocation = (Total Stock - Online Stock).
                Already sold units are never revoked.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {inventoryItems.map((item) => {
              const inv = item.inventory;
              return (
                <div
                  key={item.id}
                  className="flex flex-col justify-between rounded-2xl bg-slate-950/70 border border-slate-800 p-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-white text-sm">{item.name}</h4>
                      <p className="text-xs text-slate-400 font-mono">
                        Batch Total: {inv.totalStock} | Already Sold: {inv.soldOnline}
                      </p>
                    </div>
                    <span className="font-black text-orange-400 text-xs">₹{item.price}</span>
                  </div>

                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Online Allocation:</span>
                      <span className="font-bold text-white">{inv.onlineStock} units</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={inv.soldOnline}
                        max={inv.totalStock}
                        value={inv.onlineStock}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          handleAdjustStock(item.id, val, inv.isOnlineClosed);
                        }}
                        disabled={updatingItemId === item.id}
                        className="flex-1 accent-orange-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-800/80">
                      <span className="text-slate-400">
                        Protected Walk-in:{" "}
                        <strong className="text-slate-200">{inv.walkinProtectedStock}</strong>
                      </span>

                      <button
                        onClick={() => handleAdjustStock(item.id, inv.onlineStock, !inv.isOnlineClosed)}
                        className={`rounded-lg px-2.5 py-1 text-[10px] font-bold border transition ${
                          inv.isOnlineClosed
                            ? "bg-red-500/20 text-red-300 border-red-500/30 hover:bg-red-500/30"
                            : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30"
                        }`}
                      >
                        {inv.isOnlineClosed ? "Online: Closed (Click to Open)" : "Online: Active (Click to Close)"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Orders Queue Management (Phase 4 & 9) */}
      <div className="rounded-3xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-white">Today&apos;s Order Queue</h3>
            <p className="text-xs text-slate-400">Manage kitchen preparation and counter handovers</p>
          </div>

          {/* Status Filters */}
          <div className="flex items-center gap-1.5 rounded-xl bg-slate-800 p-1 text-xs">
            {["ALL", "PAID", "READY", "SERVED"].map((f) => (
              <button
                key={f}
                onClick={() => setOrderFilter(f)}
                className={`rounded-lg px-3 py-1 font-semibold transition ${
                  orderFilter === f
                    ? "bg-orange-500 text-white font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Orders Table */}
        <div className="divide-y divide-slate-800 max-h-[500px] overflow-y-auto">
          {filteredOrders.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No orders matching this filter today.
            </div>
          ) : (
            filteredOrders.map((ord) => (
              <div key={ord.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/30 transition">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-black text-orange-400">{ord.order_code}</span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        ord.status === "SERVED"
                          ? "bg-slate-800 text-slate-400"
                          : ord.status === "READY"
                          ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                          : ord.status === "PAID"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {ord.status}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(ord.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  <p className="text-xs font-semibold text-white">
                    {ord.customer_name} • Total: ₹{Number(ord.total_amount).toFixed(2)}
                  </p>

                  <p className="text-xs text-slate-400">
                    {ord.items?.map((i: any) => `${i.quantity}x ${i.name}`).join(", ")}
                  </p>
                </div>

                {/* Status action buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  {ord.status === "PAID" && (
                    <button
                      onClick={() => handleUpdateOrderStatus(ord.id, "READY")}
                      className="rounded-xl bg-cyan-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-cyan-500"
                    >
                      Mark Ready for Pickup
                    </button>
                  )}

                  {ord.status === "READY" && (
                    <button
                      onClick={() => handleUpdateOrderStatus(ord.id, "SERVED")}
                      className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500"
                    >
                      Mark Served (Manual)
                    </button>
                  )}

                  {ord.status === "SERVED" && (
                    <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Served
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
