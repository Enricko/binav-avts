// map_button.js

// Initialize global data store for websocket
window.wsData = {
  navigation: {},
  sensors: {},
};

// Create navigation menu container first
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
  {
    icon: "fa-solid fa-ship",
    label: "Vessels",
    action: () => openVesselModal(),
  },
  {
    icon: "bi bi-broadcast",
    label: "Sensors",
    action: () => openSensorModal(),
  },
  {
    icon: "bi bi-layers",
    label: "GeoLayer",
    action: () => console.log("GeoLayer clicked"),
  },
  {
    icon: "bi bi-people",
    label: "Users",
    action: () => console.log("Users clicked"),
  },
];

// Create list group for nav items
const listGroup = document.createElement("div");
listGroup.className = "list-group";

navItems.forEach((item) => {
  const navItem = document.createElement("button");
  navItem.className =
    "list-group-item list-group-item-action d-flex align-items-center gap-2";
  navItem.innerHTML = `
    <i class="${item.icon}"></i>
    <span>${item.label}</span>
  `;
  navItem.addEventListener("click", (e) => {
    e.preventDefault();
    item.action();
    navDropdown.classList.remove("show");
  });
  listGroup.appendChild(navItem);
});

navDropdown.appendChild(listGroup);
navContainer.appendChild(burgerButton);
navContainer.appendChild(navDropdown);

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

// Add controls to map (make sure to check if the map element exists)
const mapElement = document.querySelector("#map");
if (mapElement) {
  mapElement.appendChild(zoomContainer);
  mapElement.appendChild(measureContainer);
  mapElement.appendChild(navContainer);
  mapElement.appendChild(searchContainer);
}

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
burgerButton.addEventListener("click", (e) => {
  e.preventDefault();
  navDropdown.classList.toggle("show");
});

// Close dropdowns when clicking outside
document.addEventListener("click", (e) => {
  if (!navContainer.contains(e.target)) {
    navDropdown.classList.remove("show");
  }
  if (!searchContainer.contains(e.target)) {
    searchDropdown.classList.remove("show");
  }
});

// Search functionality
function handleSearch() {
  const searchTerm = searchInput.value;
  if (!searchTerm) return;

  // Check vessels
  const vessel = window.wsData.navigation[searchTerm];
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
  const sensor = window.wsData.sensors[searchTerm];
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
  const vesselResults = Object.keys(window.wsData.navigation).filter((key) =>
    key.toLowerCase().includes(searchTerm)
  );

  if (vesselResults.length > 0) {
    hasResults = true;
    const vesselCategory = document.createElement("div");
    vesselCategory.className = "search-category";
    vesselCategory.innerHTML = '<i class="bi bi-ship me-2"></i>Vessels';
    searchDropdown.appendChild(vesselCategory);

    vesselResults.forEach((key) => {
      const vessel = window.wsData.navigation[key];
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
  const sensorResults = Object.keys(window.wsData.sensors).filter((key) =>
    key.toLowerCase().includes(searchTerm)
  );

  if (sensorResults.length > 0) {
    hasResults = true;
    const sensorCategory = document.createElement("div");
    sensorCategory.className = "search-category";
    sensorCategory.innerHTML = '<i class="bi bi-broadcast me-2"></i>Sensors';
    searchDropdown.appendChild(sensorCategory);

    sensorResults.forEach((key) => {
      const sensor = window.wsData.sensors[key];
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

// Define modal functions without exporting them
function openVesselModal() {
  // Check if modal already exists
  let vesselModal = document.getElementById("vesselManagementModal");

  if (!vesselModal) {
    // Create the modal element
    vesselModal = document.createElement("div");
    vesselModal.id = "vesselManagementModal";
    vesselModal.className = "modal fade";
    vesselModal.setAttribute("tabindex", "-1");
    vesselModal.setAttribute("aria-labelledby", "vesselManagementModalLabel");
    vesselModal.setAttribute("aria-hidden", "true");

    // Set the modal HTML structure
    vesselModal.innerHTML = `
      <div class="modal-dialog modal-dialog-centered modal-xl">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="vesselManagementModalLabel">Vessel Management</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body p-0">
            <div id="vesselContentContainer">
              <div class="d-flex justify-content-center p-5">
                <div class="spinner-border text-primary" role="status">
                  <span class="visually-hidden">Loading...</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Append modal to body
    document.body.appendChild(vesselModal);
  }

  // Initialize bootstrap modal
  const bootstrapModal = new bootstrap.Modal(vesselModal);

  // Load content from route
  loadVesselContent();

  // Show the modal
  bootstrapModal.show();
}

function openSensorModal() {
  // Check if modal already exists
  let sensorModal = document.getElementById("sensorManagementModal");

  if (!sensorModal) {
    // Create the modal element
    sensorModal = document.createElement("div");
    sensorModal.id = "sensorManagementModal";
    sensorModal.className = "modal fade";
    sensorModal.setAttribute("tabindex", "-1");
    sensorModal.setAttribute("aria-labelledby", "sensorManagementModalLabel");
    sensorModal.setAttribute("aria-hidden", "true");

    // Set the modal HTML structure
    sensorModal.innerHTML = `
      <div class="modal-dialog modal-dialog-centered modal-xl">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="sensorManagementModalLabel">Sensor Management</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body p-0">
            <div id="sensorContentContainer">
              <div class="d-flex justify-content-center p-5">
                <div class="spinner-border text-primary" role="status">
                  <span class="visually-hidden">Loading...</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Append modal to body
    document.body.appendChild(sensorModal);
  }

  // Initialize bootstrap modal
  const bootstrapModal = new bootstrap.Modal(sensorModal);

  // Load content from route
  loadSensorContent();

  // Show the modal
  bootstrapModal.show();
}

function loadVesselContent() {
  const contentContainer = document.getElementById("vesselContentContainer");

  // Clear existing content and show loading spinner
  contentContainer.innerHTML = `
    <div class="d-flex justify-content-center p-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
    </div>
  `;

  // Fetch the content from the route
  fetch("/api/kapal/view")
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.text();
    })
    .then(async (html) => {
      // Insert the HTML content
      contentContainer.innerHTML = html;

      // Initialize the datatable and other components
      if (typeof initVesselsDatatable === "function") {
        initVesselsDatatable();
      } else {
        // If the function isn't available directly, try importing it
        try {
          const module = await import("./../../management/kapal_management.js");
          if (typeof module.initVesselsDatatable === "function") {
            module.initVesselsDatatable();
          }
        } catch (error) {
          console.error("Failed to load vessel management script:", error);
        }
      }
    })
    .catch((error) => {
      // Show error message
      contentContainer.innerHTML = `
        <div class="alert alert-danger m-3">
          <h5>Failed to load vessel management</h5>
          <p>${error.message}</p>
          <button class="btn btn-sm btn-outline-danger" onclick="loadVesselContent()">
            <i class="bi bi-arrow-clockwise"></i> Retry
          </button>
        </div>
      `;
    });
}

function loadSensorContent() {
  const contentContainer = document.getElementById("sensorContentContainer");

  // Clear existing content and show loading spinner
  contentContainer.innerHTML = `
    <div class="d-flex justify-content-center p-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
    </div>
  `;

  // Fetch the content from the route
  fetch("/api/sensor/view")
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.text();
    })
    .then(async (html) => {
      // Insert the HTML content
      contentContainer.innerHTML = html;

      // Initialize the datatable and other components
      if (typeof initSensorsDatatable === "function") {
        initSensorsDatatable();
      } else {
        // If the function isn't available directly, try importing it
        try {
          const module = await import("./../../management/sensor_management.js");
          if (typeof module.initSensorsDatatable === "function") {
            module.initSensorsDatatable();
          }
        } catch (error) {
          console.error("Failed to load sensor management script:", error);
        }
      }
    })
    .catch((error) => {
      // Show error message
      contentContainer.innerHTML = `
        <div class="alert alert-danger m-3">
          <h5>Failed to load sensor management</h5>
          <p>${error.message}</p>
          <button class="btn btn-sm btn-outline-danger" onclick="loadSensorContent()">
            <i class="bi bi-arrow-clockwise"></i> Retry
          </button>
        </div>
      `;
    });
}

// Make the functions globally available
window.openVesselModal = openVesselModal;
window.openSensorModal = openSensorModal;
window.loadVesselContent = loadVesselContent;
window.loadSensorContent = loadSensorContent;
window.updateDropdown = updateDropdown;