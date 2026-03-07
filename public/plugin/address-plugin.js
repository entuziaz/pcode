(function () {
  "use strict";

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        if (key === "className") node.className = attrs[key];
        else if (key === "text") node.textContent = attrs[key];
        else node.setAttribute(key, attrs[key]);
      });
    }
    (children || []).forEach(function (child) {
      node.appendChild(child);
    });
    return node;
  }

  function debounce(fn, waitMs) {
    var timeout;
    return function () {
      var args = arguments;
      clearTimeout(timeout);
      timeout = setTimeout(function () {
        fn.apply(null, args);
      }, waitMs);
    };
  }

  function field(labelText, inputNode) {
    var wrap = el("div", { className: "field" });
    wrap.appendChild(el("label", { className: "field-label", text: labelText }));
    wrap.appendChild(inputNode);
    return wrap;
  }

  function fieldWithHelp(labelText, inputNode, helpText) {
    var wrap = field(labelText, inputNode);
    wrap.appendChild(el("small", { className: "field-help", text: helpText }));
    return wrap;
  }

  function mount(options) {
    var target = options && options.target ? options.target : document.body;
    var apiBaseUrl = (options && options.apiBaseUrl) || "";

    var root = el("div", { className: "address-plugin" });
    var title = el("h3", { text: "pCode Address Plugin (Lagos Pilot)" });

    var house = el("input", { type: "text", placeholder: "e.g. 12B" });
    var search = el("input", { type: "text", placeholder: "e.g. Awolowo" });
    var streetSelect = el("select");
    streetSelect.appendChild(el("option", { value: "", text: "Select street" }));

    var postcode = el("input", { type: "text", placeholder: "e.g. 100281 or 100" });
    var area = el("input", { type: "text", readonly: "readonly", placeholder: "Auto-filled" });
    var lga = el("input", { type: "text", readonly: "readonly", placeholder: "Auto-filled" });
    var state = el("input", { type: "text", readonly: "readonly", value: "Lagos", placeholder: "Auto-filled" });

    var locationButton = el("button", { type: "button", text: "Use my location" });
    var status = el("p", { className: "status", text: "Ready" });
    var streetById = {};
    var isBusy = false;

    function setBusy(nextBusy, message) {
      isBusy = nextBusy;
      search.disabled = nextBusy;
      postcode.disabled = nextBusy;
      streetSelect.disabled = nextBusy;
      locationButton.disabled = nextBusy;
      locationButton.textContent = nextBusy ? "Working..." : "Use my location";
      if (message) {
        status.textContent = message;
      }
    }

    function fillAddress(record) {
      if (!record) return;
      postcode.value = record.postcode || (record.postcodePrefix ? record.postcodePrefix + "000" : "");
      area.value = record.area || "";
      lga.value = record.lga || "";
      state.value = record.state || "Lagos";
    }

    function setStreetOptions(results) {
      streetById = {};
      streetSelect.innerHTML = "";
      streetSelect.appendChild(el("option", { value: "", text: "Select street" }));

      results.forEach(function (row, idx) {
        var optionId = "s_" + String(idx);
        streetById[optionId] = row;
        var label = row.street + " | " + row.area + " | " + row.lga;
        var option = el("option", { value: optionId, text: label });
        streetSelect.appendChild(option);
      });

      status.textContent = results.length + " match(es)";
    }

    var onSearch = debounce(function (queryText) {
      if (isBusy) return;
      if (!queryText || queryText.trim().length < 2) {
        setStreetOptions([]);
        status.textContent = "Type at least 2 characters to search";
        return;
      }

      setBusy(true, "Searching streets...");
      fetch(apiBaseUrl + "/search?query=" + encodeURIComponent(queryText.trim()) + "&limit=25")
        .then(function (res) { return res.json(); })
        .then(function (payload) {
          setStreetOptions(payload.results || []);
        })
        .catch(function (error) {
          status.textContent = "Search failed: " + error.message;
        })
        .finally(function () {
          setBusy(false);
        });
    }, 180);

    search.addEventListener("input", function (event) {
      onSearch(event.target.value);
    });

    postcode.addEventListener("change", function () {
      if (isBusy) return;
      var code = postcode.value.trim();
      if (!code) return;

      setBusy(true, "Looking up postcode...");
      fetch(apiBaseUrl + "/postcode/" + encodeURIComponent(code))
        .then(function (res) { return res.json(); })
        .then(function (payload) {
          setStreetOptions(payload.streets || []);
          if ((payload.streets || []).length > 0) {
            fillAddress(payload.streets[0]);
          }
        })
        .catch(function (error) {
          status.textContent = "Postcode lookup failed: " + error.message;
        })
        .finally(function () {
          setBusy(false);
        });
    });

    streetSelect.addEventListener("change", function () {
      var optionId = streetSelect.value;
      if (!optionId) return;
      var selected = streetById[optionId];
      if (!selected) {
        status.textContent = "Unable to resolve selected street";
        return;
      }
      fillAddress(selected);
    });

    locationButton.addEventListener("click", function () {
      if (isBusy) return;
      if (!navigator.geolocation) {
        status.textContent = "Geolocation not supported in this browser";
        return;
      }

      setBusy(true, "Getting your location...");
      navigator.geolocation.getCurrentPosition(function (position) {
        fetch(apiBaseUrl + "/reverse-geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          })
        })
          .then(function (res) { return res.json(); })
          .then(function (payload) {
            if (!payload.guess) {
              status.textContent = "Could not infer address";
              return;
            }
            fillAddress(payload.guess);
            status.textContent = "Location matched: " + payload.guess.lga + " (" + payload.guess.confidence + ")";
          })
          .catch(function (error) {
            status.textContent = "Reverse geocode failed: " + error.message;
          })
          .finally(function () {
            setBusy(false);
          });
      }, function (error) {
        status.textContent = "Location access failed: " + error.message;
        setBusy(false);
      });
    });

    root.appendChild(title);
    root.appendChild(field("House/Flat Number", house));
    root.appendChild(field("Search street or area", search));
    root.appendChild(field("Street", streetSelect));
    root.appendChild(field("Postcode (3 or 6 digits)", postcode));
    root.appendChild(fieldWithHelp("Area/Ward", area, "Auto-filled after you pick a street, postcode, or location."));
    root.appendChild(fieldWithHelp("LGA", lga, "Auto-filled from selected address data."));
    root.appendChild(fieldWithHelp("State", state, "Auto-filled. Lagos for this pilot phase."));
    root.appendChild(locationButton);
    root.appendChild(status);

    target.appendChild(root);
  }

  window.AddressPlugin = { mount: mount };
})();
