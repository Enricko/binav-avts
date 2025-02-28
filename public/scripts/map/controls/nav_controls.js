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

// Function to open the vessel modal
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

// Function to open the sensor modal
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

// Function to load content from the Kapal index route
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
    .then((html) => {
      // Insert the HTML content
      contentContainer.innerHTML = html;

      // Initialize the datatable and other components
      if (typeof initVesselsDatatable === "function") {
        initVesselsDatatable();
      } else {
        // If the function isn't available directly, it might be loaded from the HTML
        // or we need to import it from a module
        import("./../../management/kapal_management.js")
          .then((module) => {
            if (typeof module.initVesselsDatatable === "function") {
              module.initVesselsDatatable();
            }
          })
          .catch((error) => {
            console.error("Failed to load vessel management script:", error);
          });
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

// Function to load content from the Sensor index route
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
    .then((html) => {
      // Insert the HTML content
      contentContainer.innerHTML = html;

      // Initialize the datatable and other components
      if (typeof initSensorsDatatable === "function") {
        initSensorsDatatable();
      } else {
        // If the function isn't available directly, it might be loaded from the HTML
        // or we need to import it from a module
        import("./../../management/sensor_management.js")
          .then((module) => {
            if (typeof module.initSensorsDatatable === "function") {
              module.initSensorsDatatable();
            }
          })
          .catch((error) => {
            console.error("Failed to load sensor management script:", error);
          });
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

// Export functions for use in other modules
export { 
  openVesselModal, 
  openSensorModal, 
  loadVesselContent, 
  loadSensorContent 
};