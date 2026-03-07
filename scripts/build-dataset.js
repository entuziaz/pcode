#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const DEFAULT_SOURCE_DIR = path.join(__dirname, "..", "data", "raw", "LASG");
const SOURCE_DIR = process.env.LASG_SOURCE_DIR || DEFAULT_SOURCE_DIR;
const OUTPUT_FILE = path.join(__dirname, "..", "data", "canonical-addresses.lagos.json");

const LGA_POSTCODE_PREFIX = {
  Agege: "100",
  Alimosho: "100",
  "Ajeromi-Ifelodun": "102",
  "Amuwo-Odofin": "102",
  Apapa: "102",
  Badagry: "103",
  Epe: "106",
  "Eti-Osa": "101",
  "Ibeju-Lekki": "105",
  "Ifako-Ijaye": "100",
  Ikeja: "100",
  Ikorodu: "104",
  Kosofe: "100",
  "Lagos Island": "101",
  "Lagos Mainland": "101",
  Mushin: "100",
  Ojo: "102",
  "Oshodi-Isolo": "100",
  Somolu: "100",
  Surulere: "101"
};

const LGA_CENTROIDS = {
  Agege: { lat: 6.6188, lng: 3.3219 },
  Alimosho: { lat: 6.6097, lng: 3.2958 },
  "Ajeromi-Ifelodun": { lat: 6.4499, lng: 3.3425 },
  "Amuwo-Odofin": { lat: 6.4478, lng: 3.2896 },
  Apapa: { lat: 6.4488, lng: 3.3591 },
  Badagry: { lat: 6.4200, lng: 2.8899 },
  Epe: { lat: 6.5841, lng: 3.9836 },
  "Eti-Osa": { lat: 6.4416, lng: 3.5342 },
  "Ibeju-Lekki": { lat: 6.4689, lng: 3.8142 },
  "Ifako-Ijaye": { lat: 6.6697, lng: 3.2947 },
  Ikeja: { lat: 6.6018, lng: 3.3515 },
  Ikorodu: { lat: 6.6194, lng: 3.5105 },
  Kosofe: { lat: 6.5774, lng: 3.3792 },
  "Lagos Island": { lat: 6.4549, lng: 3.4246 },
  "Lagos Mainland": { lat: 6.5244, lng: 3.3792 },
  Mushin: { lat: 6.5276, lng: 3.3541 },
  Ojo: { lat: 6.4639, lng: 3.1898 },
  "Oshodi-Isolo": { lat: 6.5577, lng: 3.3302 },
  Somolu: { lat: 6.5383, lng: 3.3778 },
  Surulere: { lat: 6.4966, lng: 3.3539 }
};

const LGA_NAME_ALIASES = {
  "ajeromi ifelodun": "Ajeromi-Ifelodun",
  "ajeromi-ifelodun": "Ajeromi-Ifelodun",
  "amuwo odofin": "Amuwo-Odofin",
  "amuwo-odofin": "Amuwo-Odofin",
  "eti osa": "Eti-Osa",
  "eti-osa": "Eti-Osa",
  "ibeju lekki": "Ibeju-Lekki",
  "ibeju-lekki": "Ibeju-Lekki",
  "ifako ijaye": "Ifako-Ijaye",
  "ifako-ijaye": "Ifako-Ijaye",
  "lagos island": "Lagos Island",
  "lagos mainland": "Lagos Mainland",
  "oshodi isolo": "Oshodi-Isolo",
  "oshodi-isolo": "Oshodi-Isolo",
  shomolu: "Somolu",
  somolu: "Somolu"
};

const STREET_HINT = /\b(street|st\.?|road|rd\.?|avenue|ave\.?|close|crescent|way|lane|drive|court|place|express\s*way|expressway|boulevard|highway|groove|grove|estate)\b/i;
const STOP_WORDS = new Set([
  "and", "or", "the", "of", "at", "in", "on", "by", "for", "to", "from", "near", "opp", "opposite", "front", "behind", "beside", "block", "house", "no", "space", "open", "junction", "ward", "school", "estate", "phase", "gate", "inside", "outside", "within"
]);

function toTitleCase(value) {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeSpaces(value) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeStreet(value) {
  return normalizeSpaces(
    value
      .toLowerCase()
      .replace(/[.'`,]/g, " ")
      .replace(/\b(chief|alhaji|alh\.?|dr|prof|prince|mrs|mr|hon|senator|admiral)\b/g, " ")
      .replace(/\b(street|st\.)\b/g, " st ")
      .replace(/\b(road|rd\.)\b/g, " rd ")
      .replace(/\b(avenue|ave\.)\b/g, " ave ")
      .replace(/[^a-z0-9\s/-]/g, " ")
  );
}

function tokenizeSearch(value) {
  const words = normalizeStreet(value)
    .split(/[\s/-]+/)
    .map((word) => word.trim())
    .filter((word) => word && !STOP_WORDS.has(word) && word.length > 1);

  return Array.from(new Set(words));
}

function cleanLocationLine(rawLine) {
  return normalizeSpaces(
    rawLine
      .replace(/\b(i{1,3}|iv|v)\b\.?$/i, "")
      .replace(/\s+-\s*(i{1,3}|iv|v)$/i, "")
      .replace(/\b(no\.?|house no\.?)\s*\d+\b/gi, "")
      .replace(/\b(in front of|front of|behind|beside|within|outside|open space at|open space in front of|open space|along|booth in front of|booth at)\b/gi, "")
      .replace(/\b(pry\.?\s*school|grammar school|school|mosque|church|estate)\b/gi, "")
      .replace(/^[^a-z0-9]*\d+\s*,?\s*/i, "")
      .replace(/^no\.?\s*\d+\s*/i, "")
      .replace(/^[^a-z0-9]+/i, "")
      .replace(/\s+/g, " ")
      .replace(/^[-,:\s]+|[-,:\s]+$/g, "")
  );
}

function splitJunctions(line) {
  const normalized = line.replace(/\s+/g, " ").trim();
  const withMarker = normalized.replace(/^junction of\s+/i, "");
  const parts = withMarker.split(/[\/&]|\band\b/gi).map((part) => cleanLocationLine(part));
  return parts.filter(Boolean);
}

function maybeStreetCandidate(value) {
  if (!value) return false;
  if (value.length < 3) return false;
  if (/^\(?\s*(odd|even)\s+no?s?\.?\s*\)?$/i.test(value)) return false;
  if (!/[a-z]/i.test(value)) return false;
  if (/\b(lga|ward)\b/i.test(value)) return false;
  const tokens = value.split(/\s+/).filter(Boolean);
  const meaningfulTokens = tokens.filter((token) => !STOP_WORDS.has(token.toLowerCase()) && token.length > 1);
  return STREET_HINT.test(value) || /\b(st|rd|ave)\b/i.test(value) || meaningfulTokens.length >= 2;
}

function extractStreetCandidates(rawLine) {
  const line = normalizeSpaces(rawLine);
  if (!line) return [];

  let candidates = [];
  if (/junction/i.test(line) || line.includes("/")) {
    candidates = splitJunctions(line);
  } else {
    candidates = [cleanLocationLine(line)];
  }

  return candidates
    .map((candidate) => candidate.replace(/\b(st\.)\b/gi, "Street"))
    .map((candidate) => candidate.replace(/\b(rd\.)\b/gi, "Road"))
    .map((candidate) => toTitleCase(candidate))
    .filter(maybeStreetCandidate)
    .filter((candidate) => candidate.length <= 80);
}

function parseLgaName(headerLine, fileName) {
  const candidate = normalizeSpaces(headerLine || "")
    .replace(/\s*lga\s*$/i, "")
    .trim() || normalizeSpaces(
    fileName
      .replace(/\.txt$/i, "")
      .replace(/\s*lga$/i, "")
      .trim()
  );

  const aliasKey = candidate.toLowerCase().replace(/\s+/g, " ");
  return LGA_NAME_ALIASES[aliasKey] || toTitleCase(candidate.replace(/\s+/g, " "));
}

function isWardHeader(line) {
  return /\bward\b/i.test(line) && line.length <= 90;
}

function normalizeWard(line) {
  return toTitleCase(normalizeSpaces(line.replace(/\bward\b/gi, "")).replace(/\/+/g, " / "));
}

function buildDataset() {
  const files = fs
    .readdirSync(SOURCE_DIR)
    .filter((fileName) => fileName.toLowerCase().endsWith(".txt"));

  const rows = [];
  const warnings = [];

  for (const fileName of files) {
    const filePath = path.join(SOURCE_DIR, fileName);
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      warnings.push(`Skipped empty file: ${fileName}`);
      continue;
    }

    const lga = parseLgaName(lines[0], fileName);
    let currentWard = "Unknown";

    const postcodePrefix = LGA_POSTCODE_PREFIX[lga] || null;
    const centroid = LGA_CENTROIDS[lga] || null;

    if (!postcodePrefix) {
      warnings.push(`No postcode prefix mapping for LGA: ${lga}`);
    }
    if (!centroid) {
      warnings.push(`No centroid mapping for LGA: ${lga}`);
    }

    for (const rawLine of lines.slice(1)) {
      if (isWardHeader(rawLine)) {
        currentWard = normalizeWard(rawLine) || currentWard;
        continue;
      }

      const streets = extractStreetCandidates(rawLine);
      if (streets.length === 0) {
        continue;
      }

      for (const street of streets) {
        const streetNormalized = normalizeStreet(street);
        const searchTokens = tokenizeSearch(`${street} ${currentWard} ${lga}`);

        rows.push({
          street,
          streetNormalized,
          postcode: null,
          postcodePrefix,
          area: currentWard,
          lga,
          state: "Lagos",
          geo: centroid
            ? {
                lat: centroid.lat,
                lng: centroid.lng,
                source: "lga_centroid",
                precisionMeters: 3000
              }
            : null,
          searchTokens,
          source: {
            file: fileName,
            raw: rawLine
          }
        });
      }
    }
  }

  const dedupe = new Map();
  for (const row of rows) {
    const key = `${row.streetNormalized}|${row.lga}|${row.area}|${row.postcodePrefix || "na"}`;
    if (!dedupe.has(key)) {
      dedupe.set(key, row);
    }
  }

  const records = Array.from(dedupe.values()).sort((a, b) => {
    if (a.lga !== b.lga) return a.lga.localeCompare(b.lga);
    if (a.area !== b.area) return a.area.localeCompare(b.area);
    return a.street.localeCompare(b.street);
  });

  return {
    metadata: {
      generatedAt: new Date().toISOString(),
      sourceDir: path.relative(path.join(__dirname, ".."), SOURCE_DIR) || ".",
      state: "Lagos",
      recordCount: records.length,
      lgaCount: Array.from(new Set(records.map((r) => r.lga))).length,
      warnings
    },
    records
  };
}

function main() {
  const dataset = buildDataset();
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(dataset, null, 2));
  console.log(`Wrote ${dataset.metadata.recordCount} records to ${OUTPUT_FILE}`);
  if (dataset.metadata.warnings.length > 0) {
    console.log("Warnings:");
    dataset.metadata.warnings.forEach((warning) => console.log(`- ${warning}`));
  }
}

if (require.main === module) {
  main();
}
