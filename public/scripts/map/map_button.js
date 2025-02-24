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

// Create search control
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

// Create navigation menu container
const navContainer = document.createElement("div");
navContainer.className = "nav-control";

// Create burger button
const burgerButton = document.createElement("button");
burgerButton.className = "nav-button";
burgerButton.innerHTML = `
  <i class="bi bi-list"></i>
`;
burgerButton.title = "Navigation Menu";

// Create dropdown menu
const navDropdown = document.createElement("div");
navDropdown.className = "nav-dropdown";

// Create navigation items
const navItems = [
  { icon: 'fa-solid fa-ship', label: 'Vessels', action: () => console.log('Vessels clicked') },
  { icon: 'bi bi-broadcast', label: 'Sensors', action: () => console.log('Sensors clicked') },
  { icon: 'bi bi-layers', label: 'GeoLayer', action: () => console.log('GeoLayer clicked') },
  { icon: 'bi bi-people', label: 'Users', action: () => console.log('Users clicked') }
];

// Create list group for nav items
const listGroup = document.createElement("div");
listGroup.className = "list-group";

navItems.forEach(item => {
  const navItem = document.createElement("button");
  navItem.className = "list-group-item list-group-item-action d-flex align-items-center gap-2";
  navItem.innerHTML = `
    <i class="${item.icon}"></i>
    <span>${item.label}</span>
  `;
  navItem.addEventListener('click', (e) => {
    e.preventDefault();
    item.action();
    navDropdown.classList.remove('show');
  });
  listGroup.appendChild(navItem);
});

navDropdown.appendChild(listGroup);
navContainer.appendChild(burgerButton);
navContainer.appendChild(navDropdown);

// Add controls to map
document.querySelector("#map").appendChild(navContainer);
document.querySelector("#map").appendChild(searchContainer);

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

// Toggle burger menu dropdown
burgerButton.addEventListener('click', (e) => {
  e.preventDefault();
  navDropdown.classList.toggle('show');
});

// Close dropdowns when clicking outside
document.addEventListener('click', (e) => {
  if (!navContainer.contains(e.target)) {
    navDropdown.classList.remove('show');
  }
  if (!searchContainer.contains(e.target)) {
    searchDropdown.classList.remove('show');
  }
});

// WebSocket data store
window.wsData = {
  navigation: {},
  sensors: {},
};

// Search functionality
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
    vesselDetail.showVesselDetails(vessel);
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
    sensorDetail.showSensorDetails(sensor);
  }
}

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

        vesselDetail.showVesselDetails(vessel);

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
        <span class="item-status ${statusClass}">${sensor.connection_status}</span>
      `;

      item.addEventListener("click", () => {
        searchInput.value = sensor.id;
        searchDropdown.classList.remove("show");

        sensorDetail.showSensorDetails(sensor);

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

searchButton.addEventListener("click", handleSearch);

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

// Initialize controls after a small delay
setTimeout(() => {
  const measureTool = initMapControls(map);
}, 100);