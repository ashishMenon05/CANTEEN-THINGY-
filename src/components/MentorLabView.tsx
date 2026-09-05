"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Terminal,
  ShieldCheck,
  Zap,
  Database,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Play,
  RefreshCw,
  Code2,
  Lock,
  ChevronRight,
  Cpu,
} from "lucide-react";

export const MentorLabView: React.FC = () => {
  const [activeSubSection, setActiveSubSection] = useState<"diagnostics" | "race" | "db" | "terminal">("diagnostics");

  // Diagnostics State
  const [diagnostics, setDiagnostics] = useState<any | null>(null);
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);

  // Race Condition Test State
  const [raceResult, setRaceResult] = useState<any | null>(null);
  const [isRunningRace, setIsRunningRace] = useState(false);

  // Database Inspector State
  const [selectedTable, setSelectedTable] = useState<string>("food_items");
  const [tableData, setTableData] = useState<any[]>([]);
  const [isLoadingTable, setIsLoadingTable] = useState(false);

  const runDiagnostics = useCallback(async () => {
    setIsRunningDiagnostics(true);
    try {
      const res = await fetch("/api/mentor/verify");
      const data = await res.json();
      setDiagnostics(data);
    } catch (e) {
      console.error("Diagnostics failed:", e);
    } finally {
      setIsRunningDiagnostics(false);
    }
  }, []);

  // Run diagnostics automatically on first view
  useEffect(() => {
    const timer = setTimeout(() => {
      runDiagnostics();
    }, 0);
    return () => clearTimeout(timer);
  }, [runDiagnostics]);

  const runRaceSimulation = async () => {
    setIsRunningRace(true);
    setRaceResult(null);
    try {
      const res = await fetch("/api/hold/race-test", { method: "POST" });
      const data = await res.json();
      setRaceResult(data);
    } catch (e: any) {
      alert("Simulation error: " + e.message);
    } finally {
      setIsRunningRace(false);
    }
  };

  const loadTableData = async (tableName: string) => {
    setSelectedTable(tableName);
    setIsLoadingTable(true);
    try {
      // In this template, we can fetch via dedicated inspection route or API
      let endpoint = "/api/orders";
      if (tableName === "food_items" || tableName === "daily_inventory") {
        endpoint = "/api/inventory";
      }
      const res = await fetch(endpoint);
      const data = await res.json();

      if (tableName === "orders") {
        setTableData(data.orders || []);
      } else if (tableName === "food_items") {
        setTableData(data.items || []);
      } else if (tableName === "daily_inventory") {
        setTableData(data.items?.map((i: any) => ({ food: i.name, ...i.inventory })) || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingTable(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Mentor Header */}
      <div className="console-hero rounded-[2rem] p-6 shadow-2xl sm:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="eyebrow inline-flex items-center gap-2 rounded-full bg-orange-500/15 border border-orange-500/30 px-3 py-1 text-[10px] font-bold text-orange-300">
              <Terminal className="h-3.5 w-3.5" />
              <span>Senior Full-Stack Architect & Mentor Console</span>
            </div>
            <h1 className="max-w-3xl text-3xl sm:text-5xl font-black tracking-tight text-white leading-[1.04]">
              See the system think.
            </h1>
            <p className="max-w-2xl text-sm sm:text-base text-slate-300 leading-relaxed">
              Explore the offline-first engineering decisions: row-level locking with PostgreSQL transactions,
              cryptographic token hashing, walk-in inventory partitioning, and zero-login student credentials.
            </p>
          </div>

          <button
            onClick={runDiagnostics}
            disabled={isRunningDiagnostics}
            className="primary-action flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black text-white active:scale-95 transition"
          >
            <RefreshCw className={`h-4 w-4 ${isRunningDiagnostics ? "animate-spin" : ""}`} />
            <span>Run All Phase Checks</span>
          </button>
        </div>

        {/* Sub Navigation */}
        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4 text-xs font-semibold">
          <button
            onClick={() => setActiveSubSection("diagnostics")}
            className={`rounded-xl px-3.5 py-1.5 transition ${
              activeSubSection === "diagnostics"
                ? "bg-orange-500 text-white font-bold shadow"
                : "console-tab text-slate-300 hover:text-white"
            }`}
          >
            Phase 1-9 Diagnostic Suite
          </button>
          <button
            onClick={() => setActiveSubSection("race")}
            className={`rounded-xl px-3.5 py-1.5 transition ${
              activeSubSection === "race"
                ? "bg-orange-500 text-white font-bold shadow"
                : "console-tab text-slate-300 hover:text-white"
            }`}
          >
            Race Condition Simulator (Stock = 1)
          </button>
          <button
            onClick={() => {
              setActiveSubSection("db");
              loadTableData("food_items");
            }}
            className={`rounded-xl px-3.5 py-1.5 transition ${
              activeSubSection === "db"
                ? "bg-orange-500 text-white font-bold shadow"
                : "console-tab text-slate-300 hover:text-white"
            }`}
          >
            Live Database Inspector
          </button>
          <button
            onClick={() => setActiveSubSection("terminal")}
            className={`rounded-xl px-3.5 py-1.5 transition ${
              activeSubSection === "terminal"
                ? "bg-orange-500 text-white font-bold shadow"
                : "console-tab text-slate-300 hover:text-white"
            }`}
          >
            Terminal Commands & Phase 1 Guide
          </button>
        </div>
      </div>

      {/* SECTION 1: Diagnostics */}
      {activeSubSection === "diagnostics" && (
        <div className="space-y-4">
          <div className="surface-panel rounded-3xl p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-white">Automated Architecture Verification</h3>
                <p className="text-xs text-slate-400">
                  Tests database connection pool, constraints, inventory boundaries, and token crypto
                </p>
              </div>
              {diagnostics && (
                <span
                  className={`rounded-full px-3 py-1 text-xs font-black ${
                    diagnostics.overallStatus === "ALL_SYSTEMS_OPERATIONAL"
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                      : "bg-red-500/20 text-red-400 border border-red-500/40"
                  }`}
                >
                  {diagnostics.overallStatus} ({diagnostics.passedChecks}/{diagnostics.totalChecks})
                </span>
              )}
            </div>

            <div className="mt-4 divide-y divide-slate-800/80">
              {diagnostics?.checks?.map((c: any, idx: number) => (
                <div key={idx} className="py-3.5 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-amber-400 font-bold">
                        {c.phase}
                      </span>
                      <h4 className="text-xs sm:text-sm font-bold text-white">{c.name}</h4>
                    </div>
                    <p className="text-xs text-slate-400">{c.message}</p>
                    {c.details && (
                      <pre className="mt-1 max-w-xl rounded-lg bg-slate-950 p-2 text-[10px] font-mono text-slate-300 overflow-x-auto">
                        {JSON.stringify(c.details, null, 2)}
                      </pre>
                    )}
                  </div>

                  <span
                    className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                      c.status === "PASSED"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                        : "bg-red-500/10 text-red-400 border border-red-500/30"
                    }`}
                  >
                    {c.status === "PASSED" ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5" />
                    )}
                    {c.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: Race Condition Simulation */}
      {activeSubSection === "race" && (
        <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-xl space-y-5">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-400 border border-amber-500/30 mb-2">
              <Zap className="h-3.5 w-3.5" />
              <span>Phase 3 — Concurrency & PostgreSQL Row Locks</span>
            </div>
            <h3 className="text-lg font-bold text-white">Simultaneous Two-Buyer Race Demonstration</h3>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              When only <strong>1 single puff</strong> remains in online stock, what happens if Customer A and
              Customer B hit checkout at the exact same millisecond? In simple JavaScript, both check stock &gt; 0, both
              succeed, causing stock = -1 (oversell). In Q-Pass, PostgreSQL transactions with{" "}
              <code className="font-mono text-amber-400 bg-slate-950 px-1 py-0.5 rounded">SELECT ... FOR UPDATE</code>{" "}
              guarantee absolute serializability.
            </p>
          </div>

          <button
            onClick={runRaceSimulation}
            disabled={isRunningRace}
            className="flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-3 text-xs font-black text-white hover:bg-orange-500 active:scale-95 disabled:opacity-50 transition shadow-xl shadow-orange-600/30"
          >
            <Play className={`h-4 w-4 ${isRunningRace ? "animate-spin" : ""}`} />
            <span>{isRunningRace ? "Simulating Concurrent Checkout..." : "Fire Concurrent Race Test"}</span>
          </button>

          {raceResult && (
            <div className="space-y-4 rounded-2xl bg-slate-950 p-5 border border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="font-bold text-sm text-white">{raceResult.testTitle}</span>
                <span className="rounded-full bg-emerald-500/20 text-emerald-400 px-3 py-0.5 text-xs font-bold border border-emerald-500/30">
                  Oversell Prevented: {raceResult.finalDatabaseState.oversellPrevented ? "YES" : "NO"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {raceResult.results.map((res: any, idx: number) => (
                  <div
                    key={idx}
                    className={`rounded-xl p-4 border ${
                      res.status === "SUCCESS"
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                        : "bg-red-500/10 border-red-500/30 text-red-300"
                    }`}
                  >
                    <div className="flex justify-between items-center font-bold text-xs">
                      <span>{res.buyer}</span>
                      <span className="font-mono">{res.status}</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-300">{res.message || res.error}</p>
                    <p className="mt-1 text-[10px] text-slate-400 font-mono">Time taken: {res.timeTakenMs} ms</p>
                  </div>
                ))}
              </div>

              <div className="rounded-xl bg-slate-900 p-3 text-xs text-slate-300 border border-slate-800">
                <span className="font-bold text-amber-400">PostgreSQL Final State Verification:</span>
                <div className="mt-1 font-mono text-[11px] grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>Online Stock: {raceResult.finalDatabaseState.onlineStock}</div>
                  <div>Sold Online: {raceResult.finalDatabaseState.soldOnline}</div>
                  <div>Active Held: {raceResult.finalDatabaseState.activeHeld}</div>
                  <div className="text-emerald-400 font-bold">
                    Remaining Available: {raceResult.finalDatabaseState.finalAvailableOnline} (NEVER -1)
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SECTION 3: Live Database Inspector */}
      {activeSubSection === "db" && (
        <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-bold text-white">PostgreSQL Live Table Inspector</h3>
              <p className="text-xs text-slate-400">Inspect real database rows populated in PostgreSQL via Drizzle</p>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-800 p-1 rounded-xl text-xs">
              {["food_items", "daily_inventory", "orders"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => loadTableData(tab)}
                  className={`rounded-lg px-3 py-1 font-semibold transition ${
                    selectedTable === tab ? "bg-orange-500 text-white font-bold" : "text-slate-400 hover:text-white"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950">
            {isLoadingTable ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading table data...</div>
            ) : tableData.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">No rows found in this table.</div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 bg-slate-900/80 text-slate-400">
                  <tr>
                    {Object.keys(tableData[0] || {}).map((col) => (
                      <th key={col} className="p-3 font-semibold font-mono text-[11px]">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px] text-slate-300">
                  {tableData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/50">
                      {Object.values(row).map((val: any, colIdx) => (
                        <td key={colIdx} className="p-3 whitespace-nowrap">
                          {typeof val === "object" ? JSON.stringify(val).slice(0, 30) : String(val)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* SECTION 4: Terminal Commands & Mentor Guide */}
      {activeSubSection === "terminal" && (
        <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-xl space-y-6">
          <div>
            <h3 className="text-base font-bold text-white">Ubuntu Terminal Commands & Architecture Blueprint</h3>
            <p className="text-xs text-slate-400 mt-1">
              Step-by-step terminal commands to reproduce or inspect the local backend foundation.
            </p>
          </div>

          {/* Verification Commands */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
              1. Environment Verification Commands
            </h4>
            <div className="rounded-xl bg-slate-950 p-3 font-mono text-xs text-emerald-400 border border-slate-800">
              <p>node --version # Verifies Node.js runtime (v20+)</p>
              <p>npm --version # Verifies npm package manager</p>
              <p>psql --version # Verifies PostgreSQL client (v15+)</p>
            </div>
          </div>

          {/* Database Setup */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
              2. PostgreSQL Database Creation & Tables
            </h4>
            <div className="rounded-xl bg-slate-950 p-3 font-mono text-xs text-slate-300 border border-slate-800 space-y-1">
              <p className="text-slate-500"># Connect to local PostgreSQL</p>
              <p className="text-emerald-400">psql postgresql://postgres:postgres@127.0.0.1:5432/app_db</p>
              <p className="text-slate-500 mt-2"># Push schema cleanly without manual migration drift</p>
              <p className="text-emerald-400">npx drizzle-kit push</p>
              <p className="text-slate-500 mt-2"># Inspect created entities</p>
              <p className="text-emerald-400">\dt</p>
            </div>
          </div>

          {/* Health Endpoint Test */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
              3. Verification of Backend Health Endpoint
            </h4>
            <div className="rounded-xl bg-slate-950 p-3 font-mono text-xs text-slate-300 border border-slate-800">
              <p className="text-emerald-400">curl -s http://localhost:3000/api/health | jq</p>
            </div>
          </div>

          {/* Architecture Concept Matrix */}
          <div className="rounded-2xl bg-slate-950/80 p-4 border border-slate-800 text-xs text-slate-300 space-y-2">
            <h4 className="font-bold text-white">Why These Architectural Decisions?</h4>
            <ul className="list-disc pl-4 space-y-1 text-slate-400">
              <li>
                <strong className="text-slate-200">Zero-Login:</strong> College students should not be stuck entering
                passwords or waiting for SMS OTPs when pre-ordering between lectures. The secure order token represents
                their credential.
              </li>
              <li>
                <strong className="text-slate-200">Token Hashing (SHA-256):</strong> Storing raw QR tokens in the
                database is like storing plain text passwords. We only store the SHA-256 hash. When staff scans, the
                server computes the hash and validates atomically.
              </li>
              <li>
                <strong className="text-slate-200">10-Minute Hold & Row Locks:</strong> Prevents overselling during
                canteen rush hours. The database transaction holds a row lock on <code className="text-amber-400">daily_inventory</code>{" "}
                until either checkout completes or the 10-minute timer expires.
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
