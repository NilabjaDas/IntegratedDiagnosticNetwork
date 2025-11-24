const cron = require("node-cron");
const moment = require("moment-timezone");
const { generateAndSendReports } = require("./handlers/reportGenerator");

const configurationDetailsSchema = require("./models/ConfigurationDetails");
const { getConnection } = require("./handlers/dbConnection");
const { computeAutomation } = require("./routes/configuration");
const { computeOccupancyForHotel,generateAndUpdateOccupancyStats, addTimelyReportsForToday, computeOccupancyAllBrands, generateAndUpdateOccupancyStatsAllBrands } = require("./routes/webhook");

const isDev = process.env.NODE_ENV === "development";
const isPrimaryInstance = !process.env.NODE_APP_INSTANCE || process.env.NODE_APP_INSTANCE === "0";

function scheduleJob({ timeStr, intervalMinutes, jobFn }) {
  if (process.env.NODE_APP_INSTANCE && process.env.NODE_APP_INSTANCE !== "0") {
    console.log(
      `Skipping scheduling on instance ${process.env.NODE_APP_INSTANCE}`
    );
    return;
  }

  // Build cron expression
  const cronExpression = intervalMinutes
    ? `*/${intervalMinutes} * * * *`
    : (() => {
        const [hourStr, minuteStr] = timeStr.split(":");
        return `${parseInt(minuteStr, 10)} ${parseInt(hourStr, 10)} * * *`;
      })();

  console.log(
    `Scheduling job${
      intervalMinutes ? ` every ${intervalMinutes}min` : ` at ${timeStr}`
    } (cron "${cronExpression}")`
  );

  // ← only one schedule call
  const task = cron.schedule(cronExpression, async () => {
    const now = moment().tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm:ss");
    console.log(`\n🕒 [${now}] running job…`);
    try {
      await jobFn();
      console.log("✅ Job completed successfully.");
    } catch (err) {
      console.error("❌ Job failed:", err);
    }
  });

  return task;
}

// --- MIS jobs (unchanged) ---
// scheduleJob({ timeStr: '09:00', jobFn: generateAndSendReports, dayOffset: -1 });
// scheduleJob({ timeStr: '11:00', jobFn: generateAndSendReports });
// scheduleJob({ timeStr: '14:00', jobFn: generateAndSendReports });
// scheduleJob({ timeStr: '18:00', jobFn: generateAndSendReports });
// scheduleJob({ timeStr: '21:00', jobFn: generateAndSendReports });



// only schedule the cron in non-dev
if (!isDev) {
  scheduleJob({ intervalMinutes: 30, jobFn: addTimelyReportsForToday });
  scheduleJob({ intervalMinutes: 30, jobFn: computeOccupancyAllBrands });

  // run once daily at midnight (00:00)
  // scheduleJob({ timeStr: "00:00", jobFn: computeOccupancyAllBrands });

  // run once daily at midnight (00:10)
  // scheduleJob({ timeStr: "00:10", jobFn: generateAndUpdateOccupancyStatsAllBrands });
} else {
  console.log("📌 Running in dev - Scheduling skipped");
}




async function initEzeeWebhookWatcher({ onChange, log = false } = {}) {
  const conn = getConnection();
  if (!conn) throw new Error("No DB connection");

  const brandDb = conn.useDb("BRAND-LIST-DATA", { useCache: true });
  const collection = brandDb.collection("ezee_webhook_datas");

  // 1) prime cache: _id -> { brand, hotelCode, openBookingsLength }
  const idCache = new Map();
  try {
    const docs = await collection
      .find({}, { projection: { brand: 1, hotelCode: 1, openBookings: 1 } })
      .toArray();
    docs.forEach((d) => {
      if (!d || !d._id) return;
      idCache.set(String(d._id), {
        brand: d.brand ?? null,
        hotelCode: d.hotelCode ?? null,
        openBookingsLength: Array.isArray(d.openBookings) ? d.openBookings.length : 0,
      });
    });
    if (log) console.log(`EzeeWatcher: primed cache for ${idCache.size} docs`);
  } catch (err) {
    console.warn("EzeeWatcher: failed to prime cache:", err);
  }

  // helper: determine whether update fields are relevant
  const relevantOpenBookingFieldRegex = /^openBookings(?:\.\d+)?\.(CurrentStatus|RoomName|End)$/i;

  const pipeline = [
    {
      $match: {
        operationType: { $in: ["insert", "update", "replace", "delete"] },
      },
    },
  ];

  const changeStream = collection.watch(pipeline, { fullDocument: "updateLookup" });

  changeStream.on("change", async (change) => {
    try {
      const op = change.operationType;
      const docId = change.documentKey?._id;
      const idStr = docId ? String(docId) : null;

      const emit = (payload) => {
        try {
          if (typeof onChange === "function") onChange(payload);
        } catch (cbErr) {
          console.error("EzeeWatcher: onChange callback threw:", cbErr);
        }
      };

      if (op === "insert" || op === "replace") {
        const doc = change.fullDocument || {};
        const brand = doc.brand ?? null;
        const hotelCode = doc.hotelCode ?? null;
        const openBookingsLength = Array.isArray(doc.openBookings) ? doc.openBookings.length : 0;

        if (idStr) idCache.set(idStr, { brand, hotelCode, openBookingsLength });

        if (log) console.log(`EzeeWatcher: ${op} id=${idStr} brand=${brand} hotelCode=${hotelCode} openBookings=${openBookingsLength}`);

        emit({ op, id: idStr, brand, hotelCode, fullDocument: doc });

        // new/replace -> recompute
        if (brand && hotelCode) {
          try {
            await computeOccupancyForHotel(brand, hotelCode);
            await generateAndUpdateOccupancyStats(brand, hotelCode);
            await computeAutomation(brand);
          } catch (err) {
            console.error(`EzeeWatcher: failed for ${brand}/${hotelCode}:`, err);
          }
        }
        return;
      }

      if (op === "update") {
        const updatedFields = change.updateDescription?.updatedFields ?? {};
        const removedFields = change.updateDescription?.removedFields ?? [];
        const doc = change.fullDocument || {};

        const brand = doc.brand ?? (idCache.get(idStr)?.brand ?? null);
        const hotelCode = doc.hotelCode ?? (idCache.get(idStr)?.hotelCode ?? null);

        // refresh cache brand/hotelCode if present
        if (idStr) {
          const prev = idCache.get(idStr) ?? {};
          const newLen = Array.isArray(doc.openBookings) ? doc.openBookings.length : (prev.openBookingsLength || 0);
          idCache.set(idStr, { brand, hotelCode, openBookingsLength: newLen });
        }

        // Determine whether to trigger:
        let shouldTrigger = false;

        // 1) brand or hotelCode changed explicitly in updatedFields
        if ("brand" in updatedFields || "hotelCode" in updatedFields) {
          shouldTrigger = true;
          if (log) console.log(`EzeeWatcher: brand/hotelCode changed for id=${idStr}`);
        }

        // 2) whole openBookings replaced or set
        if (!shouldTrigger && Object.keys(updatedFields).some((k) => k === "openBookings")) {
          shouldTrigger = true;
          if (log) console.log(`EzeeWatcher: openBookings replaced for id=${idStr}`);
        }

        // 3) any updatedField targets relevant booking sub-fields
        if (!shouldTrigger) {
          for (const k of Object.keys(updatedFields)) {
            if (relevantOpenBookingFieldRegex.test(k)) {
              shouldTrigger = true;
              if (log) console.log(`EzeeWatcher: relevant field updated (${k}) for id=${idStr}`);
              break;
            }
          }
        }

        // 4) removedFields might include openBookings or entries -> trigger
        if (!shouldTrigger && Array.isArray(removedFields) && removedFields.some((rf) => rf === "openBookings" || /^openBookings(?:\.\d+)?$/.test(rf))) {
          shouldTrigger = true;
          if (log) console.log(`EzeeWatcher: removedFields indicates openBookings removal for id=${idStr}`);
        }

        // 5) length change detection (fallback) — compare cache length and fullDocument length
        if (!shouldTrigger) {
          const prevLen = idCache.get(idStr)?.openBookingsLength ?? null;
          const newLen = Array.isArray(doc.openBookings) ? doc.openBookings.length : null;
          if (prevLen != null && newLen != null && prevLen !== newLen) {
            shouldTrigger = true;
            if (log) console.log(`EzeeWatcher: openBookings length changed for id=${idStr} ${prevLen} -> ${newLen}`);
          }
          // update cache length
          if (idStr && newLen != null) {
            const prev = idCache.get(idStr) || {};
            idCache.set(idStr, { brand: prev.brand ?? brand, hotelCode: prev.hotelCode ?? hotelCode, openBookingsLength: newLen });
          }
        }

        if (log) {
          const keys = Object.keys(updatedFields).join(",") || "none";
          console.log(`EzeeWatcher: update id=${idStr} brand=${brand} hotelCode=${hotelCode} updatedFields=${keys} shouldTrigger=${shouldTrigger}`);
        }

        emit({ op, id: idStr, brand, hotelCode, updatedFields, fullDocument: doc });

        if (shouldTrigger && brand && hotelCode) {
          try {
            await computeOccupancyForHotel(brand, hotelCode);
            await generateAndUpdateOccupancyStats(brand, hotelCode);
            await computeAutomation(brand);
          } catch (err) {
            console.error(`EzeeWatcher: failed for ${brand}/${hotelCode}:`, err);
          }
        } 
        else {
          if (log) console.log(`EzeeWatcher: skipped compute for id=${idStr} (irrelevant update)`);
        }
        return;
      }

      if (op === "delete") {
        const cached = idStr ? idCache.get(idStr) : null;
        const brand = cached?.brand ?? null;
        const hotelCode = cached?.hotelCode ?? null;

        if (idStr) idCache.delete(idStr);

        if (log) console.log(`EzeeWatcher: delete id=${idStr} brand=${brand} hotelCode=${hotelCode}`);
        emit({ op, id: idStr, brand, hotelCode, updatedFields: null, fullDocument: null });

        // handle cleanup if required
        // e.g. cancel scheduled jobs, clear occupancy cache, etc.
        return;
      }

      // fallback
      if (log) console.log("EzeeWatcher: other change", change);
      emit({ op: change.operationType, id: idStr, brand: null, hotelCode: null, fullDocument: change.fullDocument ?? null });
    } catch (err) {
      console.error("EzeeWatcher: error handling change:", err);
    }
  });

  changeStream.on("error", (err) => {
    console.error("EzeeWatcher: changeStream error:", err);
  });

  changeStream.on("close", () => {
    if (log) console.warn("EzeeWatcher: changeStream closed");
  });

  changeStream.on("end", () => {
    if (log) console.warn("EzeeWatcher: changeStream ended");
  });

  console.log("✅ EzeeWatcher: Watching eZee Webhook Data for changes");
  return {
    close: async () => {
      try {
        await changeStream.close();
        if (log) console.log("EzeeWatcher: closed changeStream");
      } catch (err) {
        console.error("EzeeWatcher: error closing stream:", err);
      }
    },
    getCache: () => new Map(idCache),
    stream: changeStream,
  };
  
}



if (!isDev) {
  initEzeeWebhookWatcher().catch((error) => {console.error("Error in eZee Webhook watcher", error)});
} else {

  console.log("📌 Dev mode: All schedulers skipped");
}

if (!isDev && !isPrimaryInstance) {
  console.log(`Scheduler skipped on instance ${process.env.NODE_APP_INSTANCE}`);
  module.exports = { scheduleJob: () => { /* noop */ } };
  return;
}