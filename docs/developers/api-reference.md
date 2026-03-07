# API Reference

Base URL (local): `http://localhost:3000`

- Content type: `application/json`
- CORS: enabled for all origins (`*`)
- Methods supported: `GET`, `POST`, `OPTIONS`

## Streets by Postcode

### `GET /postcode/:code/streets`

Also supports legacy alias: `GET /postcode/:code`

Rules:
- Accepts 3-digit prefix (`100`) or 6-digit postcode (`100281`)
- Non-digit characters are stripped
- For 6-digit input, behavior is exact-or-prefix fallback

Example:
```bash
curl "http://localhost:3000/postcode/100/streets"
```

Response shape:
```json
{
  "postcode": "100",
  "mode": "prefix",
  "streets": [
    {
      "street": "Abibatu Street",
      "postcode": null,
      "postcodePrefix": "100",
      "area": "Agbotikuyo / Dopemu",
      "lga": "Agege",
      "state": "Lagos",
      "geo": {
        "lat": 6.6188,
        "lng": 3.3219,
        "source": "lga_centroid",
        "precisionMeters": 3000
      }
    }
  ]
}
```

If input is invalid length, response is still `200` with:
```json
{
  "postcode": "12",
  "mode": "invalid",
  "streets": []
}
```

## Search Streets/Areas

### `GET /search?query=<text>&limit=<n>`

Returns ranked matches by street/area/LGA using normalized partial matching.

Query params:
- `query` (required): free text
- `limit` (optional): `1..100`, default `20`

Example:
```bash
curl "http://localhost:3000/search?query=awolowo&limit=5"
```

Response shape:
```json
{
  "query": "awolowo",
  "count": 5,
  "results": [
    {
      "street": "Awolowo Way",
      "streetNormalized": "awolowo way",
      "postcode": null,
      "postcodePrefix": "100",
      "area": "Alausa / Oregun / Olusosun",
      "lga": "Ikeja",
      "state": "Lagos",
      "geo": {
        "lat": 6.6018,
        "lng": 3.3515,
        "source": "lga_centroid",
        "precisionMeters": 3000
      },
      "searchTokens": ["awolowo", "way", "ikeja"],
      "source": {
        "file": "Ikeja LGA.txt",
        "raw": "Junction Of Kafi/awolowo Way"
      }
    }
  ]
}
```

## Reverse Geocode Guess

### `POST /reverse-geocode`

Body:
```json
{
  "lat": 6.5,
  "lng": 3.35
}
```

Example:
```bash
curl -X POST "http://localhost:3000/reverse-geocode" \
  -H "Content-Type: application/json" \
  -d '{"lat":6.5,"lng":3.35}'
```

Success response:
```json
{
  "input": { "lat": 6.5, "lng": 3.35 },
  "guess": {
    "street": "Adelabu St.",
    "postcode": null,
    "postcodePrefix": "101",
    "area": "Adeniran / Ogunsanya",
    "lga": "Surulere",
    "state": "Lagos",
    "geo": {
      "lat": 6.4966,
      "lng": 3.3539,
      "source": "lga_centroid",
      "precisionMeters": 3000
    },
    "distanceKm": 0.573,
    "confidence": "high",
    "note": "MVP guess based on nearest LGA centroid-backed record."
  }
}
```

Validation error (`400`):
```json
{ "error": "lat and lng must be numbers" }
```

No geo records (`404`):
```json
{ "error": "No geocoded records available" }
```

## Health

### `GET /health`

Use this for uptime checks and deployment smoke tests.

Response:
```json
{
  "ok": true,
  "dataset": {
    "records": 5897,
    "lgas": 17,
    "generatedAt": "2026-03-07T00:00:00.000Z"
  }
}
```

## Error Model

Common errors:
- `404`: unknown route/static file not found
- `405`: method not allowed
- `500`: server/runtime error

Generic error payload:
```json
{ "error": "<message>" }
```
