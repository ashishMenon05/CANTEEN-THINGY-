"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Navbar } from "@/components/Navbar";
import { StudentView } from "@/components/StudentView";
import { StaffView } from "@/components/StaffView";
import { MentorLabView } from "@/components/MentorLabView";
import { QrReceiptModal, SavedReceipt } from "@/components/QrReceiptModal";
import { Footer } from "@/components/Footer";

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<"student" | "staff" | "mentor">("student");
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [todayDate, setTodayDate] = useState<string>("");
  const [onlineOrderingActive, setOnlineOrderingActive] = useState<boolean>(true);

  // Active QR Receipt Modal
  const [activeReceipt, setActiveReceipt] = useState<SavedReceipt | null>(null);

  // For testing: pass token from receipt modal directly to staff scanner
  const [incomingTokenForStaff, setIncomingTokenForStaff] = useState<string | null>(null);

  // Register PWA service worker
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.warn("ServiceWorker registration failed:", err);
      });
    }
  }, []);

  // Fetch Inventory from API
  const fetchInventory = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/inventory");
      const data = await res.json();
      if (data.success) {
        setItems(data.items || []);
        setTodayDate(data.businessDate || new Date().toISOString().slice(0, 10));
        setOnlineOrderingActive(data.onlineOrderingActive ?? true);
      }
    } catch (e) {
      console.error("Failed to load inventory:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchInventory();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchInventory]);

  // Handle student clicking "Test Staff Scan" from receipt
  const handleTestScan = (token: string) => {
    setIncomingTokenForStaff(token);
    setActiveTab("staff");
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-orange-500 selection:text-white">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOnline={isOnline}
        setIsOnline={setIsOnline}
        cartCount={0}
        openCart={() => setActiveTab("student")}
        onlineOrderingActive={onlineOrderingActive}
        todayDate={todayDate}
      />

      {/* Main Content Area */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 pt-6">
        {activeTab === "student" && (
          <StudentView
            items={items}
            isLoading={isLoading}
            onRefresh={fetchInventory}
            onReceiptGenerated={(receipt) => setActiveReceipt(receipt)}
            isOnline={isOnline}
            onOpenScannerWithToken={(token) => {
              setIncomingTokenForStaff(token);
              setActiveTab("staff");
            }}
          />
        )}

        {activeTab === "staff" && (
          <StaffView
            onRefresh={fetchInventory}
            incomingToken={incomingTokenForStaff}
            onClearIncomingToken={() => setIncomingTokenForStaff(null)}
          />
        )}

        {activeTab === "mentor" && <MentorLabView />}
      </main>

      {/* Offline QR Receipt Modal */}
      {activeReceipt && (
        <QrReceiptModal
          receipt={activeReceipt}
          onClose={() => setActiveReceipt(null)}
          onTestScan={handleTestScan}
        />
      )}

      {/* Bottom Footer */}
      <Footer setActiveTab={setActiveTab} />
    </div>
  );
}
