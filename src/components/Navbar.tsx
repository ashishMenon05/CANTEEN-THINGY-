"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  UtensilsCrossed,
  QrCode,
  Terminal,
  Wifi,
  WifiOff,
  ShoppingBag,
  Sparkles,
} from "lucide-react";

interface NavbarProps {
  activeTab: "student" | "staff" | "mentor";
  setActiveTab: (tab: "student" | "staff" | "mentor") => void;
  isOnline: boolean;
  setIsOnline: React.Dispatch<React.SetStateAction<boolean>>;
  cartCount: number;
  openCart: () => void;
  onlineOrderingActive: boolean;
  todayDate: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  isOnline,
  setIsOnline,
  cartCount,
  openCart,
  onlineOrderingActive,
  todayDate,
}) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [cartBounceKey, setCartBounceKey] = useState(0);
  const previousCartCount = useRef(cartCount);

  useEffect(() => {
    const updateScrollState = () => setIsScrolled(window.scrollY > 12);
    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });
    return () => window.removeEventListener("scroll", updateScrollState);
  }, []);

  useEffect(() => {
    if (cartCount > previousCartCount.current) setCartBounceKey((key) => key + 1);
    previousCartCount.current = cartCount;
  }, [cartCount]);

  const tabs = [
    { id: "student" as const, label: "The Menu", mobileLabel: "Menu", icon: UtensilsCrossed },
    { id: "staff" as const, label: "Pickup Counter", mobileLabel: "Pickup", icon: QrCode },
    { id: "mentor" as const, label: "Kitchen Notes", mobileLabel: "Kitchen", icon: Terminal },
  ];

  return (
    <header
      className={`app-nav ${isScrolled ? "nav-scrolled" : ""}`}
      style={{
        backdropFilter: `blur(${isScrolled ? 32 : 24}px) saturate(1.8)`,
        WebkitBackdropFilter: `blur(${isScrolled ? 32 : 24}px) saturate(1.8)`,
      }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <button
          onClick={() => setActiveTab("student")}
          className="group flex shrink-0 items-center gap-3 text-left"
          aria-label="Q-Pass home"
        >
          <span className="brand-mark flex h-10 w-10 items-center justify-center rounded-full text-white transition-transform group-hover:scale-105">
            <UtensilsCrossed className="h-5 w-5" />
          </span>
          <span>
            <span className="block font-display text-lg leading-tight tracking-wide text-white sm:text-xl">
              Q-Pass<span className="text-gold">.</span>
            </span>
            <span className="hidden text-[9px] uppercase tracking-[0.2em] text-slate-400 sm:block">
              The daily plate
            </span>
          </span>
        </button>

        <nav className="nav-tab-container hidden items-center gap-1 rounded-full p-1 md:flex" aria-label="Main navigation">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              aria-current={activeTab === id ? "page" : undefined}
              className={`nav-link nav-link-desktop ${activeTab === id ? "is-active" : ""}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
              {id === "student" && cartCount > 0 && (
                <span key={`desktop-menu-count-${cartBounceKey}`} className="cart-count ml-0.5 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px]">{cartCount}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setIsOnline(!isOnline)}
            title="Toggle network simulation"
            aria-label={isOnline ? "Simulate offline mode" : "Return online"}
            className={`hidden items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-medium transition sm:flex ${
              isOnline
                ? "border-white/10 text-slate-400 hover:border-white/25 hover:text-white"
                : "nav-offline"
            }`}
          >
            {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {isOnline ? "Connected" : "Offline"}
          </button>

          <span
            title={todayDate ? `Menu date: ${todayDate}` : undefined}
            className="hidden items-center gap-1.5 text-[10px] text-slate-400 lg:flex"
          >
            <span className={`h-1.5 w-1.5 rounded-full ${onlineOrderingActive ? "semantic-dot-success" : "semantic-dot-danger"}`} />
            <span className={onlineOrderingActive ? "semantic-success" : "semantic-danger"}>
              {onlineOrderingActive ? "Taking orders" : "Orders closed"}
            </span>
          </span>

          <button
            onClick={openCart}
            aria-label={cartCount > 0 ? `Your order, ${cartCount} ${cartCount === 1 ? "item" : "items"}` : "Your order"}
            className="primary-action relative flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold sm:px-4"
          >
            <ShoppingBag className="h-4 w-4" />
            <span className="hidden sm:inline">Your order</span>
            {cartCount > 0 && (
              <span key={`tray-count-${cartBounceKey}`} className="cart-count flex h-5 min-w-5 items-center justify-center rounded-full bg-black/20 px-1 text-[10px] font-bold">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <nav className="nav-mobile flex justify-around px-2 py-1.5 md:hidden" aria-label="Mobile navigation">
        {tabs.map(({ id, mobileLabel, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            aria-current={activeTab === id ? "page" : undefined}
            className={`nav-link nav-link-mobile ${activeTab === id ? "is-active" : ""}`}
          >
            <Icon className="h-3.5 w-3.5" />
            {mobileLabel}
            {id === "student" && cartCount > 0 && (
              <span key={`mobile-menu-count-${cartBounceKey}`} className="cart-count rounded-full bg-white/10 px-1.5 text-[10px]">{cartCount}</span>
            )}
            {id === "mentor" && <Sparkles className="h-3 w-3 text-gold" />}
          </button>
        ))}
      </nav>
    </header>
  );
};
