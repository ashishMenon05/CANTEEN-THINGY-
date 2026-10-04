"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Image from "next/image";
import confetti from "canvas-confetti";
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
  UtensilsCrossed,
} from "lucide-react";
import { SavedReceipt } from "./QrReceiptModal";
import { WaiterAssistant } from "./WaiterAssistant";

const FOOD_IMAGE_BLUR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 5'%3E%3Crect width='8' height='5' fill='%231a1814'/%3E%3C/svg%3E";

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
  const [sortOrder, setSortOrder] = useState<"recommended" | "price-low" | "price-high">("recommended");
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isWaiterOpen, setIsWaiterOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; variant: "success" | "error" } | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const heroTrackRef = useRef<HTMLElement | null>(null);
  const heroStageRef = useRef<HTMLDivElement | null>(null);
  const heroImageRef = useRef<HTMLImageElement | null>(null);
  const heroCopyRef = useRef<HTMLDivElement | null>(null);
  const heroNoteRef = useRef<HTMLDivElement | null>(null);

  const dismissToast = useCallback(() => {
    if (toastTimeoutRef.current !== null) {
      window.clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = null;
    }
    setToast(null);
  }, []);

  const showToast = useCallback((message: string, variant: "success" | "error") => {
    if (toastTimeoutRef.current !== null) window.clearTimeout(toastTimeoutRef.current);
    setToast({ message, variant });
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimeoutRef.current = null;
    }, 4500);
  }, []);

  useEffect(() => () => {
    if (toastTimeoutRef.current !== null) window.clearTimeout(toastTimeoutRef.current);
  }, []);

  useEffect(() => {
    let frame = 0;
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");

    const updateHeroImage = () => {
      cancelAnimationFrame(frame);
      if (motionPreference.matches) {
        if (heroImageRef.current) heroImageRef.current.style.removeProperty("transform");
        if (heroCopyRef.current) {
          heroCopyRef.current.style.removeProperty("transform");
          heroCopyRef.current.style.removeProperty("opacity");
        }
        if (heroNoteRef.current) {
          heroNoteRef.current.style.removeProperty("transform");
          heroNoteRef.current.style.removeProperty("opacity");
        }
        return;
      }
      frame = requestAnimationFrame(() => {
        const track = heroTrackRef.current;
        const stage = heroStageRef.current;
        const image = heroImageRef.current;
        const copy = heroCopyRef.current;
        const note = heroNoteRef.current;
        if (!track || !stage || !image || !copy || !note) return;

        const distance = track.offsetHeight - stage.offsetHeight;
        const progress = distance > 0
          ? Math.min(1, Math.max(0, -track.getBoundingClientRect().top / distance))
          : 0;
        const easedProgress = progress * progress * (3 - 2 * progress);
        image.style.transform = `translate3d(0, ${-easedProgress * 8}%, 0) scale(${1.08 + easedProgress * 0.08})`;
        copy.style.transform = `translate3d(0, ${-easedProgress * 24}px, 0)`;
        copy.style.opacity = String(1 - easedProgress * 0.42);
        note.style.transform = `translate3d(0, ${easedProgress * 18}px, 0) rotate(-9deg)`;
        note.style.opacity = String(1 - easedProgress * 0.35);
      });
    };

    updateHeroImage();
    window.addEventListener("scroll", updateHeroImage, { passive: true });
    window.addEventListener("resize", updateHeroImage);
    motionPreference.addEventListener("change", updateHeroImage);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", updateHeroImage);
      window.removeEventListener("resize", updateHeroImage);
      motionPreference.removeEventListener("change", updateHeroImage);
    };
  }, []);

  useEffect(() => {
    setIsWaiterOpen(sessionStorage.getItem("qpass_waiter_seen") !== "true");
  }, []);

  const dismissWaiter = useCallback(() => {
    sessionStorage.setItem("qpass_waiter_seen", "true");
    setIsWaiterOpen(false);
  }, []);

  const browseMenu = useCallback(() => {
    dismissWaiter();
    window.setTimeout(() => document.getElementById("menu")?.scrollIntoView({ behavior: "smooth" }), 0);
  }, [dismissWaiter]);

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
    const matchesFilters = items.filter((item) => {
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
    if (sortOrder === "price-low") return matchesFilters.sort((a, b) => a.price - b.price);
    if (sortOrder === "price-high") return matchesFilters.sort((a, b) => b.price - a.price);
    return matchesFilters;
  }, [items, selectedCategory, dietaryFilter, searchQuery, sortOrder]);
  const availableItemsCount = filteredItems.filter(
    (item) => item.inventory.availableOnline > 0 && !item.inventory.isOnlineClosed,
  ).length;

  // Cart operations
  const addToCart = (item: FoodItem): boolean => {
    setHoldError(null);
    const existing = cart[item.id];
    const newQty = (existing?.quantity || 0) + 1;

    // Check available online
    if (newQty > item.inventory.availableOnline) {
      showToast(`Only ${item.inventory.availableOnline} ${item.inventory.availableOnline === 1 ? "serving is" : "servings are"} available online.`, "error");
      return false;
    }

    showToast(`${item.name} added to your order.`, "success");
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
    return true;
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
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        confetti({
          particleCount: 90,
          spread: 68,
          origin: { y: 0.62 },
          colors: ["#c9a84c", "#e0c070", "#f5f0e8"],
        });
      }
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
        <div ref={heroStageRef} className={`hero-panel cinematic-stage relative flex flex-col justify-between overflow-hidden px-6 py-8 sm:px-12 sm:py-12 lg:px-20 ${isLoading ? "is-loading" : ""}`}>
          <Image
            ref={heroImageRef}
            className="cinematic-image"
            loading="eager"
            width={2000}
            height={1300}
            unoptimized
            placeholder="blur"
            blurDataURL={FOOD_IMAGE_BLUR}
            onLoad={(event) => { event.currentTarget.dataset.loaded = "true"; }}
            src={items[0]?.imageUrl || "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=2000&q=90"}
            alt={items[0]?.name || "A colorful, freshly prepared dish"}
          />
          {isLoading && <div className="cinematic-loading skeleton" role="status" aria-label="Loading today's menu" />}
          <div className="cinematic-grain" aria-hidden="true" />
          <div ref={heroNoteRef} className="hero-hand-note" aria-hidden="true">
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
            <div ref={heroCopyRef} className="cinematic-copy max-w-4xl">
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
                <span>Browse today&apos;s menu</span>
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div className="relative z-10 flex flex-col gap-5 border-t border-white/20 pt-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/75">
              <span className="flex items-center gap-2"><span className="semantic-dot-success h-1.5 w-1.5 rounded-full" /> Fresh from the kitchen</span>
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
                  <p className="font-bold">Your items are reserved for 10 minutes</p>
                  <p className="text-white/65">Complete payment before the timer expires.</p>
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
          <Image
            fill
            sizes="(max-width: 640px) 82vw, (max-width: 1280px) 42vw, 520px"
            unoptimized
            placeholder="blur"
            blurDataURL={FOOD_IMAGE_BLUR}
            onLoad={(event) => { event.currentTarget.dataset.loaded = "true"; }}
            src="https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1100&q=85"
            alt="A colorful bowl of fresh seasonal ingredients"
            loading="lazy"
            className="story-food-image"
          />
          <span className="kitchen-image-note" aria-hidden="true">always a little extra</span>
          <figcaption><span>FROM THE KITCHEN</span> A little care in every detail</figcaption>
        </figure>
      </section>

      {/* Interactive Controls & Filters Bar */}
      <section id="menu" className="scroll-mt-28 space-y-5">
        <div className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow mb-2">THE KITCHEN, RIGHT NOW</p>
            <h2 className="font-display text-3xl text-white sm:text-5xl">Today&apos;s good things.</h2>
            <p className="mt-2 max-w-sm text-xs leading-relaxed text-slate-400">
              {isLoading
                ? "Loading today’s menu…"
                : `${filteredItems.length} ${filteredItems.length === 1 ? "dish" : "dishes"} · ${availableItemsCount} available now`}
            </p>
          </div>
          <label className="flex shrink-0 items-center gap-2 text-xs text-slate-400">
            <span>Sort by</span>
            <select
              value={sortOrder}
              onChange={(event) => {
                const value = event.target.value;
                setSortOrder(value === "price-low" || value === "price-high" ? value : "recommended");
              }}
              className="rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-xs text-white outline-none transition focus:border-[var(--gold)]"
            >
              <option value="recommended">Recommended</option>
              <option value="price-low">Price: low to high</option>
              <option value="price-high">Price: high to low</option>
            </select>
          </label>
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search the menu"
              placeholder="Find a dish, snack or drink..."
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
                <span className="hidden sm:inline">Grid</span>
              </button>
              <button
                onClick={() => setViewMode("deck")}
                title="Swipeable Card Deck"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
                  viewMode === "deck" ? "bg-[var(--gold-dim)] text-white font-bold shadow" : "text-slate-400 hover:text-white"
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Deck</span>
              </button>
            </div>
          </div>
        </div>

        {/* Category Pills */}
        <nav className="menu-category-bar flex items-center gap-2 overflow-x-auto text-xs font-semibold scrollbar-none" aria-label="Filter dishes by category">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              aria-pressed={selectedCategory === cat.id}
              className={`menu-category whitespace-nowrap transition ${
                selectedCategory === cat.id ? "is-active" : ""
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </nav>

      {/* Main Food Showcase: Grid View (Default) */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Loading today's menu">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="food-card overflow-hidden">
              <div className="skeleton h-44" />
              <div className="space-y-3 p-5">
                <div className="skeleton h-4 w-3/4" />
                <div className="skeleton h-3 w-full" />
                <div className="flex items-center justify-between pt-2">
                  <div className="skeleton h-4 w-16" />
                  <div className="skeleton h-8 w-24 rounded-xl" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="inventory-empty surface-panel mx-auto max-w-lg rounded-3xl p-10 text-center" role="status">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--gold-glass)] text-gold-light">
            {items.length === 0 ? <UtensilsCrossed className="h-6 w-6" /> : <Search className="h-6 w-6" />}
          </div>
          <h3 className="text-lg font-black text-white">
            {items.length === 0 ? "Today's menu is being prepared" : "No dishes matched your filters"}
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            {items.length === 0
              ? "The kitchen menu could not be loaded just now. Please try again."
              : "Try switching dietary preferences or clearing your search query to see other available canteen items."}
          </p>
          {items.length === 0 ? (
            <button onClick={onRefresh} className="primary-action mt-5 rounded-xl px-4 py-2 text-xs font-bold">
              Refresh menu
            </button>
          ) : (
            <button
              onClick={() => {
                setSelectedCategory("All");
                setDietaryFilter("all");
                setSearchQuery("");
              }}
              className="primary-action mt-5 rounded-xl px-4 py-2 text-xs font-bold"
            >
              Reset All Filters
            </button>
          )}
        </div>
      ) : viewMode === "grid" ? (
        <div>
            <div className="signature-menu-grid grid grid-cols-1 gap-x-7 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {filteredItems.map((item, index) => {
                const inv = item.inventory;
                const isSoldOut = inv.availableOnline <= 0 || inv.isOnlineClosed;
                const inCartQty = cart[item.id]?.quantity || 0;
                const isLowStock = inv.availableOnline > 0 && inv.availableOnline < 5;
                const isCriticalStock = inv.availableOnline > 0 && inv.availableOnline < 2;

                return (
                  <div
                    key={item.id}
                    style={{
                      animationDelay: `${Math.min(index, 8) * 60}ms`,
                      backdropFilter: "blur(12px)",
                      WebkitBackdropFilter: "blur(12px)",
                    }}
                    className={`food-card flex flex-col justify-between overflow-hidden border transition-all ${
                      isSoldOut ? "opacity-60 border-slate-800" : ""
                    } fade-in-up`}
                  >
                    {/* Image & Badges */}
                    <div className="food-card-visual relative aspect-[4/3] w-full overflow-hidden bg-slate-900 group">
                      {item.imageUrl ? (
                        <Image
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1023px) 50vw, 33vw"
                          unoptimized
                          placeholder="blur"
                          blurDataURL={FOOD_IMAGE_BLUR}
                          onLoad={(event) => { event.currentTarget.dataset.loaded = "true"; }}
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

                      <div
                        className="absolute left-3 top-3 rounded-full bg-slate-950/80 backdrop-blur-md px-2.5 py-1 text-[10px] font-bold text-slate-300 border border-white/10"
                        style={{ backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" }}
                      >
                        {item.category}
                      </div>

                      <div
                        className="food-diet-badge absolute right-3 top-3 flex items-center gap-1.5 rounded-full border border-white/20 bg-slate-950/70 px-2.5 py-1.5 backdrop-blur-md"
                        style={{ backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" }}
                      >
                        <span className={item.isVeg ? "badge-veg" : "badge-nonveg"} />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-white">
                          {item.isVeg ? "Veg" : "Non-Veg"}
                        </span>
                      </div>

                      {isLowStock && (
                        <div className={`absolute bottom-3 left-3 flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black shadow-md ${isCriticalStock ? "stock-urgent" : "stock-low"}`}>
                          <Flame className="h-3 w-3" />
                          <span>{isCriticalStock ? `Only ${inv.availableOnline} left!` : `Running low · ${inv.availableOnline} left`}</span>
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
                          <span className="price-tag price-tag-small shrink-0">
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
                                inv.availableOnline >= 5
                                  ? "semantic-dot-success"
                                  : inv.availableOnline >= 2
                                  ? "semantic-dot-warning"
                                  : "semantic-dot-danger"
                              }`}
                            />
                            <span className={inv.availableOnline > 0 && inv.availableOnline < 5 ? "semantic-warning" : ""}>
                              {inv.availableOnline} servings available
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 block">Prepared fresh for pickup</span>
                        </div>

                        {/* Interactive Add or Stepper Button */}
                        {inCartQty > 0 ? (
                          <div className="flex items-center gap-2 rounded-2xl bg-orange-500/20 border border-orange-500/40 p-1 shadow-inner">
                            <button
                              aria-label={`Remove one ${item.name}`}
                              onClick={() => removeFromCart(item.id)}
                              className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 active:scale-95 transition cursor-pointer"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="w-5 text-center text-xs font-black text-white" aria-live="polite">{inCartQty}</span>
                            <button
                              aria-label={`Add one ${item.name}`}
                              onClick={() => addToCart(item)}
                              disabled={inCartQty >= inv.availableOnline}
                              className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--gold-dim)] text-white hover:bg-[var(--gold)] active:scale-95 transition disabled:opacity-40 cursor-pointer"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            aria-label={`Add ${item.name} to your order`}
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
        </div>
      ) : (
        <div className="relative">
          <div className="mb-3 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-orange-400">Swipeable Showcase Deck</p>
            <p className="text-xs text-slate-400">Drag up/down or swipe through today&apos;s kitchen selections</p>
          </div>

      {/* Alternative View: Interactive Card Deck (Showcase Mode) */}
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
                  className={`stack-card food-card absolute inset-x-0 top-0 flex flex-col justify-between overflow-hidden rounded-3xl border transition-all ${
                    isSoldOut ? "border-slate-800 opacity-70" : "border-white/10 hover:border-orange-500/40"
                  }`}
                  style={{
                    transform: `translateY(${stackPosition * 20 + (stackPosition === 0 ? dragOffset : 0)}px) scale(${1 - stackPosition * 0.04})`,
                    zIndex: 10 - stackPosition,
                    transition: isDraggingDeck ? "none" : "transform 500ms cubic-bezier(0.16, 1, 0.3, 1)",
                    backdropFilter: "blur(12px)",
                    WebkitBackdropFilter: "blur(12px)",
                  }}
                >
                  <div className="food-card-visual relative aspect-[4/5] w-full bg-slate-900 overflow-hidden">
                    {item.imageUrl && (
                      <Image
                        fill
                        sizes="(max-width: 640px) 100vw, 32rem"
                        unoptimized
                        placeholder="blur"
                        blurDataURL={FOOD_IMAGE_BLUR}
                        onLoad={(event) => { event.currentTarget.dataset.loaded = "true"; }}
                        src={item.imageUrl}
                        alt={item.name}
                        className="h-full w-full object-cover"
                      />
                    )}
                    <div
                      className="absolute left-3 top-3 rounded-full bg-slate-950/80 backdrop-blur-md px-3 py-1 text-[11px] font-bold text-white border border-white/10"
                      style={{ backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" }}
                    >
                      {item.category}
                    </div>
                    <div
                      className="food-diet-badge absolute right-3 top-3 flex items-center gap-1.5 rounded-full border border-white/20 bg-slate-950/70 px-2.5 py-1.5 backdrop-blur-md"
                      style={{ backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" }}
                    >
                      <span className={item.isVeg ? "badge-veg" : "badge-nonveg"} />
                      <span className="text-[10px] font-bold uppercase text-white">{item.isVeg ? "Veg" : "Non-Veg"}</span>
                    </div>
                  </div>

                  <div className="p-6 space-y-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="font-extrabold text-white text-xl">{item.name}</h3>
                      <span className="price-tag">₹{item.price.toFixed(2)}</span>
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
                          <span>Add</span>
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
      </section>

      {/* Floating order summary keeps the next step close while browsing. */}
      {totalItemsCount > 0 && !isCartOpen && !isCheckoutOpen && (
        <div className="order-summary-bar fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-xl">
          <div className="flex items-center justify-between gap-3 rounded-3xl p-3 text-white sm:p-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--gold)] text-black font-black text-base shadow-md sm:h-11 sm:w-11">
                {totalItemsCount}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/60">Your order</p>
                <p className="text-lg font-semibold leading-tight text-[var(--gold-light)] sm:text-xl">₹{totalAmount.toFixed(2)}</p>
              </div>
            </div>

            <button
              onClick={() => setIsCartOpen(true)}
              className="order-summary-button flex shrink-0 items-center gap-2 rounded-2xl px-4 py-3 text-xs font-extrabold active:scale-95 transition cursor-pointer sm:px-5"
            >
              <span>View order</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Order summary */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-4 backdrop-blur-md">
          <div className="w-full max-w-lg rounded-t-[2.5rem] sm:rounded-[2.5rem] bg-slate-900 border border-white/10 shadow-2xl p-6 sm:p-8 text-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/20 text-orange-400 border border-orange-500/30">
                  <ShoppingBag className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Your order</h3>
                  <p className="text-xs text-slate-400">{totalItemsCount} {totalItemsCount === 1 ? "item" : "items"} selected</p>
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
                    <Image
                      src={item.imageUrl}
                      alt={item.name}
                      width={48}
                      height={48}
                      unoptimized
                      placeholder="blur"
                      blurDataURL={FOOD_IMAGE_BLUR}
                      onLoad={(event) => { event.currentTarget.dataset.loaded = "true"; }}
                      className="cart-food-image h-12 w-12 rounded-xl object-cover"
                    />
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
                      aria-label={`Remove one ${item.name}`}
                      onClick={() => removeFromCart(item.foodItemId)}
                      className="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-700 text-white hover:bg-slate-600 transition cursor-pointer"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-5 text-center text-xs font-black text-white" aria-live="polite">{item.quantity}</span>
                    <button
                      aria-label={`Add one ${item.name}`}
                      onClick={() => {
                        const foodItem = items.find((f) => f.id === item.foodItemId);
                        if (foodItem) addToCart(foodItem);
                      }}
                      disabled={(() => {
                        const foodItem = items.find((candidate) => candidate.id === item.foodItemId);
                        return !foodItem || foodItem.inventory.isOnlineClosed || item.quantity >= foodItem.inventory.availableOnline;
                      })()}
                      className="flex h-7 w-7 items-center justify-center rounded-xl bg-[var(--gold-dim)] text-white hover:bg-[var(--gold)] transition disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
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
                <span>Pickup fee</span>
                <span className="semantic-success font-bold">₹0.00</span>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-3 font-black text-white text-lg">
                <span>Total</span>
                <span className="text-[var(--gold-light)]">₹{totalAmount.toFixed(2)}</span>
              </div>
            </div>

            {/* Stock reservation note */}
            <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-[var(--gold)]/20 bg-[var(--gold)]/10 p-3.5 text-xs text-slate-300">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold-light)]" />
              <span>
                We&apos;ll reserve these items for <strong>10 minutes</strong> while you complete payment.
              </span>
            </div>

            {/* Actions */}
            <div className="mt-6 flex gap-3">
              <button
                onClick={clearCart}
                className="w-1/3 rounded-2xl bg-slate-800 py-3.5 text-xs font-bold text-slate-300 hover:bg-slate-700 transition cursor-pointer"
              >
                Clear order
              </button>
              <button
                onClick={acquireHoldLock}
                disabled={isHolding || Object.keys(cart).length === 0}
                className="primary-action flex w-2/3 items-center justify-center gap-2 rounded-2xl py-3.5 text-xs font-extrabold disabled:opacity-50 transition cursor-pointer active:scale-98"
              >
                {isHolding ? (
                  <span>Securing your items…</span>
                ) : (
                  <>
                    <span>Continue to checkout</span>
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
        <div
          className="checkout-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md"
          style={{ backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}
        >
          <div className="checkout-dialog w-full max-w-md rounded-[2rem] border p-7 text-slate-100 shadow-2xl sm:p-9 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/20 text-orange-400 border border-orange-500/30">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Complete your order</h3>
                  <p className="text-xs text-slate-400">Secure payment • Pickup pass included</p>
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
              <span className="font-semibold">Items reserved for:</span>
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
            <div className="checkout-section mt-5 space-y-4">
              <div className="border-t border-white/10 pt-4">
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Name / department (optional)
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
                  Used by the counter team to identify your order.
                </p>
              </div>

              <div className="border-t border-white/10 pt-4">
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Mobile number (optional)
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
              <div className="border-t border-white/10 pt-4">
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
              <details className="mt-4 rounded-2xl border border-white/10 bg-slate-950/60 p-3.5 text-xs text-slate-400">
                <summary className="cursor-pointer font-semibold text-slate-300">Payment demo options</summary>
                <div className="pt-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-300">Simulate a declined payment</span>
                    <input
                      type="checkbox"
                      checked={simulateFailure}
                      onChange={(e) => setSimulateFailure(e.target.checked)}
                      className="h-4 w-4 rounded accent-orange-500 cursor-pointer"
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-slate-500">
                    For testing how a declined payment is handled.
                  </p>
                </div>
              </details>
            </div>

            {/* Total and Checkout Action */}
            <div className="checkout-summary mt-5 rounded-2xl p-4">
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs text-slate-400">Total Payable Amount</span>
                <span className="price-tag">₹{totalAmount.toFixed(2)}</span>
              </div>

              <button
                onClick={handleCheckoutAndPay}
                disabled={isPaying}
                className="primary-action flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-xs font-black shadow-xl hover:opacity-95 active:scale-98 transition disabled:opacity-50 cursor-pointer"
              >
                {isPaying ? (
                  <span>Processing secure payment…</span>
                ) : (
                  <>
                    <span>Pay ₹{totalAmount.toFixed(2)}</span>
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

      {isWaiterOpen && (
        <WaiterAssistant
          items={items}
          isLoading={isLoading}
          onAddToCart={addToCart}
          onRefresh={onRefresh}
          onDismiss={dismissWaiter}
          onManualBrowse={browseMenu}
        />
      )}

      {toast && (
        <div
          className={`app-toast app-toast-${toast.variant}${totalItemsCount > 0 && !isCartOpen && !isCheckoutOpen ? " has-order-summary" : ""}`}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {toast.variant === "error"
            ? <AlertTriangle className="app-toast-icon" aria-hidden="true" />
            : <CheckCircle2 className="app-toast-icon" aria-hidden="true" />}
          <p>{toast.message}</p>
          <button type="button" onClick={dismissToast} aria-label="Dismiss notification">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
};
