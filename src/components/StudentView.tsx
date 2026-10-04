"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  ShoppingBag,
  Clock,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Minus,
  CreditCard,
  Phone,
  User,
  RefreshCw,
  QrCode,
  ArrowRight,
  Search,
  LayoutGrid,
  Layers,
  Flame,
  X,
} from "lucide-react";
import { SavedReceipt } from "./QrReceiptModal";

export interface FoodItem {
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

export interface CartItem {
  foodItemId: number;
  name: string;
  price: number;
  quantity: number;
  imageUrl: string | null;
  category?: string;
  isVeg?: boolean;
}

interface StudentViewProps {
  items: FoodItem[];
  isLoading: boolean;
  onRefresh: () => void;
  onReceiptGenerated: (receipt: SavedReceipt) => void;
  isOnline: boolean;
  cart: Record<number, CartItem>;
  setCart: React.Dispatch<React.SetStateAction<Record<number, CartItem>>>;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  onOpenScannerWithToken?: (token: string) => void;
}

export const StudentView: React.FC<StudentViewProps> = ({
  items,
  isLoading,
  onRefresh,
  onReceiptGenerated,
  isOnline,
  cart,
  setCart,
  isCartOpen,
  setIsCartOpen,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [dietaryFilter, setDietaryFilter] = useState<"all" | "veg" | "non-veg">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [viewMode, setViewMode] = useState<"grid" | "deck">("grid");
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const heroTrackRef = useRef<HTMLElement | null>(null);
  const heroImageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    let frame = 0;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      if (heroImageRef.current) heroImageRef.current.style.transform = "scale(1.08)";
      return;
    }

    const updateHeroImage = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const track = heroTrackRef.current;
        const image = heroImageRef.current;
        if (!track || !image) return;

        const distance = track.offsetHeight - window.innerHeight;
        const progress = distance > 0
          ? Math.min(1, Math.max(0, -track.getBoundingClientRect().top / distance))
          : 0;
        image.style.transform = `translate3d(0, ${-progress * 7}%, 0) scale(${1.08 + progress * 0.06})`;
      });
    };

    updateHeroImage();
    window.addEventListener("scroll", updateHeroImage, { passive: true });
    window.addEventListener("resize", updateHeroImage);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", updateHeroImage);
      window.removeEventListener("resize", updateHeroImage);
    };
  }, []);

  // 10-minute hold state
  const [holdSessionId, setHoldSessionId] = useState<string | null>(null);
  const [holdExpiresAt, setHoldExpiresAt] = useState<Date | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [isHolding, setIsHolding] = useState(false);
  const [holdError, setHoldError] = useState<string | null>(null);

  // Customer zero-login fields (auto-saved to localStorage for convenience)
  const [customerName, setCustomerName] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("qpass_customer_name") || "";
    }
    return "";
  });
  const [customerPhone, setCustomerPhone] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("qpass_customer_phone") || "";
    }
    return "";
  });

  // Save student details locally on change
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (customerName) localStorage.setItem("qpass_customer_name", customerName);
      if (customerPhone) localStorage.setItem("qpass_customer_phone", customerPhone);
    }
  }, [customerName, customerPhone]);

  // Payment simulator state
  const [isPaying, setIsPaying] = useState(false);
  const [paymentProvider, setPaymentProvider] = useState("PhonePe UPI");
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

  // Deck / Stack slider state
  const menuStackRef = useRef<HTMLDivElement | null>(null);
  const [stackIndex, setStackIndex] = useState(0);
  const dragStartY = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDraggingDeck, setIsDraggingDeck] = useState(false);

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

  const categories = [
    { id: "All", label: "All Items", icon: "✨" },
    { id: "Breakfast", label: "Breakfast", icon: "☕" },
    { id: "Lunch", label: "Lunch & Meals", icon: "🍱" },
    { id: "Snacks", label: "Quick Snacks", icon: "🥐" },
    { id: "Beverages", label: "Drinks & Chai", icon: "🥤" },
  ];

  // Filtered and searched items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Category filter
      if (selectedCategory !== "All" && item.category !== selectedCategory) {
        return false;
      }
      // Dietary filter
      if (dietaryFilter === "veg" && !item.isVeg) return false;
      if (dietaryFilter === "non-veg" && item.isVeg) return false;
      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(query);
        const matchesDesc = item.description.toLowerCase().includes(query);
        const matchesCat = item.category.toLowerCase().includes(query);
        if (!matchesName && !matchesDesc && !matchesCat) return false;
      }
      return true;
    });
  }, [items, selectedCategory, dietaryFilter, searchQuery]);

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
        category: item.category,
        isVeg: item.isVeg,
      },
    }));
  };

  const removeFromCart = (foodItemId: number) => {
    setHoldError(null);
    setCart((prev) => {
      const existing = prev[foodItemId];
      if (!existing) return prev;
      if (existing.quantity <= 1) {
        const updated = { ...prev };
        delete updated[foodItemId];
        return updated;
      }
      return {
        ...prev,
        [foodItemId]: {
          ...existing,
          quantity: existing.quantity - 1,
        },
      };
    });
  };

  const clearCart = async () => {
    if (holdSessionId) {
      try {
        await fetch(`/api/hold?holdSessionId=${holdSessionId}`, { method: "DELETE" });
      } catch (e) {
        console.warn("Could not release hold:", e);
      }
    }
    setCart({});
    setHoldSessionId(null);
    setHoldExpiresAt(null);
    setHoldError(null);
    setIsCartOpen(false);
  };

  // Acquire atomic 10-minute hold lock
  const acquireHoldLock = async () => {
    setIsHolding(true);
    setHoldError(null);

    const holdItems = Object.values(cart).map((c) => ({
      foodItemId: c.foodItemId,
      quantity: c.quantity,
    }));

    try {
      const res = await fetch("/api/hold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: holdItems,
          holdSessionId: holdSessionId || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Could not reserve stock. An item might be sold out.");
      }

      setHoldSessionId(data.holdSessionId);
      setHoldExpiresAt(new Date(data.expiresAt));
      setIsCartOpen(false);
      setIsCheckoutOpen(true);
    } catch (err: any) {
      setHoldError(err.message || "Failed to reserve items.");
      onRefresh(); // Refresh stock in background
    } finally {
      setIsHolding(false);
    }
  };

  // Complete Order & Payment
  const handleCheckoutAndPay = async () => {
    setIsPaying(true);
    setHoldError(null);

    try {
      // Step 1: Create Order
      const orderRes = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          holdSessionId,
          customerName: customerName.trim() || "Student (Walk-in)",
          customerPhone: customerPhone.trim() || undefined,
          items: Object.values(cart).map((c) => ({
            foodItemId: c.foodItemId,
            quantity: c.quantity,
          })),
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

  // Stack deck gestures
  const shiftStack = (direction: "up" | "down") => {
    if (filteredItems.length < 2) return;
    setStackIndex((current) =>
      direction === "down"
        ? Math.min(current + 1, filteredItems.length - 1)
        : Math.max(current - 1, 0),
    );
  };

  const handleDeckPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    dragStartY.current = event.clientY;
    setIsDraggingDeck(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleDeckPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartY.current !== null) {
      setDragOffset(event.clientY - dragStartY.current);
    }
  };

  const handleDeckPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartY.current === null) return;
    const distance = event.clientY - dragStartY.current;
    if (Math.abs(distance) > 45) {
      shiftStack(distance < 0 ? "down" : "up");
    }
    dragStartY.current = null;
    setIsDraggingDeck(false);
    setDragOffset(0);
  };

  return (
    <div className="space-y-8 pb-28">
      {/* Offline Alert Banner */}
      {!isOnline && (
        <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-300 shadow-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-amber-400" />
            <div className="flex-1">
              <h4 className="font-bold text-sm">Offline Simulation Mode Active</h4>
              <p className="text-xs text-amber-200/90 mt-0.5">
                New pre-orders require live server connectivity for stock reservations and UPI payments. However, your
                previously issued QR pickup passes remain 100% accessible and can be scanned at the counter!
              </p>
              {savedPasses.length > 0 && (
                <button
                  onClick={() => setShowSavedPasses(true)}
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-black text-slate-950 hover:bg-amber-400 shadow transition"
                >
                  <QrCode className="h-3.5 w-3.5" />
                  View {savedPasses.length} Saved Offline Pass{savedPasses.length > 1 ? "es" : ""}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* A long, pinned food-film scene: the frame drifts as the guest scrolls through it. */}
      <section ref={heroTrackRef} className="cinematic-track">
        <div className="hero-panel cinematic-stage relative flex flex-col justify-between overflow-hidden px-6 py-8 sm:px-12 sm:py-12 lg:px-20">
          <img
            ref={heroImageRef}
            className="cinematic-image"
            loading="lazy"
            src={items[0]?.imageUrl || "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=2000&q=90"}
            alt={items[0]?.name || "A colorful, freshly prepared dish"}
          />
          <div className="cinematic-grain" aria-hidden="true" />
          <div className="hero-hand-note" aria-hidden="true">
            <svg viewBox="0 0 64 58">
              <path d="M58 4C48 8 40 16 35 25c-4 8-8 14-16 18" />
              <path d="m19 43 1-8m-1 8 8-2" />
            </svg>
            <span>made with care</span>
          </div>
          <div className="relative z-10 flex items-center justify-between">
            <span className="eyebrow text-[10px]">Q-PASS / THE DAILY PLATE</span>
            <span className="hidden text-[10px] uppercase tracking-[0.22em] text-white/70 sm:block">
              Freshly made · Ready for you
            </span>
          </div>

          <div className="relative z-10 flex flex-1 items-center py-12">
            <div className="max-w-4xl">
              <p className="eyebrow mb-5 flex items-center gap-3 text-xs">
                <span className="h-px w-10 bg-[var(--gold)]" />
                MADE WITH A LITTLE MORE FEELING
              </p>
              <h1 className="cinematic-title">
                The day tastes<br />
                <span>better from here.</span>
              </h1>
              <p className="mt-6 max-w-md text-sm leading-7 text-white/75 sm:text-base">
                Fresh from our kitchen, made for the moment you finally get to slow down.
              </p>
              <a href="#menu" className="cinematic-cta mt-8 inline-flex items-center gap-4">
                <span>Come to the table</span>
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div className="relative z-10 flex flex-col gap-5 border-t border-white/20 pt-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/75">
              <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Fresh from the kitchen</span>
              <span>Seasonal, always</span>
              <span>Ready when you are</span>
            </div>
            <div className="flex items-center gap-3">
              {savedPasses.length > 0 && (
                <button onClick={() => setShowSavedPasses(true)} className="text-[10px] text-white/70 underline underline-offset-4 hover:text-white">
                  Saved passes ({savedPasses.length})
                </button>
              )}
              <button onClick={onRefresh} disabled={isLoading} aria-label="Refresh menu" className="text-white/65 transition hover:text-white disabled:opacity-40">
                <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              </button>
              <span className="hidden font-serif text-xs italic text-white/50 sm:block">Scroll to savour ↓</span>
            </div>
          </div>

          {secondsRemaining !== null && (
            <div className="relative z-10 mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/20 bg-black/50 p-4 text-xs text-white backdrop-blur-md">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-gold" />
                <div>
                  <p className="font-bold">Your table is held for 10 minutes</p>
                  <p className="text-white/65">Complete checkout to secure your selection.</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-base font-bold text-gold-light">{formatTimer(secondsRemaining)}</span>
                <button onClick={() => setIsCheckoutOpen(true)} className="rounded-full bg-white px-4 py-2 text-xs font-bold text-black">
                  Finish order →
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="kitchen-story" aria-labelledby="kitchen-story-title">
        <div className="kitchen-story-copy">
          <p className="eyebrow mb-5">A MOMENT BETWEEN CLASSES</p>
          <h2 id="kitchen-story-title" className="font-display text-4xl leading-[1.08] text-white sm:text-6xl">
            Not just a meal.<br /><span className="font-display-italic text-gold-light">Your little pause.</span>
          </h2>
          <p className="mt-6 max-w-md text-sm leading-7 text-white/55">
            Good ingredients. A hot pan. The familiar comfort of something made right now, not hours ago.
            Find your favourite, order ahead, and make a moment of it.
          </p>
          <a href="#menu" className="story-link mt-8 inline-flex items-center gap-3">
            See what&apos;s cooking <ArrowRight className="h-4 w-4" />
          </a>
        </div>
        <figure className="kitchen-story-image">
          <img
            src="https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1100&q=85"
            alt="A colorful bowl of fresh seasonal ingredients"
            loading="lazy"
          />
          <span className="kitchen-image-note" aria-hidden="true">always a little extra</span>
          <figcaption><span>FROM THE KITCHEN</span> A little care in every detail</figcaption>
        </figure>
      </section>

      {/* Interactive Controls & Filters Bar */}
      <section id="menu" className="scroll-mt-28 space-y-5">
        <div className="flex flex-col gap-2 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow mb-2">THE KITCHEN, RIGHT NOW</p>
            <h2 className="font-display text-3xl text-white sm:text-5xl">Today&apos;s good things.</h2>
          </div>
          <p className="max-w-sm text-xs leading-relaxed text-slate-400">
            Made today. Ordered in a moment. Waiting for you when you arrive.
          </p>
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dishes, snacks, beverages..."
              className="w-full rounded-2xl bg-slate-900/90 border border-white/10 pl-10 pr-9 py-2.5 text-xs text-white placeholder-slate-400 focus:border-yellow-700 focus:outline-none focus:ring-1 focus:ring-yellow-700 shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-2.5 rounded-full p-0.5 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Right Controls: Dietary Filter & View Mode Switcher */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Dietary Toggle */}
            <div className="flex items-center rounded-2xl bg-slate-900/90 p-1 border border-white/10 text-xs font-semibold">
              <button
                onClick={() => setDietaryFilter("all")}
                className={`px-3 py-1.5 rounded-xl transition ${
                  dietaryFilter === "all" ? "bg-white/15 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                All Food
              </button>
              <button
                onClick={() => setDietaryFilter("veg")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
                  dietaryFilter === "veg" ? "bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30" : "text-slate-400 hover:text-white"
                }`}
              >
                <span className="badge-veg" />
                <span>Pure Veg</span>
              </button>
              <button
                onClick={() => setDietaryFilter("non-veg")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
                  dietaryFilter === "non-veg" ? "bg-red-500/20 text-red-400 font-bold border border-red-500/30" : "text-slate-400 hover:text-white"
                }`}
              >
                <span className="badge-nonveg" />
                <span>Non-Veg</span>
              </button>
            </div>

            {/* View Mode: Grid vs Deck */}
            <div className="flex items-center rounded-2xl bg-slate-900/90 p-1 border border-white/10 text-xs font-semibold">
              <button
                onClick={() => setViewMode("grid")}
                title="Grid View"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
                  viewMode === "grid" ? "bg-[var(--gold-dim)] text-white font-bold shadow" : "text-slate-400 hover:text-white"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Grid Menu</span>
              </button>
              <button
                onClick={() => setViewMode("deck")}
                title="Swipeable Card Deck"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
                  viewMode === "deck" ? "bg-[var(--gold-dim)] text-white font-bold shadow" : "text-slate-400 hover:text-white"
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Card Deck</span>
              </button>
            </div>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-semibold scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`menu-category whitespace-nowrap transition ${
                selectedCategory === cat.id ? "is-active" : ""
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Main Food Showcase: Grid View (Default) */}
      {viewMode === "grid" && (
        <div>
          {isLoading && (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <div key={n} className="food-card overflow-hidden rounded-3xl border border-white/10">
                  <div className="h-44 animate-pulse bg-white/10" />
                  <div className="p-5 space-y-3">
                    <div className="h-4 w-3/4 animate-pulse rounded bg-white/10" />
                    <div className="h-3 w-full animate-pulse rounded bg-white/10" />
                    <div className="flex justify-between items-center pt-2">
                      <div className="h-4 w-16 animate-pulse rounded bg-white/10" />
                      <div className="h-8 w-24 animate-pulse rounded-xl bg-white/10" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && filteredItems.length === 0 && (
            <div className="surface-panel rounded-3xl p-10 text-center max-w-lg mx-auto">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500/15 text-orange-400 mb-4">
                <Search className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-black text-white">No dishes matched your filters</h3>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                Try switching dietary preferences or clearing your search query to see other available canteen items.
              </p>
              <button
                onClick={() => {
                  setSelectedCategory("All");
                  setDietaryFilter("all");
                  setSearchQuery("");
                }}
                className="primary-action mt-5 rounded-xl px-4 py-2 text-xs font-bold text-white"
              >
                Reset All Filters
              </button>
            </div>
          )}

          {!isLoading && filteredItems.length > 0 && (
            <div className="signature-menu-grid grid grid-cols-1 gap-x-7 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {filteredItems.map((item) => {
                const inv = item.inventory;
                const isSoldOut = inv.availableOnline <= 0 || inv.isOnlineClosed;
                const inCartQty = cart[item.id]?.quantity || 0;
                const isUrgentStock = inv.availableOnline > 0 && inv.availableOnline <= 5;

                return (
                  <div
                    key={item.id}
                    className={`food-card flex flex-col justify-between overflow-hidden border transition-all ${
                      isSoldOut ? "opacity-60 border-slate-800" : ""
                    }`}
                  >
                    {/* Image & Badges */}
                    <div className="relative h-72 w-full overflow-hidden bg-slate-900 group sm:h-80">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          loading="lazy"
                          className="signature-img h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-500 text-xs">
                          No photo
                        </div>
                      )}

                      {/* Veg / Non-Veg Indicator Tag */}
                      <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-slate-950/80 backdrop-blur-md px-2 py-1 shadow-md border border-white/10">
                        <span className={item.isVeg ? "badge-veg" : "badge-nonveg"} />
                        <span className="text-[10px] font-bold text-white uppercase tracking-wider">
                          {item.isVeg ? "Veg" : "Non-Veg"}
                        </span>
                      </div>

                      {/* Category Tag */}
                      <div className="absolute top-3 right-3 rounded-full bg-slate-950/80 backdrop-blur-md px-2.5 py-1 text-[10px] font-bold text-slate-300 border border-white/10">
                        {item.category}
                      </div>

                      {/* Urgent Low Stock Ribbon */}
                      {isUrgentStock && (
                        <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded-full bg-amber-500/90 text-slate-950 px-2.5 py-0.5 text-[10px] font-black shadow-md animate-pulse">
                          <Flame className="h-3 w-3" />
                          <span>Only {inv.availableOnline} Left!</span>
                        </div>
                      )}

                      {/* Online Sold Out Banner */}
                      {isSoldOut && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-xs text-white font-black text-sm uppercase tracking-wider">
                          {inv.isOnlineClosed ? "Online Ordering Closed" : "Sold Out Online"}
                        </div>
                      )}
                    </div>

                    {/* Content Details */}
                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      <div>
                        <div className="flex items-baseline justify-between gap-2">
                          <h3 className="font-display text-white text-lg leading-snug tracking-tight">
                            {item.name}
                          </h3>
                          <span className="text-gold-light shrink-0 font-semibold text-lg">
                            ₹{item.price.toFixed(2)}
                          </span>
                        </div>
                        <p className="mt-1.5 text-xs text-slate-400 line-clamp-2 leading-relaxed font-normal">
                          {item.description}
                        </p>
                      </div>

                      {/* Stock Allocation & Add Stepper */}
                      <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                        {/* Live Stock Indicators */}
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-300">
                            <span
                              className={`h-2 w-2 rounded-full ${
                                inv.availableOnline > 5
                                  ? "bg-emerald-400"
                                  : inv.availableOnline > 0
                                  ? "bg-amber-400 animate-pulse"
                                  : "bg-red-500"
                              }`}
                            />
                            <span>{inv.availableOnline} servings available</span>
                          </div>
                          <span className="text-[10px] text-slate-500 block">Prepared fresh for pickup</span>
                        </div>

                        {/* Interactive Add or Stepper Button */}
                        {inCartQty > 0 ? (
                          <div className="flex items-center gap-2 rounded-2xl bg-orange-500/20 border border-orange-500/40 p-1 shadow-inner">
                            <button
                              onClick={() => removeFromCart(item.id)}
                              className="flex h-7 w-7 items-center justify-center rounded-xl bg-orange-600 text-white hover:bg-orange-500 active:scale-95 transition cursor-pointer"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="w-5 text-center text-xs font-black text-white">{inCartQty}</span>
                            <button
                              onClick={() => addToCart(item)}
                              disabled={inCartQty >= inv.availableOnline}
                              className="flex h-7 w-7 items-center justify-center rounded-xl bg-orange-600 text-white hover:bg-orange-500 active:scale-95 transition disabled:opacity-40 cursor-pointer"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => addToCart(item)}
                            disabled={isSoldOut}
                            className="primary-action flex items-center gap-1.5 rounded-2xl px-4 py-2 text-xs font-extrabold text-white shadow-md active:scale-95 transition disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>Add</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Alternative View: Interactive Card Deck (Showcase Mode) */}
      {viewMode === "deck" && (
        <div className="relative">
          <div className="mb-3 text-center">
            <p className="text-xs text-orange-400 font-bold uppercase tracking-widest">Swipeable Showcase Deck</p>
            <p className="text-xs text-slate-400">Drag up/down or swipe through today&apos;s kitchen selections</p>
          </div>

          <div
            ref={menuStackRef}
            className="menu-stack relative mx-auto min-h-[31rem] w-full max-w-lg"
            onPointerDown={handleDeckPointerDown}
            onPointerMove={handleDeckPointerMove}
            onPointerUp={handleDeckPointerUp}
            onPointerCancel={handleDeckPointerUp}
          >
            {filteredItems.map((item, index) => {
              const stackPosition = (index - stackIndex + filteredItems.length) % filteredItems.length;
              if (stackPosition > 2) return null;
              const inv = item.inventory;
              const isSoldOut = inv.availableOnline <= 0 || inv.isOnlineClosed;
              const inCartQty = cart[item.id]?.quantity || 0;

              return (
                <div
                  key={item.id}
                  style={{
                    transform: `translateY(${stackPosition * 20 + (stackPosition === 0 ? dragOffset : 0)}px) scale(${1 - stackPosition * 0.04})`,
                    zIndex: 10 - stackPosition,
                    transition: isDraggingDeck ? "none" : "transform 500ms cubic-bezier(0.16, 1, 0.3, 1)",
                  }}
                  className={`stack-card food-card absolute inset-x-0 top-0 flex flex-col justify-between overflow-hidden rounded-3xl border transition-all ${
                    isSoldOut ? "border-slate-800 opacity-70" : "border-white/10 hover:border-orange-500/40"
                  }`}
                >
                  <div className="relative h-60 w-full bg-slate-900 overflow-hidden">
                    {item.imageUrl && (
                      <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                    )}
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-slate-950/80 backdrop-blur-md px-2.5 py-1 border border-white/10">
                      <span className={item.isVeg ? "badge-veg" : "badge-nonveg"} />
                      <span className="text-[10px] font-bold text-white uppercase">{item.isVeg ? "Veg" : "Non-Veg"}</span>
                    </div>
                    <div className="absolute top-3 right-3 rounded-full bg-slate-950/80 backdrop-blur-md px-3 py-1 text-[11px] font-bold text-white border border-white/10">
                      {item.category}
                    </div>
                  </div>

                  <div className="p-6 space-y-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="font-extrabold text-white text-xl">{item.name}</h3>
                      <span className="font-black text-orange-400 text-xl">₹{item.price.toFixed(2)}</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{item.description}</p>

                    <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                      <span className="text-xs text-slate-400 font-mono">
                        {inv.availableOnline} online available
                      </span>

                      {inCartQty > 0 ? (
                        <div className="flex items-center gap-3 rounded-2xl bg-orange-500/20 border border-orange-500/40 p-1.5">
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-600 text-white"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="font-black text-sm text-white px-1">{inCartQty}</span>
                          <button
                            onClick={() => addToCart(item)}
                            className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-600 text-white"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => addToCart(item)}
                          disabled={isSoldOut}
                          className="primary-action flex items-center gap-2 rounded-2xl px-5 py-2.5 text-xs font-bold text-white"
                        >
                          <Plus className="h-4 w-4" />
                          <span>Add to Tray</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Floating Bottom Tray Bar (Fixed Sticky on Scroll) */}
      {totalItemsCount > 0 && !isCartOpen && !isCheckoutOpen && (
        <div className="fixed bottom-6 left-4 right-4 z-40 mx-auto max-w-xl animate-bounce-short">
          <div className="flex items-center justify-between rounded-3xl bg-gradient-to-r from-orange-600 via-amber-600 to-orange-500 p-4 text-white shadow-2xl shadow-orange-600/40 border border-orange-400/30 backdrop-blur-md">
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-orange-600 font-black text-base shadow-md">
                {totalItemsCount}
              </div>
              <div>
                <p className="text-[11px] font-bold text-orange-100 uppercase tracking-wider">Your Tray</p>
                <p className="text-xl font-black leading-none">₹{totalAmount.toFixed(2)}</p>
              </div>
            </div>

            <button
              onClick={() => setIsCartOpen(true)}
              className="flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-2.5 text-xs font-extrabold text-white hover:bg-slate-900 active:scale-95 shadow-xl transition cursor-pointer border border-white/10"
            >
              <span>Review Tray & Lock Hold</span>
              <ArrowRight className="h-4 w-4 text-orange-400" />
            </button>
          </div>
        </div>
      )}

      {/* Cart / Tray Drawer Modal */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-4 backdrop-blur-md">
          <div className="w-full max-w-lg rounded-t-[2.5rem] sm:rounded-[2.5rem] bg-slate-900 border border-white/10 shadow-2xl p-6 sm:p-8 text-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/20 text-orange-400 border border-orange-500/30">
                  <ShoppingBag className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Your Pre-Order Tray</h3>
                  <p className="text-xs text-slate-400">{totalItemsCount} delicious items selected</p>
                </div>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {holdError && (
              <div className="mt-4 rounded-2xl bg-red-500/15 border border-red-500/30 p-3.5 text-xs text-red-300">
                {holdError}
              </div>
            )}

            {/* Cart Items List */}
            <div className="mt-4 divide-y divide-white/10">
              {Object.values(cart).map((item) => (
                <div key={item.foodItemId} className="flex items-center justify-between py-3.5">
                  <div className="flex items-center gap-3">
                    {item.imageUrl && (
                      <img src={item.imageUrl} alt={item.name} className="h-12 w-12 rounded-xl object-cover" />
                    )}
                    <div>
                      <h4 className="text-sm font-bold text-white">{item.name}</h4>
                      <p className="text-xs text-slate-400">
                        ₹{item.price.toFixed(2)} × {item.quantity} = ₹{(item.price * item.quantity).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 rounded-2xl bg-slate-800 p-1 border border-white/10">
                    <button
                      onClick={() => removeFromCart(item.foodItemId)}
                      className="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-700 text-white hover:bg-slate-600 transition cursor-pointer"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-5 text-center text-xs font-black text-white">{item.quantity}</span>
                    <button
                      onClick={() => {
                        const foodItem = items.find((f) => f.id === item.foodItemId);
                        if (foodItem) addToCart(foodItem);
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-xl bg-orange-600 text-white hover:bg-orange-500 transition cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Cost Breakdown */}
            <div className="mt-5 rounded-3xl bg-slate-950/70 p-5 border border-white/10 space-y-2.5">
              <div className="flex justify-between text-xs text-slate-300">
                <span>Items Subtotal</span>
                <span className="font-semibold text-white">₹{totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-300">
                <span>Canteen Convenience Fee</span>
                <span className="text-emerald-400 font-bold">₹0.00 (Campus Sponsored)</span>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-3 font-black text-white text-lg">
                <span>Total Amount</span>
                <span className="text-orange-400">₹{totalAmount.toFixed(2)}</span>
              </div>
            </div>

            {/* Hold Guarantee Note */}
            <div className="mt-4 flex items-start gap-2.5 text-xs text-slate-400 bg-orange-500/10 p-3.5 rounded-2xl border border-orange-500/20">
              <Lock className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
              <span>
                Clicking <strong>Proceed to Hold & Pay</strong> reserves these items for <strong>10 minutes</strong> with atomic row-level locks in PostgreSQL, guaranteeing your stock while you complete UPI payment.
              </span>
            </div>

            {/* Actions */}
            <div className="mt-6 flex gap-3">
              <button
                onClick={clearCart}
                className="w-1/3 rounded-2xl bg-slate-800 py-3.5 text-xs font-bold text-slate-300 hover:bg-slate-700 transition cursor-pointer"
              >
                Clear Tray
              </button>
              <button
                onClick={acquireHoldLock}
                disabled={isHolding || Object.keys(cart).length === 0}
                className="w-2/3 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 py-3.5 text-xs font-extrabold text-white shadow-xl shadow-orange-500/30 hover:opacity-95 disabled:opacity-50 transition cursor-pointer active:scale-98"
              >
                {isHolding ? (
                  <span>Reserving Stock in DB...</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-[2.5rem] bg-slate-900 border border-white/15 shadow-2xl p-6 sm:p-8 text-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/20 text-orange-400 border border-orange-500/30">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Instant UPI Checkout</h3>
                  <p className="text-xs text-slate-400">Zero login • Direct pickup token</p>
                </div>
              </div>
              <button
                onClick={() => setIsCheckoutOpen(false)}
                className="rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Hold countdown timer */}
            <div className="mt-4 flex items-center justify-between rounded-2xl bg-gradient-to-r from-orange-500/20 to-amber-500/20 border border-orange-500/30 px-4 py-2.5 text-xs text-orange-200">
              <span className="font-semibold">Stock Locked For:</span>
              <span className="font-mono text-sm font-black text-white bg-orange-600 px-3 py-0.5 rounded-xl shadow">
                {formatTimer(secondsRemaining)}
              </span>
            </div>

            {holdError && (
              <div className="mt-3 rounded-2xl bg-red-500/15 border border-red-500/30 p-3 text-xs text-red-300">
                {holdError}
              </div>
            )}

            {/* Zero-Login Optional Reference Info */}
            <div className="mt-4 space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Customer Name / Dept (Optional):
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Bhuvan - CS Block"
                    className="w-full rounded-2xl bg-slate-950 border border-white/10 pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  No password required. Used by counter staff to call your tray.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Mobile Number (Optional):
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full rounded-2xl bg-slate-950 border border-white/10 pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* UPI Payment Provider Selection */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">Select Payment Provider:</label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {["PhonePe UPI", "Google Pay UPI", "Paytm UPI", "Campus Card"].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPaymentProvider(p)}
                      className={`flex items-center justify-center rounded-2xl p-3 border transition cursor-pointer ${
                        paymentProvider === p
                          ? "border-orange-500 bg-orange-500/25 text-white font-extrabold shadow-md"
                          : "border-white/10 bg-slate-950/80 text-slate-400 hover:text-white hover:bg-slate-800"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Developer Test Simulator Option */}
              <div className="rounded-2xl bg-slate-950/80 p-3.5 border border-white/10 text-xs text-slate-400">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-300">Simulate Payment Failure</span>
                  <input
                    type="checkbox"
                    checked={simulateFailure}
                    onChange={(e) => setSimulateFailure(e.target.checked)}
                    className="h-4 w-4 rounded accent-orange-500 cursor-pointer"
                  />
                </div>
                <p className="mt-1 text-[10px] text-slate-500">
                  Tests how the system handles declined UPI transactions and automatically restores held inventory.
                </p>
              </div>
            </div>

            {/* Total and Checkout Action */}
            <div className="mt-6 pt-4 border-t border-white/10">
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs text-slate-400">Total Payable Amount</span>
                <span className="text-2xl font-black text-orange-400">₹{totalAmount.toFixed(2)}</span>
              </div>

              <button
                onClick={handleCheckoutAndPay}
                disabled={isPaying}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 py-3.5 text-xs font-black text-white shadow-xl shadow-orange-500/40 hover:opacity-95 active:scale-98 transition disabled:opacity-50 cursor-pointer"
              >
                {isPaying ? (
                  <span>Verifying Transaction with Gateway...</span>
                ) : (
                  <>
                    <span>Pay ₹{totalAmount.toFixed(2)} & Generate Pass</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-[2.5rem] bg-slate-900 border border-white/15 shadow-2xl p-6 sm:p-8 text-slate-100 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/20 text-orange-400 border border-orange-500/30">
                  <QrCode className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Saved Pickup Passes</h3>
                  <p className="text-xs text-slate-400">{savedPasses.length} passes cached on this device</p>
                </div>
              </div>
              <button
                onClick={() => setShowSavedPasses(false)}
                className="rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-3 text-xs text-slate-400 leading-relaxed">
              These passes are cryptographically signed and stored in your device&apos;s local cache. You can present them at the counter without any cellular data!
            </p>

            <div className="mt-4 space-y-3">
              {savedPasses.map((p, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-2xl bg-slate-950/80 p-4 border border-white/10 hover:border-orange-500/40 transition shadow-md"
                >
                  <div>
                    <span className="font-mono text-xs font-black text-orange-400">{p.orderCode}</span>
                    <p className="text-xs text-slate-200 font-bold mt-0.5">
                      {p.items?.map((i) => `${i.quantity}x ${i.name}`).join(", ")}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Paid: ₹{p.totalAmount?.toFixed(2)} • {new Date(p.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowSavedPasses(false);
                      onReceiptGenerated(p);
                    }}
                    className="rounded-xl bg-orange-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-orange-500 transition shadow cursor-pointer"
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
