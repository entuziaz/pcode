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

  var mountCounter = 0;

  function field(labelText, inputNode, inputId) {
    var wrap = el("div", { className: "field" });
    wrap.appendChild(el("label", { className: "field-label", text: labelText, for: inputId }));
    wrap.appendChild(inputNode);
    return wrap;
  }

  function fieldWithHelp(labelText, inputNode, inputId, helpText, helpId) {
    var wrap = field(labelText, inputNode, inputId);
    wrap.appendChild(el("small", { className: "field-help", text: helpText, id: helpId }));
    return wrap;
  }

  function mount(options) {
    mountCounter += 1;
    var formIdPrefix = "pcode-" + String(mountCounter);
    function id(name) {
      return formIdPrefix + "-" + name;
    }

    var target = options && options.target ? options.target : document.body;
    var apiBaseUrl = (options && options.apiBaseUrl) || "";

    var root = el("form", { className: "address-plugin", novalidate: "novalidate" });
    var title = el("h3", { text: "pCode Address Plugin (Lagos Pilot)" });

    var houseId = id("house");
    var searchId = id("search");
    var streetId = id("street");
    var postcodeId = id("postcode");
    var areaId = id("area");
    var lgaId = id("lga");
    var stateId = id("state");
    var areaHelpId = id("area-help");
    var lgaHelpId = id("lga-help");
    var stateHelpId = id("state-help");

    var house = el("input", { id: houseId, type: "text", placeholder: "e.g. 12B" });
    var search = el("input", { id: searchId, type: "text", placeholder: "e.g. Awolowo" });
    var streetSelect = el("select", { id: streetId });
    streetSelect.appendChild(el("option", { value: "", text: "Select street" }));

    var postcode = el("input", { id: postcodeId, type: "text", placeholder: "e.g. 100281 or 100" });
    var area = el("input", {
      id: areaId,
      type: "text",
      readonly: "readonly",
      placeholder: "Auto-filled",
      "aria-describedby": areaHelpId
    });
    var lga = el("input", {
      id: lgaId,
      type: "text",
      readonly: "readonly",
      placeholder: "Auto-filled",
      "aria-describedby": lgaHelpId
    });
    var state = el("input", {
      id: stateId,
      type: "text",
      readonly: "readonly",
      value: "Lagos",
      placeholder: "Auto-filled",
      "aria-describedby": stateHelpId
    });

    var submitButton = el("button", { type: "submit", className: "secondary", text: "Find address" });
    var locationButton = el("button", { type: "button", text: "Use my location" });
    var status = el("p", {
      className: "status",
      text: "Ready",
      role: "status",
      "aria-live": "polite",
      "aria-atomic": "true"
    });
    var streetById = {};
    var isBusy = false;

    function setBusy(nextBusy, message) {
      isBusy = nextBusy;
      search.disabled = nextBusy;
      postcode.disabled = nextBusy;
      streetSelect.disabled = nextBusy;
      submitButton.disabled = nextBusy;
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

    function performSearch(queryText) {
      if (isBusy) return Promise.resolve();
      var normalizedQuery = queryText && queryText.trim();
      if (!normalizedQuery || normalizedQuery.length < 2) {
        setStreetOptions([]);
        status.textContent = "Type at least 2 characters to search";
        return Promise.resolve();
      }

      setBusy(true, "Searching streets...");
      return fetch(apiBaseUrl + "/search?query=" + encodeURIComponent(normalizedQuery) + "&limit=25")
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
    }

    function performPostcodeLookup(code) {
      if (isBusy) return Promise.resolve();
      var normalizedCode = code && code.trim();
      if (!normalizedCode) return Promise.resolve();

      setBusy(true, "Looking up postcode...");
      return fetch(apiBaseUrl + "/postcode/" + encodeURIComponent(normalizedCode))
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
    }

    var onSearch = debounce(function (queryText) {
      performSearch(queryText);
    }, 180);

    search.addEventListener("input", function (event) {
      onSearch(event.target.value);
    });

    postcode.addEventListener("change", function () {
      performPostcodeLookup(postcode.value);
    });

    root.addEventListener("submit", function (event) {
      event.preventDefault();
      var queryText = search.value.trim();
      var code = postcode.value.trim();

      if (queryText.length >= 2) {
        performSearch(queryText);
        return;
      }

      if (code.length > 0) {
        performPostcodeLookup(code);
        return;
      }

      status.textContent = "Enter a street query or postcode, then submit.";
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
    root.appendChild(field("House/Flat Number", house, houseId));
    root.appendChild(field("Search street or area", search, searchId));
    root.appendChild(field("Street", streetSelect, streetId));
    root.appendChild(field("Postcode (3 or 6 digits)", postcode, postcodeId));
    root.appendChild(fieldWithHelp("Area/Ward", area, areaId, "Auto-filled after you pick a street, postcode, or location.", areaHelpId));
    root.appendChild(fieldWithHelp("LGA", lga, lgaId, "Auto-filled from selected address data.", lgaHelpId));
    root.appendChild(fieldWithHelp("State", state, stateId, "Auto-filled. Lagos for this pilot phase.", stateHelpId));
    var actions = el("div", { className: "actions" }, [submitButton, locationButton]);
    root.appendChild(actions);
    root.appendChild(status);

    target.appendChild(root);
  }

  window.AddressPlugin = { mount: mount };
})();
