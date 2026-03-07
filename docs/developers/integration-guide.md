# Integration Guide

This guide shows how to integrate pCode API into ecommerce checkout or address forms.

## Recommended User Flow

1. User types street/area text in your UI.
2. Call `GET /search` to show suggestions.
3. User selects a suggestion.
4. Auto-fill `postcode`, `area`, `lga`, `state`.
5. Optionally allow `Use my location` -> call `POST /reverse-geocode`.
6. On submit, save both displayed address and resolved structured fields.

## Frontend Contract

Store these fields in your form model:
- `houseNumber`
- `street`
- `postcode`
- `postcodePrefix`
- `area`
- `lga`
- `state`
- `lat` / `lng` (optional)

## Integration Patterns

### Pattern A: Search-first (recommended)

Best when users know street/area but not postcode.

- Trigger `GET /search?query=...` after 2+ characters (debounced)
- Show `street | area | lga` in dropdown
- Fill structured fields from selected result

### Pattern B: Postcode-first

Best for internal operators and known routes.

- Trigger `GET /postcode/:code/streets`
- Let user pick from returned streets
- Fill structured fields from chosen result

### Pattern C: Location assist

Best for mobile or uncertain addresses.

- Request geolocation permission
- Call `POST /reverse-geocode`
- Treat result as suggestion, not guaranteed exact point

## Minimal Browser Example (search)

```js
async function searchAddresses(query) {
  const res = await fetch(`/search?query=${encodeURIComponent(query)}&limit=10`);
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);
  const data = await res.json();
  return data.results;
}

function applySelection(record, form) {
  form.street.value = record.street;
  form.postcode.value = record.postcode || `${record.postcodePrefix}000`;
  form.area.value = record.area;
  form.lga.value = record.lga;
  form.state.value = record.state;
}
```

## Reliability Notes for Integrators

- Current MVP dataset is Lagos-only.
- Many records have `postcode: null`; use `postcodePrefix` fallback in pilot UX.
- Geolocation is centroid-backed, so use confidence/notes in UX copy.
- Keep manual override available for support/ops teams.

## Backend-to-Backend Use

If your backend calls pCode API directly:
- Cache frequent search and postcode lookups.
- Set request timeouts and retries.
- Log unresolved addresses for data quality feedback.

## Production Hardening Checklist

- Add request/response analytics.
- Add rate limiting and API keys before public exposure.
- Add schema validation for API responses in client.
- Add nightly data quality jobs (duplicates, null postcodes, invalid geo).
- Add state-level dataset partitioning as non-Lagos data is onboarded.
