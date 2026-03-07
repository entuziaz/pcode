"use strict";

const fs = require("fs");
const path = require("path");

const DATASET_FILE = path.join(__dirname, "..", "data", "canonical-addresses.lagos.json");

let cached = null;

function normalizeQuery(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[.'`,]/g, " ")
    .replace(/\b(chief|alhaji|alh\.?|dr|prof|prince|mrs|mr|hon|senator|admiral)\b/g, " ")
    .replace(/\b(street|st\.)\b/g, " st ")
    .replace(/\b(road|rd\.)\b/g, " rd ")
    .replace(/\b(avenue|ave\.)\b/g, " ave ")
    .replace(/[^a-z0-9\s/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function loadDataset() {
  if (cached) return cached;

  if (!fs.existsSync(DATASET_FILE)) {
    throw new Error(`Dataset missing at ${DATASET_FILE}. Run: npm run build:dataset`);
  }

  const raw = fs.readFileSync(DATASET_FILE, "utf8");
  cached = JSON.parse(raw);
  return cached;
}

function searchRecords(query, limit = 20) {
  const dataset = loadDataset();
  const normalizedQuery = normalizeQuery(query);

  if (!normalizedQuery) {
    return [];
  }

  const ranked = [];
  for (const record of dataset.records) {
    const hayStreet = record.streetNormalized || "";
    const hayArea = normalizeQuery(record.area);
    const hayLga = normalizeQuery(record.lga);

    let score = 0;
    if (hayStreet === normalizedQuery) score += 120;
    if (hayStreet.startsWith(normalizedQuery)) score += 80;
    if (hayStreet.includes(normalizedQuery)) score += 60;
    if (hayArea.includes(normalizedQuery)) score += 25;
    if (hayLga.includes(normalizedQuery)) score += 20;

    if (record.searchTokens && record.searchTokens.includes(normalizedQuery)) score += 35;

    if (score > 0) {
      ranked.push({ score, record });
    }
  }

  ranked.sort((a, b) => b.score - a.score || a.record.street.localeCompare(b.record.street));

  return ranked.slice(0, limit).map((entry) => entry.record);
}

function streetsByPostcode(postcodeInput) {
  const dataset = loadDataset();
  const digits = String(postcodeInput || "").replace(/\D/g, "");

  if (![3, 6].includes(digits.length)) {
    return {
      postcode: digits,
      mode: "invalid",
      streets: []
    };
  }

  const prefix = digits.length === 6 ? digits.slice(0, 3) : digits;
  const exact = digits.length === 6 ? digits : null;

  const matches = dataset.records.filter((record) => {
    if (exact && record.postcode === exact) return true;
    return record.postcodePrefix === prefix;
  });

  const seen = new Set();
  const streets = [];
  for (const row of matches) {
    const key = `${row.streetNormalized}|${row.lga}|${row.area}`;
    if (seen.has(key)) continue;
    seen.add(key);
    streets.push({
      street: row.street,
      postcode: row.postcode,
      postcodePrefix: row.postcodePrefix,
      area: row.area,
      lga: row.lga,
      state: row.state,
      geo: row.geo
    });
  }

  return {
    postcode: digits,
    mode: exact ? "exact_or_prefix_fallback" : "prefix",
    streets: streets.sort((a, b) => a.street.localeCompare(b.street))
  };
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function reverseGeocodeGuess(lat, lng) {
  const dataset = loadDataset();
  const withGeo = dataset.records.filter((record) => record.geo && Number.isFinite(record.geo.lat) && Number.isFinite(record.geo.lng));

  if (withGeo.length === 0) {
    return null;
  }

  let best = null;
  for (const row of withGeo) {
    const distanceKm = haversineKm(lat, lng, row.geo.lat, row.geo.lng);
    if (!best || distanceKm < best.distanceKm) {
      best = { row, distanceKm };
    }
  }

  if (!best) return null;

  const confidence = best.distanceKm < 2 ? "high" : best.distanceKm < 8 ? "medium" : "low";

  return {
    input: { lat, lng },
    guess: {
      street: best.row.street,
      postcode: best.row.postcode,
      postcodePrefix: best.row.postcodePrefix,
      area: best.row.area,
      lga: best.row.lga,
      state: best.row.state,
      geo: best.row.geo,
      distanceKm: Number(best.distanceKm.toFixed(3)),
      confidence,
      note: "MVP guess based on nearest LGA centroid-backed record."
    }
  };
}

module.exports = {
  loadDataset,
  normalizeQuery,
  searchRecords,
  streetsByPostcode,
  reverseGeocodeGuess
};
