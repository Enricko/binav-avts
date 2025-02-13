// Add custom styles
const style = document.createElement("style");
style.textContent = `
  .map-controls {
    position: absolute;
    bottom: 24px;
    right: 24px;
    z-index: 1000;
  }

  .zoom-controls {
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 6px rgba(0,0,0,.15);
    overflow: hidden;
  }

  .zoom-button {
    width: 44px;
    height: 44px;
    border: none;
    background: white;
    color: #333;
    font-size: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
  }

  .zoom-button:hover {
    background: #f8f9fa;
    color: #0d6efd;
  }

  .zoom-divider {
    height: 1px;
    background: #dee2e6;
    margin: 0;
  }

  .measure-control {
    position: absolute;
    top: 10px;
    left: 10px;
    z-index: 1060;
  }

  .measure-button {
    display: flex;
    align-items: center;
    gap: 8px;
    background: white;
    border: none;
    border-radius: 8px;
    padding: 8px 16px;
    font-size: 14px;
    color: #333;
    box-shadow: 0 2px 6px rgba(0,0,0,.15);
    transition: all 0.2s;
  }

  .measure-button:hover {
    background: #f8f9fa;
    color: #0d6efd;
    box-shadow: 0 4px 12px rgba(0,0,0,.15);
  }

  .measure-button.active {
    background: #e7f1ff;
    color: #0d6efd;
  }

  .measure-button svg {
    width: 18px;
    height: 18px;
  }

  .modal-measure {
    position: absolute;
    left: 10px;
    top: 120px;
    margin: 0;
    width: 280px;
    pointer-events: auto;
  }

  .modal-backdrop {
    display: none;
}

  .modal {
    background: none;
    pointer-events: none;
  }

  .modal-content {
    pointer-events: auto;
    box-shadow: 0 2px 8px rgba(0,0,0,.2);
  }

  .list-group-item {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
  }

  .measurements-table {
    max-height: 200px;
    overflow-y: auto;
    scrollbar-width: thin;
  }

  .measurements-table::-webkit-scrollbar {
    width: 6px;
  }

  .measurements-table::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 3px;
  }

  .measurements-table::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 3px;
  }

  .measurements-table::-webkit-scrollbar-thumb:hover {
    background: #555;
  }

  .ol-control {
    z-index: 1060;
  }
    
`;

document.head.appendChild(style);

// Create zoom controls
const zoomContainer = document.createElement("div");
zoomContainer.className = "map-controls";

const zoomControlsDiv = document.createElement("div");
zoomControlsDiv.className = "zoom-controls";

const zoomIn = document.createElement("button");
zoomIn.className = "zoom-button";
zoomIn.innerHTML = '<i class="bi bi-plus-lg"></i>';
zoomIn.title = "Zoom in";

const zoomDivider = document.createElement("div");
zoomDivider.className = "zoom-divider";

const zoomOut = document.createElement("button");
zoomOut.className = "zoom-button";
zoomOut.innerHTML = '<i class="bi bi-dash-lg"></i>';
zoomOut.title = "Zoom out";

zoomControlsDiv.appendChild(zoomIn);
zoomControlsDiv.appendChild(zoomDivider);
zoomControlsDiv.appendChild(zoomOut);
zoomContainer.appendChild(zoomControlsDiv);

// Create measure button
const measureContainer = document.createElement("div");
measureContainer.className = "measure-control";

const measureButton = document.createElement("button");
measureButton.className = "measure-button";
measureButton.innerHTML = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M2 12h20M6 9v6M10 9v6M14 9v6M18 9v6"/>
  </svg>
  <span>Measure</span>
`;
measureButton.title = "Measure distance";

measureContainer.appendChild(measureButton);

// Add controls to map
document.querySelector("#map").appendChild(zoomContainer);
document.querySelector("#map").appendChild(measureContainer);

// Initialize map controls
const initMapControls = (map) => {
  // Remove default controls
  map.getControls().clear();

  // Add scale line
  const scaleControl = new ol.control.ScaleLine({
    units: "metric",
    bar: true,
    steps: 4,
    minWidth: 140,
  });
  map.addControl(scaleControl);

  // Add zoom functionality
  zoomIn.addEventListener("click", () => {
    const view = map.getView();
    view.animate({
      zoom: view.getZoom() + 1,
      duration: 250,
    });
  });

  zoomOut.addEventListener("click", () => {
    const view = map.getView();
    view.animate({
      zoom: view.getZoom() - 1,
      duration: 250,
    });
  });

  // Initialize measurement tool
  const measureTool = new MeasurementTool(map);

  measureButton.addEventListener("click", () => {
    measureTool.toggle();
    measureButton.classList.toggle("active");
  });

  return measureTool;
};

// Initialize controls after a small delay
setTimeout(() => {
  const measureTool = initMapControls(map);
}, 100);

// Modern search control styles
const searchStyle = document.createElement("style");
searchStyle.textContent = `
  .search-control {
    position: absolute;
    top: 10px;
    left: 10px;
    z-index: 1070;
    width: 300px;
  }

  .measure-control {
    top: 70px;
  }

  .search-input-group {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(8px);
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    transition: all 0.3s ease;
  }

  .search-input-group:hover,
  .search-input-group:focus-within {
    transform: translateY(-2px);
    box-shadow: 0 6px 24px rgba(0,0,0,0.15);
  }

  .search-input {
    border: none;
    background: transparent;
    padding: 12px 16px;
    font-size: 15px;
    color: #2c3e50;
    transition: all 0.3s;
  }

  .search-input::placeholder {
    color: #94a3b8;
  }

  .search-button {
    padding: 8px 16px;
    border: none;
    background: transparent;
    color: #3b82f6;
    transition: all 0.2s;
  }

  .search-button:hover {
    color: #1d4ed8;
    transform: scale(1.1);
  }

  .search-dropdown {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    width: 100%;
    background: rgba(255, 255, 255, 0.98);
    backdrop-filter: blur(8px);
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    margin-top: 4px;
    max-height: 400px;
    overflow-y: auto;
    display: none;
    transition: all 0.3s;
    scrollbar-width: thin;
    scrollbar-color: #94a3b8 transparent;
  }

  .search-dropdown::-webkit-scrollbar {
    width: 6px;
  }

  .search-dropdown::-webkit-scrollbar-track {
    background: transparent;
  }

  .search-dropdown::-webkit-scrollbar-thumb {
    background-color: #94a3b8;
    border-radius: 3px;
  }

  .search-dropdown.show {
    display: block;
    animation: dropdownFade 0.3s ease;
  }

  @keyframes dropdownFade {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .search-dropdown-item {
    padding: 12px 16px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 12px;
    color: #1e293b;
  }

  .search-dropdown-item:hover {
    background: #f1f5f9;
    transform: translateX(4px);
  }

  .search-category {
    font-weight: 600;
    color: #64748b;
    padding: 8px 16px;
    background: #f8fafc;
    font-size: 13px;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }

  .item-status {
    font-size: 13px;
    padding: 4px 8px;
    border-radius: 6px;
    margin-left: auto;
  }

  .status-connected {
    background: #dcfce7;
    color: #15803d;
  }

  .status-disconnected {
    background: #fee2e2;
    color: #b91c1c;
  }

  .vessel-speed {
    font-size: 13px;
    color: #64748b;
  }
`;

document.head.appendChild(searchStyle);

// Create search control with modern icons
const searchContainer = document.createElement("div");
searchContainer.className = "search-control";

const searchInputGroup = document.createElement("div");
searchInputGroup.className = "input-group search-input-group";

const searchInput = document.createElement("input");
searchInput.type = "text";
searchInput.className = "form-control search-input";
searchInput.placeholder = "Search vessels & sensors...";

const searchButton = document.createElement("button");
searchButton.className = "btn search-button";
searchButton.innerHTML = '<i class="bi bi-search"></i>';

const searchDropdown = document.createElement("div");
searchDropdown.className = "search-dropdown";

searchInputGroup.appendChild(searchInput);
searchInputGroup.appendChild(searchButton);
searchContainer.appendChild(searchInputGroup);
searchContainer.appendChild(searchDropdown);

document.querySelector("#map").appendChild(searchContainer);

// WebSocket data store
let wsData = {
  navigation: {},
  sensors: {},
};

// Update WebSocket data
// ws.onmessage = (event) => {
//   const data = JSON.parse(event.data);
//   if (data.navigation) wsData.navigation = data.navigation;
//   if (data.sensors) wsData.sensors = data.sensors;

//   if (searchDropdown.classList.contains("show")) {
//     updateDropdown(searchInput.value);
//   }
// };

function handleSearch() {
  const searchTerm = searchInput.value;
  if (!searchTerm) return;

  // Check vessels
  const vessel = wsData.navigation[searchTerm];
  if (vessel) {
    map.getView().animate({
      center: ol.proj.fromLonLat([
        parseFloat(vessel.telemetry.longitude_decimal),
        parseFloat(vessel.telemetry.latitude_decimal),
      ]),
      zoom: 15,
      duration: 800,
      easing: ol.easing.easeOut,
    });
    detailOverlay.showVesselDetails(vessel);
  }

  // Check sensors
  const sensor = wsData.sensors[searchTerm];
  if (sensor) {
    map.getView().animate({
      center: ol.proj.fromLonLat([
        parseFloat(sensor.longitude),
        parseFloat(sensor.latitude),
      ]),
      zoom: 15,
      duration: 800,
      easing: ol.easing.easeOut,
    });
    detailOverlay.showSensorDetails(sensor);
  }

  // updateDropdown(searchTerm);
  // setTimeout(() => {
  //   const dropdownItems = searchDropdown.querySelectorAll(
  //     ".search-dropdown-item"
  //   );
  //   if (dropdownItems.length > 0) {
  //     dropdownItems[0].click();
  //   }
  // }, 100);
}

searchButton.addEventListener("click", handleSearch);

function updateDropdown(searchTerm) {
  searchDropdown.innerHTML = "";

  if (!searchTerm) {
    searchDropdown.classList.remove("show");
    return;
  }

  let hasResults = false;
  searchTerm = searchTerm.toLowerCase();

  // Vessels section
  const vesselResults = Object.keys(wsData.navigation).filter((key) =>
    key.toLowerCase().includes(searchTerm)
  );

  if (vesselResults.length > 0) {
    hasResults = true;
    const vesselCategory = document.createElement("div");
    vesselCategory.className = "search-category";
    vesselCategory.innerHTML = '<i class="bi bi-ship me-2"></i>Vessels';
    searchDropdown.appendChild(vesselCategory);

    vesselResults.forEach((key) => {
      const vessel = wsData.navigation[key];
      const item = document.createElement("div");
      item.className = "search-dropdown-item";

      const statusClass =
        vessel.telemetry.telnet_status === "Connected"
          ? "status-connected"
          : "status-disconnected";

      item.innerHTML = `
        <i class="bi bi-geo-alt text-blue-500"></i>
        <div>
          <div>${key}</div>
          <div class="vessel-speed">${vessel.telemetry.speed_in_knots} knots</div>
        </div>
        <span class="item-status ${statusClass}">${vessel.telemetry.telnet_status}</span>
      `;

      item.addEventListener("click", () => {
        searchInput.value = key;
        searchDropdown.classList.remove("show");

        detailOverlay.showVesselDetails(vessel);

        map.getView().animate({
          center: ol.proj.fromLonLat([
            parseFloat(vessel.telemetry.longitude_decimal),
            parseFloat(vessel.telemetry.latitude_decimal),
          ]),
          zoom: 15,
          duration: 800,
          easing: ol.easing.easeOut,
        });
      });
      searchDropdown.appendChild(item);
    });
  }

  // Sensors section
  const sensorResults = Object.keys(wsData.sensors).filter((key) =>
    key.toLowerCase().includes(searchTerm)
  );

  if (sensorResults.length > 0) {
    hasResults = true;
    const sensorCategory = document.createElement("div");
    sensorCategory.className = "search-category";
    sensorCategory.innerHTML = '<i class="bi bi-broadcast me-2"></i>Sensors';
    searchDropdown.appendChild(sensorCategory);

    sensorResults.forEach((key) => {
      const sensor = wsData.sensors[key];
      const item = document.createElement("div");
      item.className = "search-dropdown-item";

      const statusClass =
        sensor.connection_status === "Connected"
          ? "status-connected"
          : "status-disconnected";

      item.innerHTML = `
        <i class="bi bi-broadcast text-blue-500"></i>
        <div>
          <div>${sensor.id}</div>
          <div class="vessel-speed">${sensor.types.join(", ")}</div>
        </div>
        <span class="item-status ${statusClass}">${
        sensor.connection_status
      }</span>
      `;

      item.addEventListener("click", () => {
        searchInput.value = sensor.id;
        searchDropdown.classList.remove("show");

        detailOverlay.showSensorDetails(sensor);

        map.getView().animate({
          center: ol.proj.fromLonLat([
            parseFloat(sensor.longitude),
            parseFloat(sensor.latitude),
          ]),
          zoom: 15,
          duration: 800,
          easing: ol.easing.easeOut,
        });
      });
      searchDropdown.appendChild(item);
    });
  }

  searchDropdown.classList.toggle("show", hasResults);
}

searchInput.addEventListener("input", (e) => {
  updateDropdown(e.target.value);
});

searchInput.addEventListener("focus", () => {
  updateDropdown(searchInput.value);
});

searchInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    handleSearch();
  }
});

document.addEventListener("click", (e) => {
  if (!searchContainer.contains(e.target)) {
    searchDropdown.classList.remove("show");
  }
});
