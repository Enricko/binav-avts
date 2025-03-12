// public/scripts/management/overlay_management.js
import GeolayerApiModel from "../models/geolayer_api_model.js";

// Initialize the application when the DOM is ready
document.addEventListener("DOMContentLoaded", initGeolayersManagement);

export function initGeolayersManagement() {
  // Initialize Geolayer API model
  const geolayerModel = new GeolayerApiModel();

  // Current state variables
  let currentPage = 1;
  let itemsPerPage = 10;
  let totalItems = 0;
  let totalPages = 0;
  let geolayers = [];
  let deleteGeolayerId = null;
  let restoreGeolayerId = null;
  let isEditMode = false;
  let editingGeolayerId = null;

  // Initialize page
  initialize();

  // Initialize function
  async function initialize() {
    console.log("Initializing geolayer management...");

    // Set up event handlers
    setupEventHandlers();

    // Load initial data
    await loadGeolayers();

    // Handle empty state button
    document
      .getElementById("addEmptyStateBtn")
      ?.addEventListener("click", function () {
        document.getElementById("addGeolayerBtn").click();
      });
  }

  // Load geolayers with current filters
  async function loadGeolayers() {
    try {
      // Show loading indicator
      document.getElementById("emptyState")?.classList.add("d-none");
      document.getElementById("loadingIndicator")?.classList.remove("d-none");
      document.getElementById("tableContainer")?.classList.add("d-none");

      const tableBody = document.querySelector("#geolayersTable tbody");
      if (tableBody) {
        tableBody.innerHTML =
          '<tr><td colspan="6" class="text-center"><div class="spinner-border text-primary" role="status"></div></td></tr>';
      }

      // Get filter values
      const name = document.getElementById("filterName")?.value || "";
      const fileType = document.getElementById("filterFileType")?.value || "";
      const workspace = document.getElementById("filterWorkspace")?.value || "";
      const withTrashed =
        document.getElementById("showDeleted")?.checked || false;

      // Prepare query parameters
      const params = {
        page: currentPage,
        limit: itemsPerPage,
        with_trashed: withTrashed,
      };

      // Add filters if selected
      if (name) params.name = name;
      if (fileType) params.file_type = fileType;
      if (workspace) params.workspace = workspace;

      // Fetch data
      const response = await geolayerModel.fetchGeolayers(params);

      // Update state variables
      geolayers = response.data;
      totalItems = response.meta?.total || 0;
      totalPages = response.meta?.last_page || 1;
      currentPage = response.meta?.current_page || 1;

      // Hide loading indicator
      document.getElementById("loadingIndicator")?.classList.add("d-none");

      // Show appropriate view based on data
      if (!geolayers || geolayers.length === 0) {
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
      console.error("Error loading geolayers:", error);
      // Hide loading indicator
      document.getElementById("loadingIndicator")?.classList.add("d-none");

      showAlert("Error", `Failed to load geolayers: ${error.message}`);
    }
  }

  // Render the geolayers table
  function renderTable() {
    const tbody = document.querySelector("#geolayersTable tbody");
    if (!tbody) return;

    // Clear existing rows
    tbody.innerHTML = "";

    // Check if no data
    if (!geolayers || geolayers.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="6" class="text-center">No geolayers found</td></tr>';
      return;
    }

    // Create rows for each geolayer
    geolayers.forEach((geolayer) => {
      const tr = document.createElement("tr");

      // Format created date
      const createdDate = geolayer.created_at
        ? new Date(geolayer.created_at).toLocaleDateString()
        : "N/A";

      // Determine if deleted
      const isDeleted = geolayer.deleted_at !== null;

      // File type badge
      const fileTypeBadge = `<span class="badge bg-light text-dark">${
        geolayer.file_type || "N/A"
      }</span>`;

      // Create action buttons
      let actionButtons = "";

      if (isDeleted) {
        // For deleted geolayers
        actionButtons = `
          <div class="btn-group" role="group">
            <button type="button" class="btn btn-sm btn-success restore-btn" title="Restore Geolayer" data-id="${geolayer.id}">
              <i class="fa-solid fa-rotate-left"></i>
            </button>
          </div>
        `;
      } else {
        // For active geolayers
        actionButtons = `
          <div class="btn-group" role="group">
            <button type="button" class="btn btn-sm btn-primary view-btn" title="View Details" data-id="${geolayer.id}">
              <i class="fa-solid fa-eye"></i>
            </button>
            <button type="button" class="btn btn-sm btn-warning edit-btn" title="Edit Geolayer" data-id="${geolayer.id}">
              <i class="fa-solid fa-edit"></i>
            </button>
            <button type="button" class="btn btn-sm btn-danger delete-btn" title="Delete Geolayer" data-id="${geolayer.id}">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        `;
      }

      // Set row HTML
      tr.innerHTML = `
        <td class="ps-3">${
          isDeleted
            ? '<span class="badge bg-secondary me-1">Deleted</span>'
            : ""
        }${geolayer.name}</td>
        <td>${fileTypeBadge}</td>
        <td>${geolayer.workspace || "N/A"}</td>
        <td>${geolayer.layer_name || "N/A"}</td>
        <td>${createdDate}</td>
        <td class="text-end pe-3">${actionButtons}</td>
      `;

      tbody.appendChild(tr);
    });

    // Update pagination info
    const start = (currentPage - 1) * itemsPerPage + 1;
    const end = Math.min(start + geolayers.length - 1, totalItems);
    const paginationInfo = document.getElementById("pagination-info");
    if (paginationInfo) {
      paginationInfo.textContent = `Showing ${start} to ${end} of ${totalItems} entries`;
    }

    // Add event listeners to buttons
    setupTableEventHandlers();
  }

  // Setup table event handlers
  function setupTableEventHandlers() {
    // Get all action buttons in the table
    const viewButtons = document.querySelectorAll("#geolayersTable .view-btn");
    const editButtons = document.querySelectorAll("#geolayersTable .edit-btn");
    const deleteButtons = document.querySelectorAll(
      "#geolayersTable .delete-btn"
    );
    const restoreButtons = document.querySelectorAll(
      "#geolayersTable .restore-btn"
    );

    // Add event listeners to each button type
    viewButtons.forEach((button) => {
      button.addEventListener("click", function () {
        const id = parseInt(this.getAttribute("data-id"));
        viewGeolayer(id);
      });
    });

    editButtons.forEach((button) => {
      button.addEventListener("click", function () {
        const id = parseInt(this.getAttribute("data-id"));
        editGeolayer(id);
      });
    });

    deleteButtons.forEach((button) => {
      button.addEventListener("click", function () {
        const id = parseInt(this.getAttribute("data-id"));
        confirmDelete(id);
      });
    });

    restoreButtons.forEach((button) => {
      button.addEventListener("click", function () {
        const id = parseInt(this.getAttribute("data-id"));
        confirmRestore(id);
      });
    });
  }

  // Render pagination controls
  function renderPagination() {
    const pagination = document.getElementById("pagination-controls");
    if (!pagination) return;

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
        loadGeolayers();
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
        loadGeolayers();
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
        loadGeolayers();
      }
    });
    pagination.appendChild(nextLi);
  }

  // Set up event handlers
  function setupEventHandlers() {
    console.log("Setting up geolayer event handlers...");
    // Filter button click
    document.getElementById("applyFilters")?.addEventListener("click", () => {
      currentPage = 1; // Reset to first page when applying filters
      loadGeolayers();
    });

    // Filter input keypress events
    document.getElementById("filterName")?.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        document.getElementById("applyFilters").click();
      }
    });

    // Show deleted checkbox change
    document.getElementById("showDeleted")?.addEventListener("change", () => {
      currentPage = 1; // Reset to first page when toggling deleted
      loadGeolayers();
    });

    // Add geolayer button
    document.getElementById("addGeolayerBtn")?.addEventListener("click", () => {
      console.log("Add geolayer button clicked");
      resetForm();
      isEditMode = false;
      editingGeolayerId = null;
      document.getElementById("geolayerModalLabel").textContent =
        "Add New Geo Layer";

      const geolayerModal = new bootstrap.Modal(
        document.getElementById("geolayerModal")
      );
      geolayerModal.show();
    });

    // Save geolayer button
    document
      .getElementById("saveGeolayerBtn")
      ?.addEventListener("click", saveGeolayer);

    // Delete confirmation
    document
      .getElementById("confirmDeleteBtn")
      ?.addEventListener("click", deleteGeolayer);

    // Restore confirmation
    document
      .getElementById("confirmRestoreBtn")
      ?.addEventListener("click", restoreGeolayer);
  }

  // View geolayer details
  async function viewGeolayer(id) {
    try {
      // Get geolayer data
      const geolayer = await geolayerModel.getGeolayer(id);

      if (!geolayer) {
        showAlert("Error", "Geolayer not found");
        return;
      }

      // Set view fields
      document.getElementById("viewName").textContent = geolayer.name || "N/A";
      document.getElementById("viewLayerName").textContent =
        geolayer.layer_name || "N/A";
      document.getElementById("viewWorkspace").textContent =
        geolayer.workspace || "N/A";
      document.getElementById("viewStoreName").textContent =
        geolayer.store_name || "N/A";
      document.getElementById("viewFileType").textContent =
        geolayer.file_type || "N/A";
      document.getElementById("viewBbox").textContent = geolayer.bbox || "N/A";

      // Set download button URL
      const downloadBtn = document.getElementById("downloadFileBtn");
      if (downloadBtn && geolayer.file_path) {
        downloadBtn.href = geolayer.file_path;
        downloadBtn.classList.remove("d-none");
      } else if (downloadBtn) {
        downloadBtn.classList.add("d-none");
      }

      // Set WMS URLs if it's a geopackage
      if (geolayer.file_type === ".gpkg") {
        const baseUrl = window.location.origin;
        const wmsBaseUrl = `${baseUrl}/geoserver/${geolayer.workspace}/wms`;

        document.getElementById(
          "wmsCapabilities"
        ).value = `${wmsBaseUrl}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetCapabilities`;

        document.getElementById(
          "wmsGetMap"
        ).value = `${wmsBaseUrl}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=${geolayer.workspace}:${geolayer.layer_name}&STYLES=&FORMAT=image/png&TRANSPARENT=true&HEIGHT=256&WIDTH=256&SRS=EPSG:3857&BBOX={bbox}`;

        // Initialize map preview if geopackage
        initMapPreview(geolayer);
      }

      // Show the modal
      const viewModal = new bootstrap.Modal(
        document.getElementById("viewLayerModal")
      );
      viewModal.show();
    } catch (error) {
      showAlert("Error", `Failed to load geolayer details: ${error.message}`);
    }
  }

  // Initialize map preview
  function initMapPreview(geolayer) {
    if (!window.ol) {
      console.log("OpenLayers not loaded");
      return;
    }

    const mapElement = document.getElementById("previewMap");
    mapElement.innerHTML = "";

    if (geolayer.file_type !== ".gpkg") {
      mapElement.innerHTML =
        '<div class="alert alert-info m-2">Preview only available for GeoPackage files</div>';
      return;
    }

    // Get WMS URL
    const baseUrl = window.location.origin;
    const wmsUrl = `${baseUrl}/geoserver/${geolayer.workspace}/wms`;

    // Create map
    const map = new ol.Map({
      target: "previewMap",
      layers: [
        new ol.layer.Tile({
          source: new ol.source.OSM(),
        }),
        new ol.layer.Tile({
          source: new ol.source.TileWMS({
            url: wmsUrl,
            params: {
              LAYERS: `${geolayer.workspace}:${geolayer.layer_name}`,
              TILED: true,
            },
            serverType: "geoserver",
          }),
        }),
      ],
      view: new ol.View({
        center: ol.proj.fromLonLat([0, 0]),
        zoom: 2,
      }),
    });

    // Fit to extent if available (after a delay to ensure layer is loaded)
    setTimeout(() => {
      try {
        if (geolayer.bbox) {
          // Parse bbox format: minx,miny,maxx,maxy
          const bbox = geolayer.bbox.split(",").map(parseFloat);
          if (bbox.length === 4) {
            const extent = ol.proj.transformExtent(
              [bbox[0], bbox[1], bbox[2], bbox[3]],
              "EPSG:4326",
              "EPSG:3857"
            );
            map.getView().fit(extent, { padding: [50, 50, 50, 50] });
          }
        }
      } catch (error) {
        console.error("Error setting map extent:", error);
      }
    }, 500);
  }

  // Copy to clipboard utility
  function copyToClipboard(elementId) {
    const element = document.getElementById(elementId);
    element.select();
    document.execCommand("copy");

    // Show a temporary tooltip or message
    showToast("Success", "Copied to clipboard", "success");
  }
  window.copyToClipboard = copyToClipboard;

  // Reset form fields
  function resetForm() {
    // Reset the form
    const form = document.getElementById("geolayerForm");
    if (form) form.reset();

    // File is required for new geolayers
    const fileInput = document.getElementById("file");
    if (fileInput) {
      fileInput.setAttribute("required", "required");
    }

    // Reset progress bar
    const progressBar = document.querySelector("#uploadProgress .progress-bar");
    if (progressBar) {
      document.getElementById("uploadProgress").classList.add("d-none");
      progressBar.style.width = "0%";
    }
  }

  // Edit geolayer
  async function editGeolayer(id) {
    try {
      // Get geolayer data
      const geolayer = await geolayerModel.getGeolayer(id);

      if (!geolayer) {
        showAlert("Error", "Geolayer not found");
        return;
      }

      // Set form fields
      resetForm();

      document.getElementById("name").value = geolayer.name || "";
      document.getElementById("workspace").value =
        geolayer.workspace || "geolayers";

      // Don't require file upload for edit mode
      const fileInput = document.getElementById("file");
      if (fileInput) {
        fileInput.removeAttribute("required");
      }

      // Set modal state
      isEditMode = true;
      editingGeolayerId = id;
      document.getElementById("geolayerModalLabel").textContent =
        "Edit Geo Layer";

      // Show the modal
      const geolayerModal = new bootstrap.Modal(
        document.getElementById("geolayerModal")
      );
      geolayerModal.show();
    } catch (error) {
      showAlert(
        "Error",
        `Failed to load geolayer for editing: ${error.message}`
      );
    }
  }

  // Confirm delete
  function confirmDelete(id) {
    deleteGeolayerId = id;
    const deleteModal = new bootstrap.Modal(
      document.getElementById("deleteConfirmModal")
    );
    deleteModal.show();
  }

  // Delete geolayer
  async function deleteGeolayer() {
    if (!deleteGeolayerId) return;

    try {
      // Call API to delete geolayer
      await geolayerModel.deleteGeolayer(deleteGeolayerId);

      // Hide the modal
      const deleteModal = bootstrap.Modal.getInstance(
        document.getElementById("deleteConfirmModal")
      );
      deleteModal.hide();

      // Show success message
      showToast("Success", "Geolayer deleted successfully", "success");

      // Reload geolayers
      loadGeolayers();
    } catch (error) {
      showAlert("Error", `Failed to delete geolayer: ${error.message}`);
    }
  }

  // Confirm restore
  function confirmRestore(id) {
    restoreGeolayerId = id;
    const restoreModal = new bootstrap.Modal(
      document.getElementById("restoreConfirmModal")
    );
    restoreModal.show();
  }

  // Restore geolayer
  async function restoreGeolayer() {
    if (!restoreGeolayerId) return;

    try {
      // Call API to restore geolayer
      await geolayerModel.restoreGeolayer(restoreGeolayerId);

      // Hide the modal
      const restoreModal = bootstrap.Modal.getInstance(
        document.getElementById("restoreConfirmModal")
      );
      restoreModal.hide();

      // Show success message
      showToast("Success", "Geolayer restored successfully", "success");

      // Reload geolayers
      loadGeolayers();
    } catch (error) {
      showAlert("Error", `Failed to restore geolayer: ${error.message}`);
    }
  }

  // Save geolayer
  async function saveGeolayer() {
    try {
      console.log("Saving geolayer...");
      // Validate form
      const form = document.getElementById("geolayerForm");
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      // Get form data
      const name = document.getElementById("name").value;
      const workspace = document.getElementById("workspace").value;

      // Get file if provided
      const fileInput = document.getElementById("file");
      const file = fileInput.files.length > 0 ? fileInput.files[0] : null;

      // Check if file is required in create mode
      if (!isEditMode && !file) {
        showAlert("Validation Error", "Please select a file to upload");
        return;
      }

      // Prepare geolayer data
      const geolayerData = {
        name,
        workspace,
      };

      // Add file if provided
      if (file) {
        geolayerData.file = file;
      }

      // Show progress bar for large files
      const progressBar = document.querySelector(
        "#uploadProgress .progress-bar"
      );
      if (file && file.size > 5 * 1024 * 1024) {
        // 5MB threshold
        document.getElementById("uploadProgress").classList.remove("d-none");
        progressBar.style.width = "0%";
      }

      // Progress callback
      const updateProgress = (progress) => {
        if (progressBar) {
          progressBar.style.width = `${progress}%`;
        }
      };

      console.log("Geolayer data to save:", geolayerData);

      // Save geolayer
      if (isEditMode && editingGeolayerId) {
        // Update existing geolayer
        await geolayerModel.updateGeolayer(
          editingGeolayerId,
          geolayerData,
          updateProgress
        );
        showToast("Success", "Geolayer updated successfully", "success");
      } else {
        // Create new geolayer
        await geolayerModel.createGeolayer(geolayerData, updateProgress);
        showToast("Success", "Geolayer created successfully", "success");
      }

      // Hide the modal
      const geolayerModal = bootstrap.Modal.getInstance(
        document.getElementById("geolayerModal")
      );
      geolayerModal.hide();

      // Reload geolayers
      loadGeolayers();
    } catch (error) {
      showAlert("Error", `Failed to save geolayer: ${error.message}`);
    }
  }

  // Show toast message
  function showToast(title, message, type = "info") {
    // Get the toast element
    const toastEl = document.getElementById("geolayerToast");
    if (!toastEl) return;

    // Set toast content
    document.getElementById("toastTitle").textContent = title;
    document.getElementById("toastMessage").textContent = message;
    document.getElementById("toastTime").textContent =
      new Date().toLocaleTimeString();

    // Set toast type using Bootstrap classes
    const toastHeader = toastEl.querySelector(".toast-header");
    const icon = toastHeader.querySelector("i");
    icon.className = "fa-solid me-2 ";

    switch (type) {
      case "success":
        icon.className += "fa-check-circle text-success";
        break;
      case "error":
        icon.className += "fa-times-circle text-danger";
        break;
      case "warning":
        icon.className += "fa-exclamation-triangle text-warning";
        break;
      default:
        icon.className += "fa-info-circle text-info";
    }

    // Show the toast
    const toast = new bootstrap.Toast(toastEl, { autohide: true, delay: 3000 });
    toast.show();
  }

  // Show alert modal
  function showAlert(title, message) {
    console.error(`${title}: ${message}`);
    alert(`${title}: ${message}`);
  }
}
