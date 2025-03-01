import SensorApiModel from "./../models/sensor_api_model.js";

// Initialize the application when the DOM is ready
document.addEventListener("DOMContentLoaded", initSensorsDatatable);

export function initSensorsDatatable() {
  // Initialize Sensor API model
  const sensorModel = new SensorApiModel();

  // Current state variables
  let currentPage = 1;
  let itemsPerPage = 10;
  let totalItems = 0;
  let totalPages = 0;
  let sensors = [];
  let deleteSensorId = null;
  let restoreSensorId = null;
  let isEditMode = false;
  let manageSensorId = null;
  let historyViewSensorId = null;

  // Initialize page
  initialize();

  // Initialize function
  async function initialize() {
    // Load initial data
    await loadSensors();

    // Set up event handlers
    setupEventHandlers();

    // Handle empty state button
    document
      .getElementById("addEmptyStateBtn")
      ?.addEventListener("click", function () {
        document.getElementById("addSensorBtn").click();
      });

    // Set up backdrop style for modals
    addModalBackdropStyle();
  }

  // Add custom modal backdrop styling
  function addModalBackdropStyle() {
    const style = document.createElement("style");
    style.textContent = `
      .modal-backdrop {
        background-color: #000000 !important;
        opacity: 0.4 !important;
      }
      .modal {
        z-index: 1050;
      }
      .modal-content {
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.5);
      }
      .sensor-type-badge {
        font-size: 80%;
        padding: 0.35em 0.65em;
        margin-right: 0.25rem;
      }
      .badge-tide {
        background-color: #0dcaf0;
        color: #000;
      }
      .badge-weather {
        background-color: #6610f2;
        color: #fff;
      }
      .badge-water {
        background-color: #0d6efd;
        color: #fff;
      }
      .badge-pollution {
        background-color: #dc3545;
        color: #fff;
      }
      .badge-current {
        background-color: #198754;
        color: #fff;
      }
    `;
    document.head.appendChild(style);
  }

  // Load sensors with current filters
  async function loadSensors() {
    try {
      // Show loading indicator
      document.getElementById("emptyState")?.classList.add("d-none");
      document.getElementById("loadingIndicator")?.classList.remove("d-none");
      document.getElementById("tableContainer")?.classList.add("d-none");

      document.querySelector("#sensorsTable tbody").innerHTML =
        '<tr><td colspan="6" class="text-center"><div class="spinner-border text-primary" role="status"></div></td></tr>';

      // Get filter values
      const type = document.getElementById("filterType").value;
      const withTrashed = document.getElementById("showDeleted").checked;

      // Prepare query parameters
      const params = {
        page: currentPage,
        limit: itemsPerPage,
        with_trashed: withTrashed,
      };

      // Add filters if selected
      if (type) params.type = type;

      // Fetch data
      const response = await sensorModel.fetchSensors(params);

      // Update state variables
      sensors = response.data;
      totalItems = response.meta.total;
      totalPages = response.meta.last_page;
      currentPage = response.meta.current_page;

      // Hide loading indicator
      document.getElementById("loadingIndicator")?.classList.add("d-none");

      // Show appropriate view based on data
      if (!sensors || sensors.length === 0) {
        document.getElementById("emptyState")?.classList.remove("d-none");
        document.getElementById("tableContainer")?.classList.add("d-none");
      } else {
        document.getElementById("emptyState")?.classList.add("d-none");
        document.getElementById("tableContainer")?.classList.remove("d-none");
      }

      // Render table and pagination
      renderTable();
      renderPagination();
    } catch (error) {
      // Hide loading indicator
      document.getElementById("loadingIndicator")?.classList.add("d-none");

      showAlert("Error", `Failed to load sensors: ${error.message}`);
    }
  }

  // Render the sensors table
  function renderTable() {
    const tbody = document.querySelector("#sensorsTable tbody");

    // Clear existing rows
    tbody.innerHTML = "";

    // Check if no data
    if (!sensors || sensors.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="6" class="text-center">No sensors found</td></tr>';
      return;
    }

    // Create rows for each sensor
    sensors.forEach((sensor) => {
      const tr = document.createElement("tr");

      // Format sensor types as badges
      let typesBadges = "";
      if (sensor.types && sensor.types.length > 0) {
        sensor.types.forEach((type) => {
          let badgeClass = `badge-${type.toLowerCase()}`;
          typesBadges += `<span class="badge sensor-type-badge ${badgeClass}">${type}</span>`;
        });
      } else {
        typesBadges = '<span class="badge bg-secondary">None</span>';
      }

      // Format last update time
      let lastUpdate = "Never";
      if (sensor.last_update) {
        const date = new Date(sensor.last_update);
        lastUpdate = date.toLocaleString();
      }

      // Format location
      let location = "Not set";
      if (sensor.latitude && sensor.longitude) {
        location = `${sensor.latitude}, ${sensor.longitude}`;
      }

      // Determine status badge
      let statusBadge = "";
      if (sensor.deleted_at) {
        statusBadge = '<span class="badge bg-secondary">Deleted</span>';
      } else {
        let connectionStatus = sensor.connection_status || "Disconnected";
        let badgeClass =
          connectionStatus === "Connected" ? "bg-success" : "bg-danger";
        statusBadge = `<span class="badge ${badgeClass}">${connectionStatus}</span>`;
      }

      // Determine actions based on sensor status
      const isDeleted = sensor.deleted_at !== null;

      // Create action buttons
      const actionButtons = `
        <div class="btn-group" role="group">
          <button type="button" class="btn btn-sm btn-info view-btn" title="View Details" data-sensor-id="${
            sensor.id
          }">
            <i class="fa-solid fa-eye"></i>
          </button>
          ${
            !isDeleted
              ? `
            <button type="button" class="btn btn-sm btn-warning edit-btn" title="Edit Sensor" data-sensor-id="${sensor.id}">
              <i class="fa-solid fa-edit"></i>
            </button>
            <button type="button" class="btn btn-sm btn-primary type-btn" title="Manage Types" data-sensor-id="${sensor.id}">
              <i class="fa-solid fa-tags"></i>
            </button>
            <button type="button" class="btn btn-sm btn-danger delete-btn" title="Delete Sensor" data-sensor-id="${sensor.id}">
              <i class="fa-solid fa-trash"></i>
            </button>
          `
              : `
            <button type="button" class="btn btn-sm btn-success restore-btn" title="Restore Sensor" data-sensor-id="${sensor.id}">
              <i class="fa-solid fa-rotate-left"></i>
            </button>
          `
          }
        </div>
      `;

      // Set row HTML
      tr.innerHTML = `
        <td class="ps-3">${sensor.id}</td>
        <td>${typesBadges}</td>
        <td>${location}</td>
        <td>${lastUpdate}</td>
        <td>${statusBadge}</td>
        <td class="text-end pe-3">${actionButtons}</td>
      `;

      tbody.appendChild(tr);
    });

    // Update pagination info
    const start = (currentPage - 1) * itemsPerPage + 1;
    const end = Math.min(start + sensors.length - 1, totalItems);
    document.getElementById(
      "pagination-info"
    ).textContent = `Showing ${start} to ${end} of ${totalItems} entries`;
  }

  // Render pagination controls
  function renderPagination() {
    const pagination = document.getElementById("pagination-controls");
    pagination.innerHTML = "";

    // Previous button
    const prevLi = document.createElement("li");
    prevLi.className = `page-item ${currentPage === 1 ? "disabled" : ""}`;
    prevLi.innerHTML =
      '<a class="page-link" href="#" aria-label="Previous"><span aria-hidden="true">&laquo;</span></a>';
    prevLi.addEventListener("click", (e) => {
      e.preventDefault();
      if (currentPage > 1) {
        currentPage--;
        loadSensors();
      }
    });
    pagination.appendChild(prevLi);

    // Page numbers
    const maxPages = 5; // Maximum number of page links to show
    const startPage = Math.max(1, currentPage - Math.floor(maxPages / 2));
    const endPage = Math.min(totalPages, startPage + maxPages - 1);

    for (let i = startPage; i <= endPage; i++) {
      const pageLi = document.createElement("li");
      pageLi.className = `page-item ${i === currentPage ? "active" : ""}`;
      pageLi.innerHTML = `<a class="page-link" href="#">${i}</a>`;
      pageLi.addEventListener("click", (e) => {
        e.preventDefault();
        currentPage = i;
        loadSensors();
      });
      pagination.appendChild(pageLi);
    }

    // Next button
    const nextLi = document.createElement("li");
    nextLi.className = `page-item ${
      currentPage === totalPages ? "disabled" : ""
    }`;
    nextLi.innerHTML =
      '<a class="page-link" href="#" aria-label="Next"><span aria-hidden="true">&raquo;</span></a>';
    nextLi.addEventListener("click", (e) => {
      e.preventDefault();
      if (currentPage < totalPages) {
        currentPage++;
        loadSensors();
      }
    });
    pagination.appendChild(nextLi);
  }

  // Set up event handlers for page interactions
  function setupEventHandlers() {
    // Filter button click
    document.getElementById("applyFilters").addEventListener("click", () => {
      currentPage = 1; // Reset to first page when applying filters
      loadSensors();
    });

    // Show deleted checkbox change
    document.getElementById("showDeleted").addEventListener("change", () => {
      currentPage = 1; // Reset to first page when toggling deleted
      loadSensors();
    });

    // Add sensor button
    document.getElementById("addSensorBtn").addEventListener("click", () => {
      resetForm();
      isEditMode = false;
      document.getElementById("sensorModalLabel").textContent =
        "Add New Sensor";
      document.getElementById("sensorId").disabled = false;

      const sensorModal = new bootstrap.Modal(
        document.getElementById("sensorModal")
      );
      sensorModal.show();
    });

    // Save sensor button
    document
      .getElementById("saveSensorBtn")
      .addEventListener("click", saveSensor);

    // Pick location button
    document
      .getElementById("pickLocationBtn")
      .addEventListener("click", showLocationPicker);

    // Confirm location button
    document
      .getElementById("confirmLocationBtn")
      .addEventListener("click", confirmLocation);

    // Add type button in manage types modal
    document
      .getElementById("addTypeBtn")
      .addEventListener("click", addSensorType);

    // Table row action buttons
    document
      .querySelector("#sensorsTable tbody")
      .addEventListener("click", (e) => {
        // Find the closest button
        const button = e.target.closest("button");
        if (!button) return;

        // Get the sensor ID
        const sensorId = button.dataset.sensorId;

        // Handle different button actions
        if (button.classList.contains("view-btn")) {
          viewSensor(sensorId);
        } else if (button.classList.contains("edit-btn")) {
          editSensor(sensorId);
        } else if (button.classList.contains("type-btn")) {
          manageSensorTypes(sensorId);
        } else if (button.classList.contains("delete-btn")) {
          confirmDelete(sensorId);
        } else if (button.classList.contains("restore-btn")) {
          confirmRestore(sensorId);
        }
      });

    // Delete confirmation
    document
      .getElementById("confirmDeleteBtn")
      .addEventListener("click", deleteSensor);

    // Restore confirmation
    document
      .getElementById("confirmRestoreBtn")
      .addEventListener("click", restoreSensor);

    // Fetch history button
    document
      .getElementById("fetchHistoryBtn")
      .addEventListener("click", fetchSensorHistory);

    // Export history button
    document
      .getElementById("exportHistoryBtn")
      .addEventListener("click", exportSensorHistory);
  }

  // Reset form fields
  function resetForm() {
    // Reset the form
    document.getElementById("sensorForm").reset();

    // Reset type checkboxes
    document.querySelectorAll('input[name="types"]').forEach((checkbox) => {
      checkbox.checked = false;
    });
  }

  // Show location picker modal

  // Show location picker using the main map
  function showLocationPicker() {
    // Store references to both modals before hiding them
    sensorModalInstance = bootstrap.Modal.getInstance(
      document.getElementById("sensorModal")
    );
    sensorManagementModalInstance = bootstrap.Modal.getInstance(
      document.getElementById("sensorManagementModal")
    );

    // Hide both modals to allow map interaction
    if (sensorModalInstance) {
      sensorModalInstance.hide();
    }

    if (sensorManagementModalInstance) {
      sensorManagementModalInstance.hide();
    }
    // Get current coordinates
    const latitude = document.getElementById("latitude").value || "-1.219515";
    const longitude =
      document.getElementById("longitude").value || "116.855698";

    // Save original map state to restore later
    originalCenter = window.map.getView().getCenter();
    originalZoom = window.map.getView().getZoom();

    // Create picker overlay panel if it doesn't exist
    let pickerPanel = document.getElementById("locationPickerPanel");
    if (!pickerPanel) {
      pickerPanel = document.createElement("div");
      pickerPanel.id = "locationPickerPanel";
      pickerPanel.className = "location-picker-panel";
      pickerPanel.innerHTML = `
        <div class="location-picker-header">
          <i class="fa-solid fa-map-marker-alt me-2"></i>
          Pick Sensor Location
          <button type="button" class="btn-close btn-close-white" id="closePickerBtn"></button>
        </div>
        <div class="location-picker-body">
          <div class="row g-2 mb-2">
            <div class="col-6">
              <label class="form-label small mb-0">Latitude</label>
              <input type="text" class="form-control form-control-sm bg-dark text-white border-secondary" id="pickedLatitude">
            </div>
            <div class="col-6">
              <label class="form-label small mb-0">Longitude</label>
              <input type="text" class="form-control form-control-sm bg-dark text-white border-secondary" id="pickedLongitude">
            </div>
          </div>
          <div class="location-picker-instructions">
            Click anywhere on the map to select a location
          </div>
        </div>
        <div class="location-picker-footer">
          <button type="button" class="btn btn-sm btn-outline-light" id="cancelPickerBtn">Cancel</button>
          <button type="button" class="btn btn-sm btn-primary" id="confirmLocationBtn">
            <i class="fa-solid fa-check me-1"></i> Confirm Location
          </button>
        </div>
      `;

      // Add styles for the picker panel
      const style = document.createElement("style");
      style.textContent = `
        .location-picker-panel {
          position: absolute;
          top: 10px;
          right: 10px;
          width: 300px;
          background-color: rgba(33, 37, 41, 0.9);
          color: white;
          border-radius: 6px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
          z-index: 1000;
          overflow: hidden;
        }
        .location-picker-header {
          padding: 10px 15px;
          background-color: rgba(0, 0, 0, 0.2);
          font-weight: 500;
          display: flex;
          align-items: center;
        }
        .location-picker-header .btn-close {
          margin-left: auto;
          font-size: 0.7rem;
        }
        .location-picker-body {
          padding: 15px;
        }
        .location-picker-instructions {
          margin-top: 8px;
          font-size: 0.85rem;
          color: #adb5bd;
          text-align: center;
        }
        .location-picker-footer {
          padding: 10px 15px;
          background-color: rgba(0, 0, 0, 0.2);
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }
        .location-picker-active {
          cursor: crosshair !important;
        }
      `;
      document.head.appendChild(style);

      // Append panel to map container
      document.getElementById("map").appendChild(pickerPanel);

      // Add event listeners
      document
        .getElementById("closePickerBtn")
        .addEventListener("click", cancelLocationPicker);
      document
        .getElementById("cancelPickerBtn")
        .addEventListener("click", cancelLocationPicker);
      document
        .getElementById("confirmLocationBtn")
        .addEventListener("click", confirmLocation);

      // Update coordinates when inputs change
      document
        .getElementById("pickedLatitude")
        .addEventListener("change", updateMarkerFromInputs);
      document
        .getElementById("pickedLongitude")
        .addEventListener("change", updateMarkerFromInputs);
    }

    // Show the panel
    pickerPanel.style.display = "block";

    // Set coordinate inputs with initial values
    document.getElementById("pickedLatitude").value = latitude;
    document.getElementById("pickedLongitude").value = longitude;

    // Create marker for the current position
    const initialCoordinate = ol.proj.fromLonLat([
      parseFloat(longitude),
      parseFloat(latitude),
    ]);

    // Create a marker if it doesn't exist
    if (!locationMarker) {
      const markerFeature = new ol.Feature({
        geometry: new ol.geom.Point(initialCoordinate),
      });

      // Style for the marker
      const markerStyle = new ol.style.Style({
        image: new ol.style.Circle({
          radius: 8,
          fill: new ol.style.Fill({
            color: "#3B82F6",
          }),
          stroke: new ol.style.Stroke({
            color: "#ffffff",
            width: 2,
          }),
        }),
      });

      markerFeature.setStyle(markerStyle);

      // Create vector layer for the marker
      markerLayer = new ol.layer.Vector({
        source: new ol.source.Vector({
          features: [markerFeature],
        }),
        zIndex: 999, // Ensure it's on top
      });

      window.map.addLayer(markerLayer);
      locationMarker = markerFeature;
    } else {
      // Just update the position
      locationMarker.getGeometry().setCoordinates(initialCoordinate);
    }

    // Add click listener to the map
    locationPickerClickListener = window.map.on("click", function (event) {
      // Update marker position
      locationMarker.getGeometry().setCoordinates(event.coordinate);

      // Convert to lon/lat and update form inputs
      const lonLat = ol.proj.transform(
        event.coordinate,
        "EPSG:3857",
        "EPSG:4326"
      );
      document.getElementById("pickedLongitude").value = lonLat[0].toFixed(6);
      document.getElementById("pickedLatitude").value = lonLat[1].toFixed(6);
    });

    // Add crosshair cursor to map
    document.getElementById("map").classList.add("location-picker-active");

    // Center map on initial coordinate and zoom in if needed
    window.map.getView().animate({
      center: initialCoordinate,
      zoom: Math.max(window.map.getView().getZoom(), 12),
      duration: 500,
    });

    // Set active flag
    locationPickingActive = true;
  }

  // Update marker when coordinate inputs change
  function updateMarkerFromInputs() {
    try {
      const lat = parseFloat(document.getElementById("pickedLatitude").value);
      const lon = parseFloat(document.getElementById("pickedLongitude").value);

      if (!isNaN(lat) && !isNaN(lon) && locationMarker) {
        const coordinate = ol.proj.fromLonLat([lon, lat]);
        locationMarker.getGeometry().setCoordinates(coordinate);

        // Center the map on the new coordinates
        window.map.getView().animate({
          center: coordinate,
          duration: 300,
        });
      }
    } catch (error) {
      console.error("Error updating marker:", error);
    }
  }

  // Cancel location picking
  function cancelLocationPicker() {
    // This will now properly remove the marker
    cleanupLocationPicker();

    // Restore original map state
    if (originalCenter && originalZoom) {
      window.map.getView().animate({
        center: originalCenter,
        zoom: originalZoom,
        duration: 500,
      });
    }

    // Restore modals in the correct order
    if (sensorManagementModalInstance) {
      sensorManagementModalInstance.show();
    }

    setTimeout(() => {
      if (sensorModalInstance) {
        sensorModalInstance.show();
      }
    }, 50);
  }

  // Confirm location selection
  function confirmLocation() {
    const latitude = document.getElementById("pickedLatitude").value;
    const longitude = document.getElementById("pickedLongitude").value;

    // Set the coordinates in the form
    document.getElementById("latitude").value = latitude;
    document.getElementById("longitude").value = longitude;

    // Clean up (this will now properly remove the marker)
    cleanupLocationPicker();

    // Show success message
    showToast(
      "Location Updated",
      "Sensor location has been updated",
      "success"
    );

    // Restore modals in the correct order
    if (sensorManagementModalInstance) {
      sensorManagementModalInstance.show();
    }

    setTimeout(() => {
      if (sensorModalInstance) {
        sensorModalInstance.show();
      }
    }, 50);
  }

  // Clean up picker resources
  function cleanupLocationPicker() {
    // Hide the panel
    const pickerPanel = document.getElementById("locationPickerPanel");
    if (pickerPanel) {
      pickerPanel.style.display = "none";
    }

    // Remove click listener
    if (locationPickerClickListener) {
      ol.Observable.unByKey(locationPickerClickListener);
      locationPickerClickListener = null;
    }

    // Remove marker layer properly
    if (markerLayer) {
      window.map.removeLayer(markerLayer);
      markerLayer = null;
    }

    // Reset the marker reference
    locationMarker = null;

    // Remove crosshair cursor
    document.getElementById("map").classList.remove("location-picker-active");

    // Reset active flag
    locationPickingActive = false;
  }

  // Manage sensor types
  async function manageSensorTypes(sensorId) {
    try {
      manageSensorId = sensorId;

      // Get the sensor
      const sensor = await sensorModel.getSensor(sensorId);

      if (!sensor) {
        showAlert("Error", "Sensor not found");
        return;
      }

      // Update the modal with the sensor ID
      document.getElementById("typeMgmtSensorId").textContent = sensor.id;

      // Clear the types container
      const typesContainer = document.getElementById("currentTypesContainer");
      typesContainer.innerHTML = "";

      // Add the current types as badges
      if (sensor.types && sensor.types.length > 0) {
        sensor.types.forEach((type) => {
          const badgeClass = `badge-${type.toLowerCase()}`;
          const badge = document.createElement("div");
          badge.className = `badge sensor-type-badge ${badgeClass} p-2 d-flex align-items-center`;
          badge.innerHTML = `
            ${type}
            ${
              sensor.types.length > 1
                ? `
              <button type="button" class="btn-close btn-close-white ms-2" 
                style="font-size: 0.5rem;" data-type="${type}"></button>
            `
                : ""
            }
          `;
          typesContainer.appendChild(badge);
        });

        // Add event listeners to delete buttons
        typesContainer.querySelectorAll(".btn-close").forEach((btn) => {
          btn.addEventListener("click", () => {
            removeSensorType(btn.dataset.type);
          });
        });
      } else {
        typesContainer.innerHTML =
          '<div class="alert alert-warning small py-1">No types assigned</div>';
      }

      // Update the select element
      const typeSelect = document.getElementById("newTypeSelect");
      typeSelect.innerHTML =
        '<option value="">Select a type to add...</option>';

      // Add options for types that aren't already assigned
      // const allTypes = ["tide", "weather", "water", "pollution", "current"];
      const allTypes = ["tide"];
      const existingTypes = sensor.types.map((t) => t.toLowerCase());

      allTypes.forEach((type) => {
        if (!existingTypes.includes(type)) {
          typeSelect.innerHTML += `<option value="${type}">${
            type.charAt(0).toUpperCase() + type.slice(1)
          }</option>`;
        }
      });

      // Show the modal
      const typesModal = new bootstrap.Modal(
        document.getElementById("manageTypesModal")
      );
      typesModal.show();
    } catch (error) {
      showAlert("Error", `Failed to load sensor types: ${error.message}`);
    }
  }

  // Add a type to a sensor
  async function addSensorType() {
    if (!manageSensorId) return;

    const typeSelect = document.getElementById("newTypeSelect");
    const selectedType = typeSelect.value;

    if (!selectedType) {
      showToast("Warning", "Please select a type to add", "warning");
      return;
    }

    try {
      // Call API to add type
      await sensorModel.addSensorType(manageSensorId, selectedType);

      // Refresh the types display
      await manageSensorTypes(manageSensorId);

      // Show success message
      showToast("Success", `${selectedType} type added to sensor`, "success");

      // Reset the select
      typeSelect.value = "";
    } catch (error) {
      showAlert("Error", `Failed to add sensor type: ${error.message}`);
    }
  }

  // Remove a type from a sensor
  async function removeSensorType(typeToRemove) {
    if (!manageSensorId) return;

    try {
      // Call API to remove type
      await sensorModel.removeSensorType(manageSensorId, typeToRemove);

      // Refresh the types display
      await manageSensorTypes(manageSensorId);

      // Show success message
      showToast(
        "Success",
        `${typeToRemove} type removed from sensor`,
        "success"
      );
    } catch (error) {
      showAlert("Error", `Failed to remove sensor type: ${error.message}`);
    }
  }

  // View sensor details
  async function viewSensor(sensorId) {
    try {
      // Get sensor with trashed (to see deleted sensors too)
      const sensor = await sensorModel.getSensor(sensorId, true);

      if (!sensor) {
        showAlert("Error", "Sensor not found");
        return;
      }

      // Format date strings
      const createdAt = new Date(sensor.created_at).toLocaleString();
      const updatedAt = new Date(sensor.updated_at).toLocaleString();
      const deletedAt = sensor.deleted_at
        ? new Date(sensor.deleted_at).toLocaleString()
        : "N/A";

      // Format sensor types as badges
      let typesBadges = "";
      if (sensor.types && sensor.types.length > 0) {
        sensor.types.forEach((type) => {
          let badgeClass = `badge-${type.toLowerCase()}`;
          typesBadges += `<span class="badge sensor-type-badge ${badgeClass}">${type}</span>`;
        });
      } else {
        typesBadges = '<span class="badge bg-secondary">None</span>';
      }

      // Create status badge
      let statusBadge = sensor.deleted_at
        ? '<span class="badge bg-secondary">Deleted</span>'
        : sensor.connection_status === "Connected"
        ? '<span class="badge bg-success">Connected</span>'
        : '<span class="badge bg-danger">Disconnected</span>';

      // Format location
      const location =
        sensor.latitude && sensor.longitude
          ? `${sensor.latitude}, ${sensor.longitude}`
          : "Not set";

      // Format last update
      const lastUpdate = sensor.last_update
        ? new Date(sensor.last_update).toLocaleString()
        : "Never";

      // Populate details content - without Latest Data section
      const content = `
        <div class="p-4">
          <div class="row">
            <div class="col-md-6">
              <div class="card shadow-sm mb-4">
                <div class="card-header bg-light">
                  <h6 class="mb-0">
                    <i class="fa-solid fa-info-circle me-2"></i>
                    Basic Information
                  </h6>
                </div>
                <div class="card-body p-0">
                  <table class="table table-sm table-striped mb-0">
                    <tr>
                      <th class="ps-3">Sensor ID</th>
                      <td>${sensor.id}</td>
                    </tr>
                    <tr>
                      <th class="ps-3">Types</th>
                      <td>${typesBadges}</td>
                    </tr>
                    <tr>
                      <th class="ps-3">Location</th>
                      <td>${location}</td>
                    </tr>
                    <tr>
                      <th class="ps-3">Status</th>
                      <td>${statusBadge}</td>
                    </tr>
                    <tr>
                      <th class="ps-3">Last Update</th>
                      <td>${lastUpdate}</td>
                    </tr>
                  </table>
                </div>
              </div>
              
              <div class="card shadow-sm">
                <div class="card-header bg-light">
                  <h6 class="mb-0">
                    <i class="fa-solid fa-clock me-2"></i>
                    Timestamps
                  </h6>
                </div>
                <div class="card-body p-0">
                  <table class="table table-sm table-striped mb-0">
                    <tr>
                      <th class="ps-3">Created</th>
                      <td>${createdAt}</td>
                    </tr>
                    <tr>
                      <th class="ps-3">Updated</th>
                      <td>${updatedAt}</td>
                    </tr>
                    <tr>
                      <th class="ps-3">Deleted</th>
                      <td>${deletedAt}</td>
                    </tr>
                  </table>
                </div>
              </div>
            </div>
            
            <div class="col-md-6">
              <div class="card shadow-sm">
                <div class="card-header bg-light">
                  <h6 class="mb-0">
                    <i class="fa-solid fa-map-pin me-2"></i>
                    Location
                  </h6>
                </div>
                <div class="card-body">
                  ${
                    sensor.latitude && sensor.longitude
                      ? `
                      <div class="bg-light p-3 rounded text-center">
                        <!-- In a real implementation, this would be a map -->
                        <i class="fa-solid fa-map text-muted" style="font-size: 2rem;"></i>
                        <p class="mt-2 mb-0">
                          <strong>Latitude:</strong> ${sensor.latitude}<br>
                          <strong>Longitude:</strong> ${sensor.longitude}
                        </p>
                      </div>
                    `
                      : `
                      <div class="text-center py-4">
                        <i class="fa-solid fa-map-marker-slash text-muted" style="font-size: 2rem; opacity: 0.3;"></i>
                        <p class="mt-2 text-muted">No location set</p>
                      </div>
                    `
                  }
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      document.getElementById("sensorDetailsContent").innerHTML = content;

      // Show the modal
      const detailsModal = new bootstrap.Modal(
        document.getElementById("sensorDetailsModal")
      );
      detailsModal.show();
    } catch (error) {
      showAlert("Error", `Failed to load sensor details: ${error.message}`);
    }
  }

  // Edit sensor
  async function editSensor(sensorId) {
    try {
      // Get sensor data
      const sensor = await sensorModel.getSensor(sensorId);

      if (!sensor) {
        showAlert("Error", "Sensor not found");
        return;
      }

      // Reset form and set values
      resetForm();

      // Basic info
      document.getElementById("sensorId").value = sensor.id;
      document.getElementById("sensorId").disabled = true; // ID cannot be changed

      // Set type checkboxes
      if (sensor.types && sensor.types.length > 0) {
        sensor.types.forEach((type) => {
          const checkbox = document.getElementById(
            `type${type.charAt(0).toUpperCase() + type.slice(1)}`
          );
          if (checkbox) {
            checkbox.checked = true;
          }
        });
      }

      // Set location
      if (sensor.latitude) {
        document.getElementById("latitude").value = sensor.latitude;
      }

      if (sensor.longitude) {
        document.getElementById("longitude").value = sensor.longitude;
      }

      // Set modal state
      isEditMode = true;
      document.getElementById("sensorModalLabel").textContent = "Edit Sensor";

      // Show the modal
      const sensorModal = new bootstrap.Modal(
        document.getElementById("sensorModal")
      );
      sensorModal.show();
    } catch (error) {
      showAlert("Error", `Failed to load sensor for editing: ${error.message}`);
    }
  }

  // Confirm delete
  function confirmDelete(sensorId) {
    deleteSensorId = sensorId;
    const deleteModal = new bootstrap.Modal(
      document.getElementById("deleteConfirmModal")
    );
    deleteModal.show();
  }

  // Delete sensor
  async function deleteSensor() {
    if (!deleteSensorId) return;

    try {
      // Call API to delete sensor
      await sensorModel.deleteSensor(deleteSensorId);

      // Hide the modal
      const deleteModal = bootstrap.Modal.getInstance(
        document.getElementById("deleteConfirmModal")
      );
      deleteModal.hide();

      // Show success message using toast
      showToast("Success", "Sensor deleted successfully", "success");

      // Reload the sensor list
      await loadSensors();
    } catch (error) {
      showAlert("Error", `Failed to delete sensor: ${error.message}`);
    }
  }

  // Confirm restore
  function confirmRestore(sensorId) {
    restoreSensorId = sensorId;
    const restoreModal = new bootstrap.Modal(
      document.getElementById("restoreConfirmModal")
    );
    restoreModal.show();
  }

  // Restore sensor
  async function restoreSensor() {
    if (!restoreSensorId) return;

    try {
      // Call API to restore sensor
      await sensorModel.restoreSensor(restoreSensorId);

      // Hide the modal
      const restoreModal = bootstrap.Modal.getInstance(
        document.getElementById("restoreConfirmModal")
      );
      restoreModal.hide();

      // Show success message
      showToast("Success", "Sensor restored successfully", "success");

      // Reload the sensor list
      await loadSensors();
    } catch (error) {
      showAlert("Error", `Failed to restore sensor: ${error.message}`);
    }
  }

  // View sensor history
  function viewSensorHistory() {
    if (!historyViewSensorId) {
      showAlert("Error", "No sensor selected for history view");
      return;
    }

    // Reset the history inputs
    document.getElementById("historyStartDate").value = "";
    document.getElementById("historyEndDate").value = "";

    // Clear the history container
    document.getElementById("historyDataContainer").innerHTML = `
      <div class="text-center py-5">
        <i class="fa-solid fa-chart-simple text-muted" style="font-size: 4rem; opacity: 0.3;"></i>
        <h5 class="mt-3 text-muted">No history data loaded</h5>
        <p class="text-muted">Set the date range and click 'Fetch Data' to view sensor history</p>
      </div>
    `;

    // Show the history modal
    const historyModal = new bootstrap.Modal(
      document.getElementById("sensorHistoryModal")
    );
    historyModal.show();
  }

  // Fetch sensor history data
  async function fetchSensorHistory() {
    if (!historyViewSensorId) return;

    const startDate = document.getElementById("historyStartDate").value;
    const endDate = document.getElementById("historyEndDate").value;

    // Show loading indicator
    document.getElementById("historyDataContainer").innerHTML = `
      <div class="text-center py-5">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <p class="mt-2 text-muted">Fetching history data...</p>
      </div>
    `;

    try {
      // Call API to get history
      const historyData = await sensorModel.getSensorHistory(
        historyViewSensorId,
        startDate ? new Date(startDate) : null,
        endDate ? new Date(endDate) : null
      );

      if (!historyData || historyData.length === 0) {
        document.getElementById("historyDataContainer").innerHTML = `
          <div class="text-center py-5">
            <i class="fa-solid fa-exclamation-circle text-warning" style="font-size: 3rem;"></i>
            <h5 class="mt-3 text-muted">No data found</h5>
            <p class="text-muted">No sensor records found for the selected date range</p>
          </div>
        `;
        return;
      }

      // Create table with history data
      let tableHtml = `
        <div class="table-responsive">
          <table class="table table-striped table-hover">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Raw Data</th>
              </tr>
            </thead>
            <tbody>
      `;

      historyData.forEach((record) => {
        const timestamp = new Date(record.created_at).toLocaleString();
        tableHtml += `
          <tr>
            <td>${timestamp}</td>
            <td>
              <button class="btn btn-sm btn-outline-primary view-raw-data"
                data-record-id="${record.id}" data-raw-data="${record.raw_data}">
                View Data
              </button>
            </td>
          </tr>
        `;
      });

      tableHtml += `
            </tbody>
          </table>
        </div>
      `;

      document.getElementById("historyDataContainer").innerHTML = tableHtml;

      // Add event listeners to view raw data buttons
      document.querySelectorAll(".view-raw-data").forEach((btn) => {
        btn.addEventListener("click", () => {
          showAlert(
            "Raw Sensor Data",
            `<pre class="mt-3 bg-light p-3 rounded small">${btn.dataset.rawData}</pre>`,
            "info"
          );
        });
      });

      // Enable export button
      document.getElementById("exportHistoryBtn").disabled = false;
    } catch (error) {
      document.getElementById("historyDataContainer").innerHTML = `
        <div class="alert alert-danger">
          <h5>Error fetching history data</h5>
          <p>${error.message}</p>
        </div>
      `;
    }
  }

  // Export sensor history to CSV
  function exportSensorHistory() {
    if (!historyViewSensorId) return;

    // In a real implementation, you would call an API endpoint to generate a CSV
    // For this example, we'll just show a toast message
    showToast(
      "Export Started",
      "Your export is being processed and will download shortly",
      "info"
    );

    // Simulate a download after a short delay
    setTimeout(() => {
      showToast(
        "Export Complete",
        "Sensor history data has been exported",
        "success"
      );
    }, 2000);
  }

  // Add this to your code to better handle saving sensors
  async function saveSensor() {
    try {
      // Validate form
      if (!validateForm()) {
        return;
      }

      // Get form values and trim whitespace from the sensor ID
      const sensorId = document.getElementById("sensorId").value.trim();

      // Update the input value with the trimmed version
      document.getElementById("sensorId").value = sensorId;

      // Get selected types
      const types = [];
      document.querySelectorAll('input[name="types"]:checked').forEach((cb) => {
        types.push(cb.value);
      });

      const latitude = document.getElementById("latitude").value;
      const longitude = document.getElementById("longitude").value;

      // Prepare sensor data
      const sensorData = {
        id: sensorId,
        types: types,
        latitude: latitude,
        longitude: longitude,
      };

      // Log the data being sent (for debugging)
      console.log("Sending sensor data:", JSON.stringify(sensorData));

      // Save sensor
      if (isEditMode) {
        // Update existing sensor
        await sensorModel.updateSensor(sensorData.id, sensorData);
        showToast("Success", "Sensor updated successfully", "success");
      } else {
        // Create new sensor
        try {
          await sensorModel.createSensor(sensorData);
          showToast("Success", "Sensor created successfully", "success");
        } catch (createError) {
          // Enhanced error handling for create operation
          if (createError.message.includes("Sensor ID already exists")) {
            handleSensorIdError();
          } else {
            throw createError; // Re-throw for the outer catch block
          }
          return; // Stop execution if there was an error
        }
      }

      // Hide the modal
      const sensorModal = bootstrap.Modal.getInstance(
        document.getElementById("sensorModal")
      );
      sensorModal.hide();

      // Reload the sensor list
      await loadSensors();
    } catch (error) {
      console.error("Full error details:", error);

      // Better error display
      if (error.message.includes("Sensor ID already exists")) {
        handleSensorIdError();
      } else {
        showAlert("Error", `Failed to save sensor: ${error.message}`);
      }
    }
  }

  // Separate function to handle ID error consistently
  function handleSensorIdError() {
    document.getElementById("sensorId").classList.add("is-invalid");

    // Add or update the feedback element
    let feedbackEl = document.querySelector("#sensorId + .invalid-feedback");
    if (!feedbackEl) {
      feedbackEl = document.createElement("div");
      feedbackEl.className = "invalid-feedback";
      document.getElementById("sensorId").parentNode.appendChild(feedbackEl);
    }
    feedbackEl.textContent =
      "This sensor ID is already taken or is invalid. Please try a different format.";

    showToast(
      "Warning",
      "Sensor ID issue. Please use a different ID format.",
      "warning"
    );
  }

  // Validate form inputs
  function validateForm() {
    let isValid = true;

    // Validate sensor ID
    if (!document.getElementById("sensorId").value) {
      document.getElementById("sensorId").classList.add("is-invalid");
      isValid = false;
    } else {
      document.getElementById("sensorId").classList.remove("is-invalid");
    }

    // Validate that at least one type is selected
    const typeSelected = Array.from(
      document.querySelectorAll('input[name="types"]')
    ).some((cb) => cb.checked);

    if (!typeSelected) {
      document
        .getElementById("sensorTypeCheckboxes")
        .classList.add("border", "border-danger", "rounded");
      isValid = false;
    } else {
      document
        .getElementById("sensorTypeCheckboxes")
        .classList.remove("border", "border-danger", "rounded");
    }

    // Validate location format if provided
    const latitude = document.getElementById("latitude").value;
    const longitude = document.getElementById("longitude").value;

    if (
      latitude &&
      (isNaN(parseFloat(latitude)) ||
        parseFloat(latitude) < -90 ||
        parseFloat(latitude) > 90)
    ) {
      document.getElementById("latitude").classList.add("is-invalid");
      isValid = false;
    } else {
      document.getElementById("latitude").classList.remove("is-invalid");
    }

    if (
      longitude &&
      (isNaN(parseFloat(longitude)) ||
        parseFloat(longitude) < -180 ||
        parseFloat(longitude) > 180)
    ) {
      document.getElementById("longitude").classList.add("is-invalid");
      isValid = false;
    } else {
      document.getElementById("longitude").classList.remove("is-invalid");
    }

    // Show validation message if form is invalid
    if (!isValid) {
      showToast("Warning", "Please correct the highlighted fields", "warning");
    }

    return isValid;
  }

  // Show toast message
  function showToast(title, message, type = "info") {
    // Get the toast element
    const toastEl = document.getElementById("sensorToast");
    if (!toastEl) return;

    // Set toast content
    document.getElementById("toastTitle").textContent = title;
    document.getElementById("toastMessage").textContent = message;
    document.getElementById("toastTime").textContent =
      new Date().toLocaleTimeString();

    // Set toast type using Bootstrap classes
    const toastHeader = toastEl.querySelector(".toast-header");
    toastHeader.classList.remove(
      "bg-success",
      "bg-danger",
      "bg-warning",
      "bg-info"
    );
    const icon = toastHeader.querySelector("i");
    icon.classList.remove(
      "text-success",
      "text-danger",
      "text-warning",
      "text-info"
    );

    switch (type) {
      case "success":
        icon.className = "fa-solid fa-check-circle me-2 text-success";
        break;
      case "error":
        icon.className = "fa-solid fa-times-circle me-2 text-danger";
        break;
      case "warning":
        icon.className = "fa-solid fa-exclamation-triangle me-2 text-warning";
        break;
      default:
        icon.className = "fa-solid fa-info-circle me-2 text-info";
    }

    // Show the toast
    const toast = new bootstrap.Toast(toastEl, { autohide: true, delay: 3000 });
    toast.show();
  }

  // Show alert modal with improved styling
  function showAlert(title, message, type = "error") {
    const alertModal = document.getElementById("alertModal");
    const header = document.getElementById("alertModalHeader");
    const titleEl = document.getElementById("alertModalTitle");
    const body = document.getElementById("alertModalBody");

    // Set content
    titleEl.textContent = title;
    body.innerHTML = message;

    // Set styling based on type
    header.className = "modal-header";

    switch (type) {
      case "success":
        header.classList.add("bg-success", "text-white");
        titleEl.innerHTML =
          '<i class="fa-solid fa-check-circle me-2"></i>' + title;
        break;
      case "warning":
        header.classList.add("bg-warning", "text-dark");
        titleEl.innerHTML =
          '<i class="fa-solid fa-exclamation-triangle me-2"></i>' + title;
        break;
      case "info":
        header.classList.add("bg-info", "text-white");
        titleEl.innerHTML =
          '<i class="fa-solid fa-info-circle me-2"></i>' + title;
        break;
      case "error":
      default:
        header.classList.add("bg-danger", "text-white");
        titleEl.innerHTML =
          '<i class="fa-solid fa-times-circle me-2"></i>' + title;
    }

    const modal = new bootstrap.Modal(alertModal);
    modal.show();
  }
}
