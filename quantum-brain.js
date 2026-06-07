/* 
  Rolling Wrench AI V9.4
  Quantum Brain Self-Healing Repair Core
  Drop-in browser module for the PWA/app.

  What it does:
  - Checks required storage buckets
  - Repairs missing/bad JSON storage
  - Updates service worker when available
  - Clears old repair flags
  - Creates a repair report
  - Supports quote asset fields where VIN/truck is optional
*/

(function () {
  const RWQB_VERSION = "9.4.0";
  const REQUIRED_BUCKETS = [
    "rw_customers",
    "rw_quotes",
    "rw_invoices",
    "rw_trucks",
    "rw_assets",
    "rw_jobs",
    "rw_time_clock",
    "rw_schedule",
    "rw_parts_searches",
    "rw_repair_reports",
    "rw_ai_conversations"
  ];

  const ASSET_TYPES = [
    "Semi Truck",
    "Trailer",
    "Pickup",
    "Farm Equipment",
    "Heavy Equipment",
    "Construction Equipment",
    "Forklift",
    "Generator",
    "Hydraulic Unit",
    "APU",
    "Other"
  ];

  function nowStamp() {
    return new Date().toISOString();
  }

  function safeParseJSON(value, fallback) {
    try {
      if (value === null || value === undefined || value === "") return fallback;
      return JSON.parse(value);
    } catch (err) {
      return fallback;
    }
  }

  function readBucket(key) {
    return safeParseJSON(localStorage.getItem(key), []);
  }

  function writeBucket(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function logRepair(message, level = "info") {
    const entry = {
      time: nowStamp(),
      level,
      message
    };
    const log = readBucket("rw_quantum_log");
    log.push(entry);
    writeBucket("rw_quantum_log", log.slice(-500));
    return entry;
  }

  function backupLocalStorage() {
    const backup = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      backup[key] = localStorage.getItem(key);
    }
    const backups = readBucket("rw_quantum_backups");
    backups.push({
      time: nowStamp(),
      appVersion: RWQB_VERSION,
      storage: backup
    });
    writeBucket("rw_quantum_backups", backups.slice(-10));
    logRepair("Created local storage backup before repair.");
  }

  function repairStorageBuckets(report) {
    REQUIRED_BUCKETS.forEach((key) => {
      const raw = localStorage.getItem(key);
      if (raw === null) {
        writeBucket(key, []);
        report.repairs.push(`Created missing storage bucket: ${key}`);
        return;
      }
      try {
        JSON.parse(raw);
      } catch (err) {
        localStorage.setItem(`${key}_corrupt_${Date.now()}`, raw);
        writeBucket(key, []);
        report.repairs.push(`Repaired corrupt JSON storage bucket: ${key}`);
      }
    });
  }

  function normalizeQuote(quote) {
    const q = quote && typeof quote === "object" ? quote : {};
    q.assetType = q.assetType || q.vehicleType || q.truckType || "Other";
    q.assetDescription =
      q.assetDescription ||
      q.truckDescription ||
      q.vehicleDescription ||
      q.equipmentDescription ||
      q.unitDescription ||
      "";
    q.vin = q.vin || q.VIN || "";
    q.serialNumber = q.serialNumber || q.serial || "";
    q.unitNumber = q.unitNumber || q.unit || "";
    q.make = q.make || "";
    q.model = q.model || "";
    q.engine = q.engine || "";
    q.repairDescription = q.repairDescription || q.description || q.workRequested || "";
    return q;
  }

  function repairQuotes(report) {
    const quotes = readBucket("rw_quotes");
    if (!Array.isArray(quotes)) {
      writeBucket("rw_quotes", []);
      report.repairs.push("Reset bad quotes bucket to empty list.");
      return;
    }
    const fixed = quotes.map(normalizeQuote);
    writeBucket("rw_quotes", fixed);
    report.repairs.push("Normalized quote records with optional VIN/truck asset fields.");
  }

  async function repairServiceWorker(report) {
    if (!("serviceWorker" in navigator)) {
      report.warnings.push("Service worker not supported in this browser.");
      return;
    }
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) {
        await reg.update();
      }
      report.repairs.push(`Updated ${regs.length} service worker registration(s).`);
    } catch (err) {
      report.errors.push(`Service worker repair failed: ${err.message}`);
    }
  }

  function buildCustomerQuoteMessage(quote) {
    const q = normalizeQuote(quote || {});
    const money = (value) => {
      const n = Number(String(value || 0).replace(/[^0-9.-]/g, ""));
      return Number.isFinite(n) ? n.toFixed(2) : "0.00";
    };

    const lines = [
      "Rolling Wrench Diesel",
      "",
      "Quote Ready",
      "",
      `Customer: ${q.customerName || q.customer || ""}`,
      `Asset Type: ${q.assetType || "Other"}`,
      `Asset: ${q.assetDescription || "Not listed"}`
    ];

    if (q.vin) lines.push(`VIN: ${q.vin}`);
    if (q.serialNumber) lines.push(`Serial: ${q.serialNumber}`);
    if (q.unitNumber) lines.push(`Unit: ${q.unitNumber}`);
    if (q.make || q.model) lines.push(`Make/Model: ${[q.make, q.model].filter(Boolean).join(" ")}`);
    if (q.engine) lines.push(`Engine: ${q.engine}`);

    lines.push(
      "",
      "Repair / Work Requested:",
      q.repairDescription || "Not listed",
      "",
      `Labor: $${money(q.laborTotal)}`,
      `Parts: $${money(q.partsTotal)}`,
      `Fees: $${money(q.feesTotal)}`,
      `Tax: $${money(q.taxTotal)}`,
      "",
      `Estimated Total: $${money(q.total || q.estimatedTotal)}`,
      "",
      "Review / Approve:",
      q.approvalLink || q.link || "",
      "",
      "Prices may change if additional work, parts, time, damage, or hidden issues are found."
    );

    return lines.join("\n");
  }

  async function quantumSelfRepair() {
    const report = {
      app: "Rolling Wrench AI",
      module: "Quantum Brain Self-Healing Repair Core",
      version: RWQB_VERSION,
      time: nowStamp(),
      repairs: [],
      warnings: [],
      errors: []
    };

    try {
      backupLocalStorage();
      repairStorageBuckets(report);
      repairQuotes(report);
      await repairServiceWorker(report);
      localStorage.setItem("rw_quantum_last_scan", report.time);
      const reports = readBucket("rw_repair_reports");
      reports.push(report);
      writeBucket("rw_repair_reports", reports.slice(-100));
      logRepair("Quantum self-repair completed.");
    } catch (err) {
      report.errors.push(err.message);
      logRepair(`Quantum self-repair failed: ${err.message}`, "error");
    }

    return report;
  }

  function clearIphonePwaCacheFlag() {
    localStorage.setItem("rw_force_cache_refresh", String(Date.now()));
    logRepair("Set cache refresh flag for iPhone PWA.");
    return true;
  }

  window.RollingWrenchQuantumBrain = {
    version: RWQB_VERSION,
    assetTypes: ASSET_TYPES,
    quantumSelfRepair,
    buildCustomerQuoteMessage,
    clearIphonePwaCacheFlag,
    readLog: () => readBucket("rw_quantum_log"),
    readReports: () => readBucket("rw_repair_reports")
  };
})();
