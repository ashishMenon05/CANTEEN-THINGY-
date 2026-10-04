"use client";

import React from "react";
import {
  UtensilsCrossed,
  Clock,
  MapPin,
  Mail,
  Phone,
  ShieldCheck,
  Terminal,
  QrCode,
  Heart,
  Sparkles,
} from "lucide-react";

interface FooterProps {
  setActiveTab?: (tab: "student" | "staff" | "mentor") => void;
}

export const Footer: React.FC<FooterProps> = ({ setActiveTab }) => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer-band mt-16 border-t text-slate-400">
      {/* Main Footer Container */}
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="footer-columns grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* Column 1: Brand & Description */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="brand-mark flex h-10 w-10 items-center justify-center rounded-full text-white font-black text-xl">
                <UtensilsCrossed className="h-5 w-5" />
              </div>
              <div>
                <span className="text-xl font-bold tracking-tight text-white">
                  Q-Pass<span className="text-gold">.</span>
                </span>
                <span className="ml-2 inline-flex items-center rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                  The Daily Plate
                </span>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-slate-400">
              Thoughtfully made campus favourites, ready when you are. Browse the day&apos;s menu,
              order ahead, and collect with a secure Q-Pass.
            </p>
            <div className="footer-status inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-medium">
              <span className="semantic-dot-success h-2 w-2 rounded-full" />
              <span>All Canteen Counters Operational</span>
            </div>
          </div>

          {/* Column 2: Quick Navigation */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
              Around the table
            </h3>
            <ul className="mt-4 space-y-2.5 text-xs">
              <li>
                <button
                  onClick={() => setActiveTab?.("student")}
                  className="footer-link flex items-center gap-2 text-slate-400 transition hover:text-orange-400"
                >
                  <UtensilsCrossed className="h-3.5 w-3.5 text-gold" />
                  <span>Today&apos;s menu</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActiveTab?.("staff")}
                  className="footer-link flex items-center gap-2 text-slate-400 transition hover:text-orange-400"
                >
                  <QrCode className="h-3.5 w-3.5 text-orange-500" />
                  <span>Pickup counter</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActiveTab?.("mentor")}
                  className="footer-link flex items-center gap-2 text-slate-400 transition hover:text-amber-400"
                >
                  <Terminal className="h-3.5 w-3.5 text-amber-400" />
                  <span>Kitchen notes</span>
                </button>
              </li>
              <li>
                <div className="flex items-center gap-2 text-slate-500 pt-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-slate-500" />
                  <span>Atomic 10-min Stock Reservation</span>
                </div>
              </li>
            </ul>
          </div>

          {/* Column 3: Operating Hours & Location */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
              Find us here
            </h3>
            <ul className="mt-4 space-y-2.5 text-xs text-slate-400">
              <li className="flex items-start gap-2">
                <Clock className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-slate-200 font-medium">Mon – Sat: 8:00 AM – 6:30 PM</p>
                  <p className="text-[11px] text-slate-500">Breakfast: 8:00 – 11:30 AM</p>
                  <p className="text-[11px] text-slate-500">Lunch & Snacks: 12:00 – 6:30 PM</p>
                </div>
              </li>
              <li className="flex items-start gap-2 pt-1">
                <MapPin className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
                <span>Central Campus Food Court, Ground Floor, Block B</span>
              </li>
            </ul>
          </div>

          {/* Column 4: Contact & Helpdesk */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
              Need a hand?
            </h3>
            <p className="mt-4 text-xs text-slate-400">
              Need help with an order or pickup? We&apos;re happy to help:
            </p>
            <ul className="mt-3 space-y-2 text-xs">
              <li className="flex items-center gap-2 text-slate-300">
                <Mail className="h-3.5 w-3.5 text-orange-400" />
                <a
                  href="mailto:canteen-support@campus.edu"
                  className="footer-link underline underline-offset-2 decoration-slate-700 hover:text-orange-400 hover:decoration-orange-400"
                >
                  canteen-support@campus.edu
                </a>
              </li>
              <li className="flex items-center gap-2 text-slate-300">
                <Phone className="h-3.5 w-3.5 text-orange-400" />
                <span>Campus Ext: 4201 / +1 (800) 555-FOOD</span>
              </li>
              <li className="flex items-center gap-1.5 pt-1 text-[11px] text-amber-400/90 font-medium">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Instant counter verification with QR tokens</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Sub-Footer / Copyright */}
        <div className="mt-10 border-t border-slate-800/80 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left text-xs text-slate-500">
          <div>
            <p>
              © {currentYear} <span className="text-slate-300 font-medium">Q-Pass Canteen Systems</span>. All rights reserved.
            </p>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Freshly made on campus · Order ahead, collect at the counter
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1 text-slate-400">
              Made with <Heart className="h-3 w-3 text-red-500 inline fill-red-500" /> for campus students
            </span>
            <span className="text-slate-700">•</span>
            <button
              onClick={() => setActiveTab?.("mentor")}
              className="text-amber-400 hover:text-amber-300 transition"
            >
              System Health
            </button>
            <span className="text-slate-700">•</span>
            <button
              onClick={() => setActiveTab?.("staff")}
              className="text-slate-400 hover:text-white transition"
            >
              Counter Portal
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
