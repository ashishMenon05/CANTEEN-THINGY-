"use client";

import React, { useState, useEffect } from "react";
import {
  ShoppingBag,
  Clock,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Minus,
  Sparkles,
  CreditCard,
  Phone,
  User,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  QrCode,
} from "lucide-react";
import { SavedReceipt } from "./QrReceiptModal";

interface FoodItem {
  id: number;
  name: string;
  description: string;
  category: string;
  price: number;
  imageUrl: string | null;
  isVeg: boolean;
  inventory: {
    totalStock: number;
    onlineStock: number;
    soldOnline: number;
    heldQuantity: number;
    walkinProtectedStock: number;
    availableOnline: number;
    isOnlineClosed: boolean;
    status: string;
  };
}

interface CartItem {
  foodItemId: number;
  name: string;
  price: number;
  quantity: number;
  imageUrl: string | null;
}

interface StudentViewProps {
  items: FoodItem[];
  isLoading: boolean;
  onRefresh: () => void;
  onReceiptGenerated: (receipt: SavedReceipt) => void;
  isOnline: boolean;
  onOpenScannerWithToken?: (token: string) => void;
}

export const StudentView: React.FC<StudentViewProps> = ({
  items,
  isLoading,
  onRefresh,
  onReceiptGenerated,
  isOnline,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [cart, setCart] = useState<Record<number, CartItem>>({});
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  // 10-minute hold state
  const [holdSessionId, setHoldSessionId] = useState<string | null>(null);
  const [holdExpiresAt, setHoldExpiresAt] = useState<Date | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [isHolding, setIsHolding] = useState(false);
  const [holdError, setHoldError] = useState<string | null>(null);

  // Customer zero-login fields
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  // Payment simulator state
  const [isPaying, setIsPaying] = useState(false);
  const [paymentProvider, setPaymentProvider] = useState("UPI (Google Pay / PhonePe)");
  const [simulateFailure, setSimulateFailure] = useState(false);

  // Offline cached passes
  const [savedPasses, setSavedPasses] = useState<SavedReceipt[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("qpass_offline_receipts");
        return stored ? JSON.parse(stored) : [];
      } catch (e) {
        console.warn("Storage load error:", e);
      }
    }
    return [];
  });
  const [showSavedPasses, setShowSavedPasses] = useState(false);

  // Countdown timer for 10-minute hold
  useEffect(() => {
    if (!holdExpiresAt) {
      const timer = setTimeout(() => {
        setSecondsRemaining(null);
      }, 0);
      return () => clearTimeout(timer);
    }

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((holdExpiresAt.getTime() - Date.now()) / 1000));
      setSecondsRemaining(remaining);

      if (remaining === 0) {
        clearInterval(interval);
        setHoldError("Your 10-minute inventory reservation has expired. Please reserve again.");
        setHoldSessionId(null);
        setHoldExpiresAt(null);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [holdExpiresAt]);

  const categories = ["All", "Snacks", "Breakfast", "Lunch", "Beverages"];

  const filteredItems =
    selectedCategory === "All" ? items : items.filter((i) => i.category === selectedCategory);

  // Cart operations
  const addToCart = (item: FoodItem) => {
    setHoldError(null);
    const existing = cart[item.id];
    const newQty = (existing?.quantity || 0) + 1;

    // Check available online
    if (newQty > item.inventory.availableOnline) {
      alert(`Sorry! Only ${item.inventory.availableOnline} units available online.`);
      return;
    }

    setCart((prev) => ({
      ...prev,
      [item.id]: {
        foodItemId: item.id,
        name: item.name,
        price: item.price,
        quantity: newQty,
        imageUrl: item.imageUrl,
      },
    }));
  };

  const removeFromCart = (foodItemId: number) => {
    setCart((prev) => {
      const copy = { ...prev };
      if (!copy[foodItemId]) return copy;
      if (copy[foodItemId].quantity <= 1) {
        delete copy[foodItemId];
      } else {
        copy[foodItemId].quantity -= 1;
      }
      return copy;
    });
  };

  const clearCart = async () => {
    if (holdSessionId) {
      try {
        await fetch(`/api/hold?holdSessionId=${holdSessionId}`, { method: "DELETE" });
      } catch (e) {
        console.error(e);
      }
    }
    setCart({});
    setHoldSessionId(null);
    setHoldExpiresAt(null);
    setSecondsRemaining(null);
    setHoldError(null);
  };

  // Acquire or refresh 10-Minute Hold Lock
  const acquireHoldLock = async () => {
    const itemsToHold = Object.values(cart).map((c) => ({
      foodItemId: c.foodItemId,
      quantity: c.quantity,
    }));

    if (itemsToHold.length === 0) return;

    setIsHolding(true);
    setHoldError(null);

    try {
      const res = await fetch("/api/hold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: itemsToHold,
          holdSessionId: holdSessionId || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setHoldError(data.error || "Could not reserve stock. Some items may have sold out.");
        return false;
      }

      setHoldSessionId(data.holdSessionId);
      setHoldExpiresAt(new Date(data.expiresAt));
      setIsCartOpen(false);
      setIsCheckoutOpen(true);
      return true;
    } catch (err: any) {
      setHoldError(err.message || "Network error reserving items.");
      return false;
    } finally {
      setIsHolding(false);
    }
  };

  // Complete Checkout & Server-Side UPI Payment Verification
  const handleCheckoutAndPay = async () => {
    if (!holdSessionId) {
      setHoldError("Hold expired or invalid session.");
      return;
    }

    setIsPaying(true);
    setHoldError(null);

    try {
      // Step 1: Create Order in PENDING status
      const orderRes = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          holdSessionId,
          customerName: customerName || "Student Guest",
          customerPhone: customerPhone || undefined,
          paymentMethod: paymentProvider,
        }),
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok || !orderData.success) {
        throw new Error(orderData.error || "Order creation failed.");
      }

      const orderId = orderData.order.id;

      // Step 2: Server-side Payment Verification & Token Generation
      const payRes = await fetch("/api/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          holdSessionId,
          paymentSimulationMode: simulateFailure ? "FAIL" : "SUCCESS",
          upiProvider: paymentProvider,
        }),
      });

      const payData = await payRes.json();
      if (!payRes.ok || !payData.success) {
        throw new Error(payData.error || "Payment verification declined.");
      }

      // Step 3: Success! Prepare Offline Receipt with the Raw Token
      const receipt: SavedReceipt = {
        orderId: payData.order.id,
        orderCode: payData.order.orderCode,
        customerName: payData.order.customerName,
        totalAmount: payData.order.totalAmount,
        paymentRef: payData.order.paymentRef,
        rawToken: payData.pickupCredential.rawToken,
        items: payData.order.items,
        orderDate: payData.order.orderDate,
        createdAt: new Date().toISOString(),
        status: "PAID",
      };

      // Reset cart & open receipt modal
      setCart({});
      setHoldSessionId(null);
      setHoldExpiresAt(null);
      setIsCheckoutOpen(false);
      onReceiptGenerated(receipt);
      onRefresh();
    } catch (err: any) {
      setHoldError(err.message || "Payment failed.");
    } finally {
      setIsPaying(false);
    }
  };

  const totalAmount = Object.values(cart).reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalItemsCount = Object.values(cart).reduce((sum, item) => sum + item.quantity, 0);

  const formatTimer = (seconds: number | null) => {
    if (seconds === null) return "--:--";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Offline Alert Banner */}
      {!isOnline && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-300">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-amber-400" />
            <div>
              <h4 className="font-bold text-sm">Offline Simulation Mode Active</h4>
              <p className="text-xs text-amber-200/90 mt-0.5">
                Pre-orders require live server connectivity for stock reservations and UPI payments. However, you can
                access your previously saved QR pickup passes without any internet connection!
              </p>
              {savedPasses.length > 0 && (
                <button
                  onClick={() => setShowSavedPasses(true)}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1 text-xs font-bold text-slate-950 hover:bg-amber-400"
                >
                  <QrCode className="h-3.5 w-3.5" />
                  View {savedPasses.length} Saved Offline Pass{savedPasses.length > 1 ? "es" : ""}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Hero Banner: Zero Login Architecture */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700/80 p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-orange-500/15 border border-orange-500/30 px-3 py-1 text-xs font-semibold text-orange-400">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Campus Pre-Order • Skip The Canteen Rush</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Zero Login. Instant Pickup Pass.
            </h1>
            <p className="max-w-xl text-xs sm:text-sm text-slate-300">
              Order food from your classroom with reliable Wi-Fi. Download your secure QR token. Present it at the
              canteen counter for lightning-fast verification—even if the canteen has zero mobile network.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {savedPasses.length > 0 && (
              <button
                onClick={() => setShowSavedPasses(true)}
                className="flex items-center gap-2 rounded-xl bg-slate-800 border border-slate-700 px-3.5 py-2 text-xs font-bold text-orange-400 hover:bg-slate-700 hover:text-orange-300 transition"
              >
                <QrCode className="h-4 w-4" />
                <span>My Saved Passes ({savedPasses.length})</span>
              </button>
            )}

            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="flex items-center gap-1.5 rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>Refresh Stock</span>
            </button>
          </div>
        </div>

        {/* 10-Minute Hold Status Strip */}
        {secondsRemaining !== null && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-orange-500/20 border border-orange-500/40 p-3 text-xs text-orange-300">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 animate-spin text-orange-400" />
              <span>
                <strong>10-Minute Inventory Hold Active:</strong> Your tray is locked in PostgreSQL.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-black text-white bg-orange-600 px-2.5 py-0.5 rounded-lg shadow">
                {formatTimer(secondsRemaining)}
              </span>
              <button
                onClick={() => setIsCheckoutOpen(true)}
                className="rounded-lg bg-white px-2.5 py-1 text-xs font-black text-orange-700 hover:bg-orange-50"
              >
                Complete Payment Now
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-semibold scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`whitespace-nowrap rounded-xl px-4 py-2 transition-all ${
              selectedCategory === cat
                ? "bg-orange-500 text-white shadow-md shadow-orange-500/20 font-bold"
                : "bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/60"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Food Items Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredItems.map((item) => {
          const inv = item.inventory;
          const isSoldOut = inv.availableOnline <= 0 || inv.isOnlineClosed;
          const inCartQty = cart[item.id]?.quantity || 0;

          return (
            <div
              key={item.id}
              className={`flex flex-col justify-between overflow-hidden rounded-2xl border transition-all ${
                isSoldOut
                  ? "border-slate-800 bg-slate-900/50 opacity-70"
                  : "border-slate-800 bg-slate-900 hover:border-slate-700 hover:shadow-lg"
              }`}
            >
              {/* Image & Status Badge */}
              <div className="relative h-44 w-full bg-slate-800 overflow-hidden">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="h-full w-full object-cover transition duration-300 hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-slate-800 text-slate-600">
                    No photo
                  </div>
                )}

                {/* Veg / Non-veg dot */}
                <div className="absolute top-3 left-3 flex h-6 w-6 items-center justify-center rounded-md bg-white/90 shadow">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${item.isVeg ? "bg-emerald-600" : "bg-red-600"}`}
                  />
                </div>

                {/* Stock allocation badge */}
                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between rounded-xl bg-slate-950/80 backdrop-blur-md px-2.5 py-1 text-[11px] text-white">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        inv.availableOnline > 10
                          ? "bg-emerald-400"
                          : inv.availableOnline > 0
                          ? "bg-amber-400 animate-pulse"
                          : "bg-red-500"
                      }`}
                    />
                    <span>
                      {inv.isOnlineClosed
                        ? "Online Ordering Closed"
                        : inv.availableOnline > 0
                        ? `${inv.availableOnline} Online Left`
                        : "Sold Out Online"}
                    </span>
                  </div>

                  <span
                    title="Protected for walk-in students at the physical counter"
                    className="text-[10px] text-slate-400 font-mono"
                  >
                    Walk-in: {inv.walkinProtectedStock}
                  </span>
                </div>
              </div>

              {/* Item Info */}
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-white text-base leading-snug">{item.name}</h3>
                    <span className="shrink-0 font-black text-orange-400 text-base">
                      ₹{item.price.toFixed(2)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400 line-clamp-2">{item.description}</p>
                </div>

                {/* Counter & Action */}
                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 font-medium">{item.category}</span>

                  {inCartQty > 0 ? (
                    <div className="flex items-center gap-2 rounded-xl bg-orange-500/20 border border-orange-500/40 p-1">
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-600 text-white hover:bg-orange-500 active:scale-95 transition"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-5 text-center text-xs font-bold text-white">{inCartQty}</span>
                      <button
                        onClick={() => addToCart(item)}
                        disabled={inCartQty >= inv.availableOnline}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-600 text-white hover:bg-orange-500 active:scale-95 transition disabled:opacity-40"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => addToCart(item)}
                      disabled={isSoldOut}
                      className="flex items-center gap-1 rounded-xl bg-orange-600 px-3.5 py-1.5 text-xs font-bold text-white shadow hover:bg-orange-500 active:scale-95 transition disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add to Tray
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating Bottom Bar if Cart Has Items */}
      {totalItemsCount > 0 && !isCartOpen && !isCheckoutOpen && (
        <div className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-xl">
          <div className="flex items-center justify-between rounded-2xl bg-orange-600 p-3.5 text-white shadow-2xl shadow-orange-600/40">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-orange-600 font-black">
                {totalItemsCount}
              </div>
              <div>
                <p className="text-xs font-medium text-orange-100">Tray Total</p>
                <p className="text-lg font-black leading-none">₹{totalAmount.toFixed(2)}</p>
              </div>
            </div>

            <button
              onClick={() => setIsCartOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-xs font-bold text-white hover:bg-slate-900 active:scale-95 shadow transition"
            >
              <span>Review & Lock Hold</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Cart Drawer Modal */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 p-0 sm:p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl p-6 text-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-orange-400" />
                <h3 className="text-lg font-bold text-white">Your Pre-Order Tray</h3>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                ✕
              </button>
            </div>

            {holdError && (
              <div className="mt-3 rounded-xl bg-red-500/15 border border-red-500/30 p-3 text-xs text-red-300">
                {holdError}
              </div>
            )}

            {/* Cart Items List */}
            <div className="mt-4 divide-y divide-slate-800">
              {Object.values(cart).map((item) => (
                <div key={item.foodItemId} className="flex items-center justify-between py-3">
                  <div>
                    <h4 className="text-sm font-bold text-white">{item.name}</h4>
                    <p className="text-xs text-slate-400">
                      ₹{item.price.toFixed(2)} × {item.quantity} = ₹{(item.price * item.quantity).toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl bg-slate-800 p-1 border border-slate-700">
                    <button
                      onClick={() => removeFromCart(item.foodItemId)}
                      className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-700 text-white hover:bg-slate-600"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-5 text-center text-xs font-bold text-white">{item.quantity}</span>
                    <button
                      onClick={() => {
                        const foodItem = items.find((f) => f.id === item.foodItemId);
                        if (foodItem) addToCart(foodItem);
                      }}
                      className="flex h-6 w-6 items-center justify-center rounded-lg bg-orange-600 text-white hover:bg-orange-500"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Total and Hold Guarantee Explanation */}
            <div className="mt-4 rounded-2xl bg-slate-800/80 p-4 border border-slate-700/60 space-y-2">
              <div className="flex justify-between text-xs text-slate-300">
                <span>Items Subtotal</span>
                <span>₹{totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-300">
                <span>Canteen Pre-Order Fee</span>
                <span className="text-emerald-400 font-semibold">₹0.00 (Free)</span>
              </div>
              <div className="flex justify-between border-t border-slate-700 pt-2 font-bold text-white text-base">
                <span>Total Amount to Pay</span>
                <span className="text-orange-400">₹{totalAmount.toFixed(2)}</span>
              </div>
            </div>

            <div className="mt-3 flex items-start gap-2 text-[11px] text-slate-400 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
              <Lock className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
              <span>
                Clicking <strong>Proceed to Hold & Pay</strong> locks this inventory for <strong>10 minutes</strong> in
                PostgreSQL with atomic row locks, ensuring nobody can take your food while you scan the UPI QR.
              </span>
            </div>

            {/* Actions */}
            <div className="mt-4 flex gap-2">
              <button
                onClick={clearCart}
                className="w-1/3 rounded-xl bg-slate-800 py-3 text-xs font-bold text-slate-300 hover:bg-slate-700 transition"
              >
                Clear
              </button>
              <button
                onClick={acquireHoldLock}
                disabled={isHolding || Object.keys(cart).length === 0}
                className="w-2/3 flex items-center justify-center gap-2 rounded-xl bg-orange-600 py-3 text-xs font-bold text-white shadow-lg shadow-orange-600/30 hover:bg-orange-500 disabled:opacity-50 transition"
              >
                {isHolding ? (
                  <span>Reserving Lock...</span>
                ) : (
                  <>
                    <span>Proceed to Hold & Pay</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout & UPI Payment Modal */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl p-6 text-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-orange-400" />
                <h3 className="text-lg font-bold text-white">UPI Payment Checkout</h3>
              </div>
              <button
                onClick={() => setIsCheckoutOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Hold countdown timer */}
            <div className="mt-3 flex items-center justify-between rounded-xl bg-orange-500/15 border border-orange-500/30 px-3.5 py-2 text-xs text-orange-300 font-medium">
              <span>Holding inventory for:</span>
              <span className="font-mono text-sm font-black text-white bg-orange-600 px-2 py-0.5 rounded">
                {formatTimer(secondsRemaining)}
              </span>
            </div>

            {holdError && (
              <div className="mt-3 rounded-xl bg-red-500/15 border border-red-500/30 p-3 text-xs text-red-300">
                {holdError}
              </div>
            )}

            {/* Zero-Login Optional Reference Info */}
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Customer Nickname / Dept (Zero Login):
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Rohan - CS 3rd Year"
                    className="w-full rounded-xl bg-slate-800 border border-slate-700 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  No account, password, or OTP required. This helps canteen staff call your name if needed.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Phone Number (Optional for SMS receipt backup):
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full rounded-xl bg-slate-800 border border-slate-700 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* UPI Payment Provider Selection */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">Select UPI Provider:</label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {["PhonePe UPI", "Google Pay UPI", "Paytm UPI", "BHIM UPI"].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPaymentProvider(p)}
                      className={`flex items-center justify-center rounded-xl p-2.5 border transition ${
                        paymentProvider === p
                          ? "border-orange-500 bg-orange-500/20 text-white font-bold"
                          : "border-slate-800 bg-slate-800/80 text-slate-400 hover:text-white"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Developer Test Simulator Option */}
              <div className="rounded-xl bg-slate-950/60 p-3 border border-slate-800 text-[11px] text-slate-400">
                <div className="flex items-center justify-between">
                  <span>Dev Test: Simulate Payment Failure</span>
                  <input
                    type="checkbox"
                    checked={simulateFailure}
                    onChange={(e) => setSimulateFailure(e.target.checked)}
                    className="h-4 w-4 rounded accent-orange-600"
                  />
                </div>
                <p className="mt-1 text-[10px] text-slate-500">
                  Tests how the system handles declined UPI transactions and releases held inventory.
                </p>
              </div>
            </div>

            {/* Total and Checkout Action */}
            <div className="mt-5 pt-3 border-t border-slate-800">
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs text-slate-400">Total Payable Amount</span>
                <span className="text-xl font-black text-orange-400">₹{totalAmount.toFixed(2)}</span>
              </div>

              <button
                onClick={handleCheckoutAndPay}
                disabled={isPaying}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 py-3 text-xs font-bold text-white shadow-xl shadow-orange-600/30 hover:opacity-95 active:scale-98 transition disabled:opacity-50"
              >
                {isPaying ? (
                  <span>Verifying UPI Gateway with Server...</span>
                ) : (
                  <>
                    <span>Pay ₹{totalAmount.toFixed(2)} & Get Pickup QR</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Offline Saved Passes Modal */}
      {showSavedPasses && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl p-6 text-slate-100 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <QrCode className="h-5 w-5 text-orange-400" />
                <h3 className="text-lg font-bold text-white">Offline Saved Passes ({savedPasses.length})</h3>
              </div>
              <button
                onClick={() => setShowSavedPasses(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="mt-2 text-xs text-slate-400">
              These passes are cached locally on this device. You can display them at the canteen counter without any
              mobile network.
            </p>

            <div className="mt-4 space-y-3">
              {savedPasses.map((p, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-2xl bg-slate-800/80 p-3.5 border border-slate-700/80"
                >
                  <div>
                    <span className="font-mono text-xs font-bold text-orange-400">{p.orderCode}</span>
                    <p className="text-xs text-slate-200 font-semibold mt-0.5">
                      {p.items?.map((i) => `${i.quantity}x ${i.name}`).join(", ")}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Paid: ₹{p.totalAmount?.toFixed(2)} • {new Date(p.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowSavedPasses(false);
                      onReceiptGenerated(p);
                    }}
                    className="rounded-xl bg-orange-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-orange-500"
                  >
                    View QR
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
