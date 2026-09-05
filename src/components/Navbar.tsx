"use client";

import React from "react";
import { Coffee, ShieldCheck, QrCode, Terminal, Wifi, WifiOff, Users, Clock } from "lucide-react";

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
  return (
    <header className="app-nav sticky top-0 z-40 border-b backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="brand-mark flex h-10 w-10 items-center justify-center rounded-xl text-white font-black text-xl">
            <Coffee className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black tracking-tight text-white">
                Q<span className="text-orange-500">-Pass</span>
              </span>
              <span className="hidden sm:inline-flex items-center rounded-full bg-orange-500/10 px-2 py-0.5 text-xs font-semibold text-orange-400 border border-orange-500/20">
                Zero-Login PWA
              </span>
            </div>
              <p className="text-[11px] text-slate-400 font-medium tracking-wide">Campus Canteen / Fast Pickup</p>
          </div>
        </div>

        {/* Center Tabs */}
        <div className="hidden md:flex items-center rounded-xl bg-slate-800/80 p-1 border border-slate-700/60">
          <button
            onClick={() => setActiveTab("student")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
              activeTab === "student"
                ? "bg-orange-500 text-white shadow-md shadow-orange-500/25"
                : "text-slate-300 hover:text-white"
            }`}
          >
            <Coffee className="h-3.5 w-3.5" />
            Student Ordering
            {cartCount > 0 && (
              <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.2 text-[10px] font-bold text-white">
                {cartCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("staff")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
              activeTab === "staff"
                ? "bg-orange-500 text-white shadow-md shadow-orange-500/25"
                : "text-slate-300 hover:text-white"
            }`}
          >
            <QrCode className="h-3.5 w-3.5" />
            Staff Counter & Scanner
          </button>

          <button
            onClick={() => setActiveTab("mentor")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
              activeTab === "mentor"
                ? "bg-slate-700 text-amber-300 shadow-sm"
                : "text-amber-400/80 hover:text-amber-300"
            }`}
          >
            <Terminal className="h-3.5 w-3.5 text-amber-400" />
            Architect & Mentor Lab
          </button>
        </div>

        {/* Right Status Badges */}
        <div className="flex items-center gap-2.5">
          {/* Simulated Offline Toggle */}
          <button
            onClick={() => setIsOnline(!isOnline)}
            title="Click to simulate offline network connectivity"
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium border transition-all ${
              isOnline
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                : "bg-red-500/15 text-red-400 border-red-500/40 animate-pulse"
            }`}
          >
            {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            <span className="hidden sm:inline">{isOnline ? "Online" : "Offline Sim"}</span>
          </button>

          {/* Online Ordering Status */}
          <div className="hidden lg:flex items-center gap-1.5 rounded-lg bg-slate-800/80 px-2.5 py-1 text-[11px] border border-slate-700/50 text-slate-300">
            <span
              className={`h-2 w-2 rounded-full ${
                onlineOrderingActive ? "bg-emerald-400 animate-pulse" : "bg-red-500"
              }`}
            />
            <span>{onlineOrderingActive ? "Online: OPEN" : "Online: CLOSED"}</span>
          </div>

          {/* Cart Button (Mobile & Desktop) */}
          <button
            onClick={openCart}
            className="relative flex items-center gap-1.5 rounded-xl bg-orange-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-lg shadow-orange-600/30 transition hover:bg-orange-500 active:scale-95"
          >
            <span>My Tray</span>
            {cartCount > 0 ? (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] font-black text-orange-600">
                {cartCount}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      {/* Mobile sub-tabs */}
      <div className="flex md:hidden border-t border-slate-800 px-2 py-1.5 bg-slate-900 justify-around text-xs">
        <button
          onClick={() => setActiveTab("student")}
          className={`flex items-center gap-1.5 py-1 px-2.5 rounded-md ${
            activeTab === "student" ? "bg-orange-500 text-white font-bold" : "text-slate-400"
          }`}
        >
          <Coffee className="h-3.5 w-3.5" />
          Student Menu
        </button>
        <button
          onClick={() => setActiveTab("staff")}
          className={`flex items-center gap-1.5 py-1 px-2.5 rounded-md ${
            activeTab === "staff" ? "bg-orange-500 text-white font-bold" : "text-slate-400"
          }`}
        >
          <QrCode className="h-3.5 w-3.5" />
          Staff Counter
        </button>
        <button
          onClick={() => setActiveTab("mentor")}
          className={`flex items-center gap-1.5 py-1 px-2.5 rounded-md ${
            activeTab === "mentor" ? "bg-slate-700 text-amber-300 font-bold" : "text-amber-400"
          }`}
        >
          <Terminal className="h-3.5 w-3.5" />
          Mentor Lab
        </button>
      </div>
    </header>
  );
};
