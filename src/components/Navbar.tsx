"use client";

import React from "react";
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
  const tabs = [
    { id: "student" as const, label: "The Menu", mobileLabel: "Menu", icon: UtensilsCrossed },
    { id: "staff" as const, label: "Pickup Counter", mobileLabel: "Pickup", icon: QrCode },
    { id: "mentor" as const, label: "Kitchen Notes", mobileLabel: "Kitchen", icon: Terminal },
  ];

  return (
    <header className="app-nav border-b">
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
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition ${
                activeTab === id ? "nav-pill-active" : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
              {id === "student" && cartCount > 0 && (
                <span className="ml-0.5 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px]">{cartCount}</span>
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
                : "border-red-500/40 bg-red-500/10 text-red-300"
            }`}
          >
            {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {isOnline ? "Connected" : "Offline"}
          </button>

          <span
            title={todayDate ? `Menu date: ${todayDate}` : undefined}
            className="hidden items-center gap-1.5 text-[10px] text-slate-400 lg:flex"
          >
            <span className={`h-1.5 w-1.5 rounded-full ${onlineOrderingActive ? "bg-emerald-400" : "bg-red-400"}`} />
            {onlineOrderingActive ? "Taking orders" : "Orders closed"}
          </span>

          <button onClick={openCart} className="primary-action relative flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold sm:px-4">
            <ShoppingBag className="h-4 w-4" />
            <span className="hidden sm:inline">Your tray</span>
            {cartCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-black/20 px-1 text-[10px] font-bold">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <nav className="flex justify-around border-t border-white/5 px-2 py-1.5 md:hidden" aria-label="Mobile navigation">
        {tabs.map(({ id, mobileLabel, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            aria-current={activeTab === id ? "page" : undefined}
            className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-[11px] transition ${
              activeTab === id ? "text-gold-light" : "text-slate-400"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {mobileLabel}
            {id === "student" && cartCount > 0 && (
              <span className="rounded-full bg-white/10 px-1.5 text-[10px]">{cartCount}</span>
            )}
            {id === "mentor" && <Sparkles className="h-3 w-3 text-gold" />}
          </button>
        ))}
      </nav>
    </header>
  );
};
