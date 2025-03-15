import KapalApiModel from "./../models/kapal_api_model.js";

// Initialize the application when the DOM is ready
document.addEventListener("DOMContentLoaded", initVesselsDatatable);

export function initVesselsDatatable() {
  // Initialize Kapal API model
  const kapalModel = new KapalApiModel();

  // Current state variables
  let currentPage = 1;
  let itemsPerPage = 10;
  let totalItems = 0;
  let totalPages = 0;
  let vessels = [];
  let deleteCallSign = null;
  let restoreCallSign = null;
  let isEditMode = false;
  
  // File data
  let vesselImageFile = null;
  let vesselMapImageFile = null;

  // Initialize page
  initialize();

  // Initialize function
  async function initialize() {
    // Set up datalists for flag and class suggestions
    populateSuggestions();

    // Set up image file upload handlers
    setupImageUpload();

    // Load initial data
    await loadVessels();

    // Set up event handlers
    setupEventHandlers();

    // Handle empty state button
    document.getElementById('addEmptyStateBtn')?.addEventListener('click', function() {
      document.getElementById('addVesselBtn').click();
    });
    
    // Set up backdrop style for modals
    addModalBackdropStyle();
  }
  
  // Add custom modal backdrop styling
  function addModalBackdropStyle() {
    const style = document.createElement('style');
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
    `;
    document.head.appendChild(style);
  }

  // Set up image file upload handlers
  function setupImageUpload() {
    // Vessel image upload
    const imageFileInput = document.getElementById("imageFile");
    if (imageFileInput) {
      imageFileInput.addEventListener("change", function(event) {
        const file = event.target.files[0];
        if (file) {
          vesselImageFile = file;
          const reader = new FileReader();
          reader.onload = function(e) {
            // Update preview
            const preview = document.getElementById("imagePreview");
            preview.innerHTML = `<img src="${e.target.result}" alt="Vessel Preview" class="img-fluid" style="max-height: 150px;">`;
            
            // Store the base64 data in the hidden input for submission
            document.getElementById("image").value = e.target.result;
          };
          reader.readAsDataURL(file);
        }
      });
    }

    // Map image upload
    const imageMapFileInput = document.getElementById("imageMapFile");
    if (imageMapFileInput) {
      imageMapFileInput.addEventListener("change", function(event) {
        const file = event.target.files[0];
        if (file) {
          vesselMapImageFile = file;
          const reader = new FileReader();
          reader.onload = function(e) {
            // Update preview
            const preview = document.getElementById("imageMapPreview");
            preview.innerHTML = `<img src="${e.target.result}" alt="Map Preview" class="img-fluid" style="max-height: 150px;">`;
            
            // Store the base64 data in the hidden input for submission
            document.getElementById("imageMap").value = e.target.result;
          };
          reader.readAsDataURL(file);
        }
      });
    }
  }

  // Populate suggestions for flag and class
  function populateSuggestions() {
    // Flag suggestions
    const flagSuggestions = document.getElementById("flagSuggestions");
    if (flagSuggestions) {
      flagSuggestions.innerHTML = '';
      kapalModel.getCountryFlags().forEach((flag) => {
        const option = document.createElement("option");
        option.value = flag.value;
        flagSuggestions.appendChild(option);
      });
    }

    // Class suggestions
    const kelasSuggestions = document.getElementById("kelasSuggestions");
    if (kelasSuggestions) {
      kelasSuggestions.innerHTML = '';
      kapalModel.getVesselClasses().forEach((kelas) => {
        const option = document.createElement("option");
        option.value = kelas.value;
        kelasSuggestions.appendChild(option);
      });
    }
  }

  // Load vessels with current filters
  async function loadVessels() {
    try {
      // Show loading indicator
      document.getElementById("emptyState")?.classList.add("d-none");
      document.getElementById("loadingIndicator")?.classList.remove("d-none");
      document.getElementById("tableContainer")?.classList.add("d-none");
      
      document.querySelector("#vesselsTable tbody").innerHTML =
        '<tr><td colspan="8" class="text-center"><div class="spinner-border text-primary" role="status"></div></td></tr>';

      // Get filter values
      const flag = document.getElementById("filterFlag").value;
      const kelas = document.getElementById("filterClass").value;
      const recordStatus = document.getElementById("filterStatus").value;
      const withTrashed = document.getElementById("showDeletedVessel").checked;

      // Prepare query parameters
      const params = {
        page: currentPage,
        limit: itemsPerPage,
        with_trashed: withTrashed,
      };

      // Add filters if selected
      if (flag) params.flag = flag;
      if (kelas) params.kelas = kelas;
      if (recordStatus) params.record_status = recordStatus;

      // Fetch data
      const response = await kapalModel.fetchVessels(params);

      // Update state variables
      vessels = response.data;
      totalItems = response.meta.total;
      totalPages = response.meta.last_page;
      currentPage = response.meta.current_page;

      // Hide loading indicator
      document.getElementById("loadingIndicator")?.classList.add("d-none");
      
      // Show appropriate view based on data
      if (!vessels || vessels.length === 0) {
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
      
      showAlert("Error", `Failed to load vessels: ${error.message}`);
    }
  }

  // Render the vessels table
  function renderTable() {
    const tbody = document.querySelector("#vesselsTable tbody");

    // Clear existing rows
    tbody.innerHTML = "";

    // Check if no data
    if (!vessels || vessels.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="8" class="text-center">No vessels found</td></tr>';
      return;
    }

    // Create rows for each vessel
    vessels.forEach((vessel) => {
      const tr = document.createElement("tr");

      // Determine status badge
      let statusBadge = "";
      if (vessel.deleted_at) {
        statusBadge = '<span class="badge bg-secondary">Deleted</span>';
      } else {
        let badgeClass = vessel.record_status ? "bg-success" : "bg-danger";
        let status = vessel.record_status ? "Active" : "Inactive";
        statusBadge = `<span class="badge ${badgeClass}">${status}</span>`;
      }

      // Determine actions based on vessel status
      const isDeleted = vessel.deleted_at !== null;

      // Create action buttons
      const actionButtons = `
        <div class="btn-group" role="group">
          <button type="button" class="btn btn-sm btn-info view-btn" title="View Details" data-call-sign="${vessel.call_sign}">
            <i class="fa-solid fa-eye"></i>
          </button>
          ${
            !isDeleted
              ? `
            <button type="button" class="btn btn-sm btn-warning edit-btn" title="Edit Vessel" data-call-sign="${vessel.call_sign}">
              <i class="fa-solid fa-edit"></i>
            </button>
            <button type="button" class="btn btn-sm btn-danger delete-btn" title="Delete Vessel" data-call-sign="${vessel.call_sign}">
              <i class="fa-solid fa-trash"></i>
            </button>
          `
              : `
            <button type="button" class="btn btn-sm btn-success restore-btn" title="Restore Vessel" data-call-sign="${vessel.call_sign}">
              <i class="fa-solid fa-rotate-left"></i>
            </button>
          `
          }
        </div>
      `;

      // Set row HTML
      tr.innerHTML = `
        <td class="ps-3">${vessel.call_sign}</td>
        <td>${vessel.flag}</td>
        <td>${vessel.kelas}</td>
        <td>${vessel.builder}</td>
        <td>${vessel.year_built}</td>
        <td>${vessel.length_m}m × ${vessel.width_m}m</td>
        <td>${statusBadge}</td>
        <td class="text-end pe-3">${actionButtons}</td>
      `;

      tbody.appendChild(tr);
    });

    // Update pagination info
    const start = (currentPage - 1) * itemsPerPage + 1;
    const end = Math.min(start + vessels.length - 1, totalItems);
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
        loadVessels();
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
        loadVessels();
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
        loadVessels();
      }
    });
    pagination.appendChild(nextLi);
  }

  // Set up event handlers for page interactions
  function setupEventHandlers() {
    // Filter button click
    document.getElementById("applyFilters").addEventListener("click", () => {
      currentPage = 1; // Reset to first page when applying filters
      loadVessels();
    });

    // Filter input keypress events
    document.getElementById("filterFlag").addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        document.getElementById("applyFilters").click();
      }
    });

    document.getElementById("filterClass").addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        document.getElementById("applyFilters").click();
      }
    });

    // Show deleted checkbox change
    document.getElementById("showDeletedVessel").addEventListener("change", () => {
      currentPage = 1; // Reset to first page when toggling deleted
      loadVessels();
    });

    // Add vessel button
    document.getElementById("addVesselBtn").addEventListener("click", () => {
      resetForm();
      isEditMode = false;
      document.getElementById("vesselModalLabel").textContent = "Add New Vessel";
      document.getElementById("callSign").disabled = false;

      // Reset tab selection
      if (document.getElementById("basic-tab")) {
        const tab = new bootstrap.Tab(document.getElementById("basic-tab"));
        tab.show();
      }

      const vesselModal = new bootstrap.Modal(
        document.getElementById("vesselModal")
      );
      vesselModal.show();
    });

    // Save vessel button
    document
      .getElementById("saveVesselBtn")
      .addEventListener("click", saveVessel);

    // Table row action buttons
    document
      .querySelector("#vesselsTable tbody")
      .addEventListener("click", (e) => {
        // Find the closest button
        const button = e.target.closest("button");
        if (!button) return;

        // Get the call sign
        const callSign = button.dataset.callSign;

        // Handle different button actions
        if (button.classList.contains("view-btn")) {
          viewVessel(callSign);
        } else if (button.classList.contains("edit-btn")) {
          editVessel(callSign);
        } else if (button.classList.contains("delete-btn")) {
          confirmDelete(callSign);
        } else if (button.classList.contains("restore-btn")) {
          confirmRestore(callSign);
        }
      });

    // Delete confirmation
    document
      .getElementById("confirmDeleteBtn")
      .addEventListener("click", deleteVessel);

    // Restore confirmation
    document
      .getElementById("confirmRestoreBtn")
      .addEventListener("click", restoreVessel);
  }

  // Reset form fields
  function resetForm() {
    // Reset the form
    document.getElementById("vesselForm").reset();

    // Reset file inputs
    if (document.getElementById("imageFile")) {
      document.getElementById("imageFile").value = "";
    }
    if (document.getElementById("imageMapFile")) {
      document.getElementById("imageMapFile").value = "";
    }
    
    // Reset file variables
    vesselImageFile = null;
    vesselMapImageFile = null;

    // Reset radio buttons for status
    if (document.getElementById("statusActive")) {
      document.getElementById("statusActive").checked = true;
    }
    if (document.getElementById("statusInactive")) {
      document.getElementById("statusInactive").checked = false;
    }

    // Set default values
    document.getElementById("yearBuilt").value = new Date().getFullYear();
    document.getElementById("headingDirection").value = "0";
    document.getElementById("calibration").value = "0";
    document.getElementById("historyPerSecond").value = "1";
    document.getElementById("minKnotPerLiter").value = "0.8";
    document.getElementById("maxKnotPerLiter").value = "1.2";

    // Reset image previews
    document.getElementById("imagePreview").innerHTML = `
      <i class="fa-solid fa-ship text-muted" style="font-size: 3rem;"></i>
      <p class="small text-muted mt-2">Image preview will appear here</p>
    `;
    document.getElementById("imageMapPreview").innerHTML = `
      <i class="fa-solid fa-map text-muted" style="font-size: 3rem;"></i>
      <p class="small text-muted mt-2">Map image preview will appear here</p>
    `;

    // Clear hidden image inputs
    document.getElementById("image").value = "";
    document.getElementById("imageMap").value = "";
  }

  // View vessel details
  async function viewVessel(callSign) {
    try {
      // Get vessel with trashed (to see deleted vessels too)
      const vessel = await kapalModel.getVessel(callSign, true);

      if (!vessel) {
        showAlert("Error", "Vessel not found");
        return;
      }

      // Format date strings
      const createdAt = new Date(vessel.created_at).toLocaleString();
      const updatedAt = new Date(vessel.updated_at).toLocaleString();
      const deletedAt = vessel.deleted_at
        ? new Date(vessel.deleted_at).toLocaleString()
        : "N/A";

      // Create status badge
      let statusBadge = vessel.deleted_at
        ? '<span class="badge bg-secondary">Deleted</span>'
        : vessel.record_status
        ? '<span class="badge bg-success">Active</span>'
        : '<span class="badge bg-danger">Inactive</span>';

      // Populate details content
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
                      <th class="ps-3">Call Sign</th>
                      <td>${vessel.call_sign}</td>
                    </tr>
                    <tr>
                      <th class="ps-3">Flag</th>
                      <td>${vessel.flag}</td>
                    </tr>
                    <tr>
                      <th class="ps-3">Class</th>
                      <td>${vessel.kelas}</td>
                    </tr>
                    <tr>
                      <th class="ps-3">Builder</th>
                      <td>${vessel.builder}</td>
                    </tr>
                    <tr>
                      <th class="ps-3">Year Built</th>
                      <td>${vessel.year_built}</td>
                    </tr>
                    <tr>
                      <th class="ps-3">Status</th>
                      <td>${statusBadge}</td>
                    </tr>
                  </table>
                </div>
              </div>
              
              <div class="card shadow-sm">
                <div class="card-header bg-light">
                  <h6 class="mb-0">
                    <i class="fa-solid fa-ruler-combined me-2"></i>
                    Dimensions & Navigation
                  </h6>
                </div>
                <div class="card-body p-0">
                  <table class="table table-sm table-striped mb-0">
                    <tr>
                      <th class="ps-3">Length</th>
                      <td>${vessel.length_m} m</td>
                    </tr>
                    <tr>
                      <th class="ps-3">Width</th>
                      <td>${vessel.width_m} m</td>
                    </tr>
                    <tr>
                      <th class="ps-3">Bow to Stern</th>
                      <td>${vessel.bow_to_stern} m</td>
                    </tr>
                    <tr>
                      <th class="ps-3">Port to Starboard</th>
                      <td>${vessel.port_to_starboard} m</td>
                    </tr>
                    <tr>
                      <th class="ps-3">Heading Direction</th>
                      <td>${vessel.heading_direction}°</td>
                    </tr>
                    <tr>
                      <th class="ps-3">Calibration</th>
                      <td>${vessel.calibration}</td>
                    </tr>
                  </table>
                </div>
              </div>
            </div>
            
            <div class="col-md-6">
              <div class="card shadow-sm mb-4">
                <div class="card-header bg-light">
                  <h6 class="mb-0">
                    <i class="fa-solid fa-gauge-high me-2"></i>
                    Performance & Tracking
                  </h6>
                </div>
                <div class="card-body p-0">
                  <table class="table table-sm table-striped mb-0">
                    <tr>
                      <th class="ps-3">History Per Second</th>
                      <td>${vessel.history_per_second}</td>
                    </tr>
                    <tr>
                      <th class="ps-3">Min. Knot/Liter</th>
                      <td>${vessel.minimum_knot_per_liter_gasoline}</td>
                    </tr>
                    <tr>
                      <th class="ps-3">Max. Knot/Liter</th>
                      <td>${vessel.maximum_knot_per_liter_gasoline}</td>
                    </tr>
                  </table>
                </div>
              </div>
              
              <div class="card shadow-sm mb-4">
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
              
              <div class="card shadow-sm">
                <div class="card-header bg-light">
                  <h6 class="mb-0">
                    <i class="fa-solid fa-image me-2"></i>
                    Images
                  </h6>
                </div>
                <div class="card-body">
                  <div class="row">
                    <div class="col-md-6 mb-2">
                      <div class="text-center bg-light p-2 rounded border" style="height: 150px; display: flex; align-items: center; justify-content: center;">
                        ${
                          vessel.image
                            ? `<img src="${vessel.image}" alt="Vessel" class="img-fluid" style="max-height: 100%; max-width: 100%;">`
                            : `<i class="fa-solid fa-ship text-muted" style="font-size: 3rem;"></i>`
                        }
                      </div>
                      <div class="text-center mt-2">
                        <small class="text-muted">Vessel Image</small>
                      </div>
                    </div>
                    <div class="col-md-6 mb-2">
                      <div class="text-center bg-light p-2 rounded border" style="height: 150px; display: flex; align-items: center; justify-content: center;">
                        ${
                          vessel.image_map
                            ? `<img src="${vessel.image_map}" alt="Vessel Map" class="img-fluid" style="max-height: 100%; max-width: 100%;">`
                            : `<i class="fa-solid fa-map text-muted" style="font-size: 3rem;"></i>`
                        }
                      </div>
                      <div class="text-center mt-2">
                        <small class="text-muted">Vessel Map</small>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      document.getElementById("vesselDetailsContent").innerHTML = content;

      // Show the modal
      const detailsModal = new bootstrap.Modal(
        document.getElementById("vesselDetailsModal")
      );
      detailsModal.show();
    } catch (error) {
      showAlert("Error", `Failed to load vessel details: ${error.message}`);
    }
  }

  // Edit vessel
  async function editVessel(callSign) {
    try {
      // Get vessel data
      const vessel = await kapalModel.getVessel(callSign);

      if (!vessel) {
        showAlert("Error", "Vessel not found");
        return;
      }

      // Set form fields
      resetForm();

      // Set basic form values
      document.getElementById("callSign").value = vessel.call_sign;
      document.getElementById("callSign").disabled = true; // Call sign cannot be changed
      document.getElementById("flag").value = vessel.flag;
      document.getElementById("kelas").value = vessel.kelas;
      document.getElementById("builder").value = vessel.builder;
      document.getElementById("yearBuilt").value = vessel.year_built;
      
      // Set status radio buttons
      if (vessel.record_status) {
        document.getElementById("statusActive").checked = true;
        document.getElementById("statusInactive").checked = false;
      } else {
        document.getElementById("statusActive").checked = false;
        document.getElementById("statusInactive").checked = true;
      }

      // Set dimension values
      document.getElementById("lengthM").value = vessel.length_m;
      document.getElementById("widthM").value = vessel.width_m;
      document.getElementById("bowToStern").value = vessel.bow_to_stern;
      document.getElementById("portToStarboard").value =
        vessel.port_to_starboard;
      document.getElementById("headingDirection").value =
        vessel.heading_direction;
      document.getElementById("calibration").value = vessel.calibration;

      // Set performance values
      document.getElementById("historyPerSecond").value =
        vessel.history_per_second;
      document.getElementById("minKnotPerLiter").value =
        vessel.minimum_knot_per_liter_gasoline;
      document.getElementById("maxKnotPerLiter").value =
        vessel.maximum_knot_per_liter_gasoline;

      // Update image previews and hidden fields
      if (vessel.image) {
        document.getElementById("imagePreview").innerHTML = 
          `<img src="${vessel.image}" alt="Vessel Preview" class="img-fluid" style="max-height: 150px;">`;
        document.getElementById("image").value = vessel.image;
      }
      
      if (vessel.image_map) {
        document.getElementById("imageMapPreview").innerHTML = 
          `<img src="${vessel.image_map}" alt="Map Preview" class="img-fluid" style="max-height: 150px;">`;
        document.getElementById("imageMap").value = vessel.image_map;
      }

      // Set modal state
      isEditMode = true;
      document.getElementById("vesselModalLabel").textContent = "Edit Vessel";

      // Reset tab selection
      if (document.getElementById("basic-tab")) {
        const tab = new bootstrap.Tab(document.getElementById("basic-tab"));
        tab.show();
      }

      // Show the modal
      const vesselModal = new bootstrap.Modal(
        document.getElementById("vesselModal")
      );
      vesselModal.show();
    } catch (error) {
      showAlert("Error", `Failed to load vessel for editing: ${error.message}`);
    }
  }

  // Confirm delete
  function confirmDelete(callSign) {
    deleteCallSign = callSign;
    const deleteModal = new bootstrap.Modal(
      document.getElementById("deleteConfirmModal")
    );
    deleteModal.show();
  }

  // Delete vessel
  async function deleteVessel() {
    if (!deleteCallSign) return;

    try {
      // Call API to delete vessel
      await kapalModel.deleteVessel(deleteCallSign);

      // Hide the modal
      const deleteModal = bootstrap.Modal.getInstance(
        document.getElementById("deleteConfirmModal")
      );
      deleteModal.hide();

      // Show success message using toast
      showToast("Success", "Vessel deleted successfully", "success");

      // Reload the vessel list
      await loadVessels();
    } catch (error) {
      showAlert("Error", `Failed to delete vessel: ${error.message}`);
    }
  }

  // Confirm restore
  function confirmRestore(callSign) {
    restoreCallSign = callSign;
    const restoreModal = new bootstrap.Modal(
      document.getElementById("restoreConfirmModal")
    );
    restoreModal.show();
  }

  // Restore vessel
  async function restoreVessel() {
    if (!restoreCallSign) return;

    try {
      // Call API to restore vessel
      await kapalModel.restoreVessel(restoreCallSign);

      // Hide the modal
      const restoreModal = bootstrap.Modal.getInstance(
        document.getElementById("restoreConfirmModal")
      );
      restoreModal.hide();

      // Show success message
      showToast("Success", "Vessel restored successfully", "success");

      // Reload the vessel list
      await loadVessels();
    } catch (error) {
      showAlert("Error", `Failed to restore vessel: ${error.message}`);
    }
  }

  // Save vessel (create or update)
  async function saveVessel() {
    try {
      // Validate form
      if (!validateForm()) {
        return;
      }

      // Create form data object for API submission
      const formData = new FormData();
      
      // Get basic form values
      const callSign = document.getElementById("callSign").value;
      const flag = document.getElementById("flag").value;
      const kelas = document.getElementById("kelas").value;
      const builder = document.getElementById("builder").value;
      const yearBuilt = parseInt(document.getElementById("yearBuilt").value);
      const recordStatus = document.getElementById("statusActive").checked;
      
      // Get dimension values
      const lengthM = parseFloat(document.getElementById("lengthM").value);
      const widthM = parseFloat(document.getElementById("widthM").value);
      const bowToStern = parseFloat(document.getElementById("bowToStern").value);
      const portToStarboard = parseFloat(document.getElementById("portToStarboard").value);
      const headingDirection = parseInt(document.getElementById("headingDirection").value);
      const calibration = parseFloat(document.getElementById("calibration").value);
      
      // Get performance values
      const historyPerSecond = parseInt(document.getElementById("historyPerSecond").value);
      const minKnotPerLiter = parseFloat(document.getElementById("minKnotPerLiter").value);
      const maxKnotPerLiter = parseFloat(document.getElementById("maxKnotPerLiter").value);
      
      // Prepare vessel data object
      const vesselData = {
        call_sign: callSign,
        flag: flag,
        kelas: kelas,
        builder: builder,
        year_built: yearBuilt,
        heading_direction: headingDirection,
        calibration: calibration,
        width_m: widthM,
        length_m: lengthM,
        bow_to_stern: bowToStern,
        port_to_starboard: portToStarboard,
        history_per_second: historyPerSecond,
        minimum_knot_per_liter_gasoline: minKnotPerLiter,
        maximum_knot_per_liter_gasoline: maxKnotPerLiter,
        record_status: recordStatus ? "true" : "false"
      };
      
      // Add image data from hidden fields (base64 encoded)
      if (document.getElementById("image").value) {
        vesselData.image = document.getElementById("image").value;
      }
      
      if (document.getElementById("imageMap").value) {
        vesselData.image_map = document.getElementById("imageMap").value;
      }

      // Save vessel
      if (isEditMode) {
        // Update existing vessel
        await kapalModel.updateVessel(vesselData.call_sign, vesselData);
        showToast("Success", "Vessel updated successfully", "success");
      } else {
        // Create new vessel
        await kapalModel.createVessel(vesselData);
        showToast("Success", "Vessel created successfully", "success");
      }

      // Hide the modal
      const vesselModal = bootstrap.Modal.getInstance(
        document.getElementById("vesselModal")
      );
      vesselModal.hide();

      // Reload the vessel list
      await loadVessels();
    } catch (error) {
      showAlert("Error", `Failed to save vessel: ${error.message}`);
    }
  }

  // Validate form inputs
  function validateForm() {
    let isValid = true;
    
    // Basic info validation
    if (!document.getElementById("callSign").value) {
      document.getElementById("callSign").classList.add("is-invalid");
      isValid = false;
    } else {
      document.getElementById("callSign").classList.remove("is-invalid");
    }
    
    if (!document.getElementById("flag").value) {
      document.getElementById("flag").classList.add("is-invalid");
      isValid = false;
    } else {
      document.getElementById("flag").classList.remove("is-invalid");
    }
    
    if (!document.getElementById("kelas").value) {
      document.getElementById("kelas").classList.add("is-invalid");
      isValid = false;
    } else {
      document.getElementById("kelas").classList.remove("is-invalid");
    }
    
    if (!document.getElementById("builder").value) {
      document.getElementById("builder").classList.add("is-invalid");
      isValid = false;
    } else {
      document.getElementById("builder").classList.remove("is-invalid");
    }
    
    // Year built validation
    const yearBuilt = document.getElementById("yearBuilt");
    if (!yearBuilt.value || isNaN(parseInt(yearBuilt.value)) || 
        parseInt(yearBuilt.value) < 1900 || parseInt(yearBuilt.value) > 2100) {
      yearBuilt.classList.add("is-invalid");
      isValid = false;
    } else {
      yearBuilt.classList.remove("is-invalid");
    }
    
    // Dimensions validation
    const numericFields = [
      "lengthM",
      "widthM",
      "bowToStern",
      "portToStarboard",
      "headingDirection",
      "calibration",
      "historyPerSecond",
      "minKnotPerLiter",
      "maxKnotPerLiter"
    ];
    
    numericFields.forEach(fieldId => {
      const field = document.getElementById(fieldId);
      if (!field.value || isNaN(parseFloat(field.value))) {
        field.classList.add("is-invalid");
        isValid = false;
      } else {
        field.classList.remove("is-invalid");
        
        // Additional validation for specific fields
        if (fieldId === "headingDirection" && 
            (parseInt(field.value) < 0 || parseInt(field.value) > 359)) {
          field.classList.add("is-invalid");
          isValid = false;
        }
      }
    });
    
    // Image validation - only required for new vessels
    if (!isEditMode) {
      const image = document.getElementById("image").value;
      const imageMap = document.getElementById("imageMap").value;
      
      if (!image) {
        document.getElementById("imageFile").classList.add("is-invalid");
        isValid = false;
      } else {
        document.getElementById("imageFile").classList.remove("is-invalid");
      }
      
      if (!imageMap) {
        document.getElementById("imageMapFile").classList.add("is-invalid");
        isValid = false;
      } else {
        document.getElementById("imageMapFile").classList.remove("is-invalid");
      }
    }
    
    // Show validation message if form is invalid
    if (!isValid) {
      showToast("Warning", "Please correct the highlighted fields", "warning");
      
      // Switch to the first tab with validation errors
      const basicTab = document.getElementById("basic-tab");
      const dimensionsTab = document.getElementById("dimensions-tab");
      const performanceTab = document.getElementById("performance-tab");
      const imagesTab = document.getElementById("images-tab");
      
      const basicFields = ["callSign", "flag", "kelas", "builder", "yearBuilt"];
      const dimensionFields = ["lengthM", "widthM", "bowToStern", "portToStarboard", "headingDirection", "calibration"];
      const performanceFields = ["historyPerSecond", "minKnotPerLiter", "maxKnotPerLiter"];
      const imageFields = ["imageFile", "imageMapFile"];
      
      // Check which tab has errors and switch to it
      if (basicFields.some(id => document.getElementById(id).classList.contains("is-invalid"))) {
        new bootstrap.Tab(basicTab).show();
      } else if (dimensionFields.some(id => document.getElementById(id).classList.contains("is-invalid"))) {
        new bootstrap.Tab(dimensionsTab).show();
      } else if (performanceFields.some(id => document.getElementById(id).classList.contains("is-invalid"))) {
        new bootstrap.Tab(performanceTab).show();
      } else if (!isEditMode && imageFields.some(id => document.getElementById(id).classList.contains("is-invalid"))) {
        new bootstrap.Tab(imagesTab).show();
      }
    }
    
    return isValid;
  }

  // Show toast message - improved version
  function showToast(title, message, type = "info") {
    // Get the toast element
    const toastEl = document.getElementById("vesselToast");
    if (!toastEl) return;
    
    // Set toast content
    document.getElementById("toastTitle").textContent = title;
    document.getElementById("toastMessage").textContent = message;
    document.getElementById("toastTime").textContent = new Date().toLocaleTimeString();
    
    // Set toast type using Bootstrap classes
    const toastHeader = toastEl.querySelector(".toast-header");
    toastHeader.classList.remove("bg-success", "bg-danger", "bg-warning", "bg-info");
    const icon = toastHeader.querySelector("i");
    icon.classList.remove("text-success", "text-danger", "text-warning", "text-info");
    
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
    body.textContent = message;
    
    // Set styling based on type
    header.className = "modal-header";
    
    switch (type) {
      case "success":
        header.classList.add("bg-success", "text-white");
        titleEl.innerHTML = '<i class="fa-solid fa-check-circle me-2"></i>' + title;
        break;
      case "warning":
        header.classList.add("bg-warning", "text-dark");
        titleEl.innerHTML = '<i class="fa-solid fa-exclamation-triangle me-2"></i>' + title;
        break;
      case "error":
      default:
        header.classList.add("bg-danger", "text-white");
        titleEl.innerHTML = '<i class="fa-solid fa-times-circle me-2"></i>' + title;
    }
    
    const modal = new bootstrap.Modal(alertModal);
    modal.show();
  }
}