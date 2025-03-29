/**
 * Nigerian Address Search System
 *
 * A bidirectional system that allows searching by:
 * 1. Postal code → returns all streets in that area
 * 2. Street name → returns all matching streets with their postal code areas
 */
const areaCodes = require("./area-codes.json")

async function nigerianAddressSearch(searchTerm) {
  const isPostalCode = /^\d{6}$/.test(searchTerm.trim());

  if (isPostalCode) {
    return await searchByPostalCode(searchTerm);
  } else {
    return await searchByStreetName(searchTerm);
  }
}

async function searchByPostalCode(postalCode) {
  try {
    const directSearch = await searchOsmPostalCode(postalCode);

    if (directSearch.success && directSearch.streets.length > 0) {
      return directSearch;
    }

    const areaCode = postalCode.substring(0, 3);
    const lgaSearch = await searchByLGACode(areaCode);

    if (lgaSearch.success) {
      return {
        ...lgaSearch,
        postalCode: postalCode,
        note: "Exact postal code not found. Showing streets in the general postal area."
      };
    }

    return {
      success: false,
      postalCode: postalCode,
      error: "Could not find streets for this postal code in Nigeria.",
      streets: []
    };
  } catch (error) {
    console.error("Error in searchByPostalCode:", error);
    return { success: false, error: error.message, streets: [] };
  }
}

async function searchOsmPostalCode(postalCode) {
  const url = `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(postalCode)}&country=Nigeria&format=json`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'NigerianAddressSearch/1.0 (your@email.com)'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();

    if (data.length === 0) {
      console.log(`Postal code ${postalCode} not directly found in OSM.`);
      return { success: false, error: "Postal code not found", streets: [] };
    }

    const place = data[0];
    const bbox = place.boundingbox;

    const streets = await getStreetsInBoundingBox(
      parseFloat(bbox[0]),
      parseFloat(bbox[1]),
      parseFloat(bbox[2]),
      parseFloat(bbox[3])
    );

    return {
      success: true,
      postalCode: postalCode,
      place: place.display_name,
      coordinates: {
        lat: parseFloat(place.lat),
        lon: parseFloat(place.lon)
      },
      streets: streets
    };
  } catch (error) {
    console.error("Error in searchOsmPostalCode:", error);
    return { success: false, error: error.message, streets: [] };
  }
}

async function searchByLGACode(areaCode) {
  try {
    const region = await getRegionFromAreaCode(areaCode);

    if (!region) {
      console.error(`No region found for area code ${areaCode}`);
      return { success: false, error: "Area not found", streets: [] };
    }

    const searchArea = `${region}, Nigeria`;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchArea)}&format=json`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'NigerianAddressSearch/1.0 (your@email.com)'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();

    if (data.length === 0) {
      console.error(`Area search for ${searchArea} failed.`);
      return { success: false, error: "Area not found", streets: [] };
    }

    const place = data[0];

    const lat = parseFloat(place.lat);
    const lon = parseFloat(place.lon);
    const bbox = {
      minLat: lat - 0.05,
      maxLat: lat + 0.05,
      minLon: lon - 0.05,
      maxLon: lon + 0.05
    };

    const streets = await getStreetsInBoundingBox(
      bbox.minLat, bbox.maxLat, bbox.minLon, bbox.maxLon
    );

    return {
      success: true,
      areaCode: areaCode,
      region: region,
      place: place.display_name,
      coordinates: { lat, lon },
      streets: streets
    };
  } catch (error) {
    console.error("Error in searchByLGACode:", error);
    return { success: false, error: error.message, streets: [] };
  }
}

function getRegionFromAreaCode(areaCode) {
  const entry = areaCodes.data.find((area) => area.areaCode=== areaCode)
  return entry ? entry.region : null
}

async function searchByStreetName(streetName) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?street=${encodeURIComponent(streetName)}&country=Nigeria&format=json`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'NigerianAddressSearch/1.0 (your@email.com)'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();

    if (data.length === 0) {
      return {
        success: false,
        query: streetName,
        error: "No streets found matching this name in Nigeria",
        streets: []
      };
    }

    const results = await Promise.all(data.map(async (place) => {
      const address = place.address || {};
      const postalCode = address.postcode || "Unknown";

      const area = address.suburb || address.town || address.city || address.county || "Unknown";
      const state = address.state || "Unknown";

      let nearbyStreets = [];
      if (place.class === "highway" || place.type === "residential") {
        nearbyStreets = await getNearbyStreets(
          parseFloat(place.lat),
          parseFloat(place.lon)
        );
      }

      return {
        name: place.display_name,
        streetName: address.road || streetName,
        area: area,
        state: state,
        postalCode: postalCode,
        coordinates: {
          lat: parseFloat(place.lat),
          lon: parseFloat(place.lon)
        },
        nearbyStreets: nearbyStreets
      };
    }));

    return {
      success: true,
      query: streetName,
      matchCount: results.length,
      matches: results
    };
  } catch (error) {
    console.error("Error in searchByStreetName:", error);
    return { success: false, error: error.message, streets: [] };
  }
}

async function getStreetsInBoundingBox(minLat, maxLat, minLon, maxLon) {
  // For larger areas, we'll need to use a more efficient Overpass query
  // with proper pagination to handle potentially large result sets
  const query = `
    [out:json][timeout:90];
    (
      way["highway"]["name"](${minLat},${minLon},${maxLat},${maxLon});
    );
    out body;
  `;

  const url = `https://overpass-api.de/api/interpreter`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'NigerianAddressSearch/1.0 (your@email.com)'
      },
      body: `data=${encodeURIComponent(query)}`
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    const streets = [];
    const streetNamesSet = new Set();

    data.elements.forEach(element => {
      if (element.type === 'way' && element.tags && element.tags.name) {
        const streetName = element.tags.name;

        if (!streetNamesSet.has(streetName)) {
          streetNamesSet.add(streetName);

          streets.push({
            name: streetName,
            type: element.tags.highway || 'unknown',
            id: element.id,
            surface: element.tags.surface || null,
            lanes: element.tags.lanes || null,
            oneway: element.tags.oneway === 'yes',
            nodes: element.nodes
          });
        }
      }
    });

    return streets.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error("Error fetching street data:", error);
    return [];
  }
}

async function getNearbyStreets(lat, lon, radius = 0.005) {
  const bbox = {
    minLat: lat - radius,
    maxLat: lat + radius,
    minLon: lon - radius,
    maxLon: lon + radius
  };

  return await getStreetsInBoundingBox(
    bbox.minLat, bbox.maxLat, bbox.minLon, bbox.maxLon
  );
}

async function getStreetsWithPagination(minLat, maxLat, minLon, maxLon) {
  // For extremely large areas (like entire cities), we might need pagination
  // This is a good approach if we expect thousands of streets

  let allStreets = [];
  const pageSize = 1000;
  let hasMoreData = true;
  let offset = 0;

  while (hasMoreData) {
    const query = `
      [out:json][timeout:90];
      (
        way["highway"]["name"](${minLat},${minLon},${maxLat},${maxLon});
      );
      out body ${pageSize} ${offset};
    `;

    const url = `https://overpass-api.de/api/interpreter`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'NigerianAddressSearch/1.0 (your@email.com)'
        },
        body: `data=${encodeURIComponent(query)}`
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      const elements = data.elements || [];

      if (elements.length < pageSize) {
        hasMoreData = false;
      }

      const streets = [];
      elements.forEach(element => {
        if (element.type === 'way' && element.tags && element.tags.name) {
          streets.push({
            name: element.tags.name,
            type: element.tags.highway || 'unknown',
            id: element.id
          });
        }
      });

      const uniqueStreets = streets.filter(street =>
        !allStreets.some(existingStreet => existingStreet.id === street.id)
      );

      allStreets = [...allStreets, ...uniqueStreets];
      offset += pageSize;
    } catch (error) {
      console.error("Error in pagination:", error);
      hasMoreData = false;
    }
  }

  const uniqueNames = new Map();
  allStreets.forEach(street => {
    if (!uniqueNames.has(street.name)) {
      uniqueNames.set(street.name, street);
    }
  });

  return Array.from(uniqueNames.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// nigerianAddressSearch("102211").then(result => console.log(result));
nigerianAddressSearch("440001").then(result => console.log(result));
// nigerianAddressSearch("Uzor").then(result => console.log(result));
