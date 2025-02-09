class MeasurementTool {
  constructor(map) {
    this.map = map;
    this.active = false;
    this.source = new ol.source.Vector();
    this.segmentTooltips = [];
    this.currentPoint = null;

    this.layer = new ol.layer.Vector({
      source: this.source,
      style: this.createStyle(),
      zIndex: 999,
    });

    this.map.addLayer(this.layer);
    this.setupRightClick();
    this.createHistoryModal();
  }

  createStyle() {
    return new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: "#3B82F6",
        width: 3,
      }),
      image: new ol.style.Circle({
        radius: 6,
        fill: new ol.style.Fill({
          color: "#ffffff",
        }),
        stroke: new ol.style.Stroke({
          color: "#3B82F6",
          width: 2,
        }),
      }),
    });
  }

  createHistoryModal() {
    const modalHtml = `
      <div class="modal fade" id="measurementHistoryModal" tabindex="-1" aria-hidden="true">
          <div class="modal-dialog modal-measure">
              <div class="modal-content">
                  <div class="modal-header bg-dark text-white py-2">
                      <h6 class="modal-title">Measurement History</h6>
                      <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                  </div>
                  <div class="modal-body p-2">
                      <div id="measurementHistory" class="measurements-table mb-2">
                          <div class="list-group list-group-flush">
                              <div class="list-group-item text-center text-muted">
                                  No measurements yet
                              </div>
                          </div>
                      </div>
                      <div class="d-flex justify-content-between gap-2">
                          <button id="undoMeasure" class="btn btn-sm btn-outline-secondary" disabled>
                              <i class="bi bi-arrow-counterclockwise"></i> Undo Last Point
                          </button>
                          <button id="clearMeasure" class="btn btn-sm btn-outline-danger">
                              <i class="bi bi-trash"></i> Clear All
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      </div>`;

    document.body.insertAdjacentHTML("beforeend", modalHtml);

    // Initialize modal
    const modalElement = document.getElementById("measurementHistoryModal");
    this.modal = new bootstrap.Modal(modalElement, {
      backdrop: false,
      keyboard: false,
    });

    // Set up button handlers
    this.undoButton = document.getElementById("undoMeasure");
    this.clearButton = document.getElementById("clearMeasure");
    this.closeButton = modalElement.querySelector(".btn-close");

    this.undoButton.addEventListener("click", () => this.removeLastPoint());
    this.clearButton.addEventListener("click", () => {
      // this.clear();
      // this.updateHistoryPanel();
      // Find and update measure button state
      const measureButton = document.querySelector(".measure-button");
      if (measureButton) {
        measureButton.classList.remove("active");
      }
      // Deactivate and clear everything
      this.deactivate();
      this.clear();
      this.modal.hide();
    });

    // Handle modal close button
    this.closeButton.addEventListener("click", () => {
      // Find and update measure button state
      const measureButton = document.querySelector(".measure-button");
      if (measureButton) {
        measureButton.classList.remove("active");
      }
      // Deactivate and clear everything
      this.deactivate();
      this.clear();
      this.modal.hide();
    });

    // Handle modal hide event (when clicking outside or using Esc key)
    modalElement.addEventListener("hidden.bs.modal", () => {
      const measureButton = document.querySelector(".measure-button");
      if (measureButton) {
        measureButton.classList.remove("active");
      }
      this.deactivate();
      this.clear();
    });

    modalElement.addEventListener("mousedown", (e) => e.stopPropagation());
    modalElement.addEventListener("touchstart", (e) => e.stopPropagation());
  }

  updateHistoryPanel() {
    const historyDiv = document.getElementById("measurementHistory");
    if (!this.currentPoint) {
      historyDiv.innerHTML = `
          <div class="list-group list-group-flush">
              <div class="list-group-item text-center text-muted">
                  No measurements yet
              </div>
          </div>`;
      this.undoButton.disabled = true;
      return;
    }

    const coords = this.currentPoint.getGeometry().getCoordinates();
    if (coords.length < 2) {
      historyDiv.innerHTML = `
          <div class="list-group list-group-flush">
              <div class="list-group-item text-center text-muted">
                  Click to start measuring
              </div>
          </div>`;
      this.undoButton.disabled = true;
      return;
    }

    let html = '<div class="list-group list-group-flush">';
    let totalDistance = 0;

    // Add segments
    for (let i = 0; i < coords.length - 1; i++) {
      const segmentCoords = [coords[i], coords[i + 1]];
      const length = this.calculateLength(segmentCoords);
      totalDistance += length;
      html += `
          <div class="list-group-item d-flex justify-content-between align-items-center">
              <span class="text-muted">Segment ${i + 1}</span>
              <span class="badge bg-primary rounded-pill">${this.formatLength(
                length
              )}</span>
          </div>`;
    }

    // Add total
    if (coords.length > 2) {
      html += `
          <div class="list-group-item d-flex justify-content-between align-items-center bg-light">
              <strong>Total Distance</strong>
              <span class="badge bg-success rounded-pill">${this.formatLength(
                totalDistance
              )}</span>
          </div>`;
    }

    html += "</div>";
    historyDiv.innerHTML = html;
    this.undoButton.disabled = coords.length < 2;
  }

  setupRightClick() {
    this.map.getViewport().addEventListener("contextmenu", (evt) => {
      if (this.active) {
        evt.preventDefault();
        this.removeLastPoint();
      }
    });
  }

  createSegmentTooltip(position, text) {
    const tooltipElement = document.createElement("div");
    tooltipElement.className = "measurement-tooltip";
    tooltipElement.style.cssText = `
      position: relative;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      white-space: nowrap;
      pointer-events: none;
      transform: translate(-50%, -100%);
    `;
    tooltipElement.innerHTML = text;

    const tooltip = new ol.Overlay({
      element: tooltipElement,
      offset: [0, -15],
      position: position,
      positioning: "bottom-center",
    });

    this.map.addOverlay(tooltip);
    this.segmentTooltips.push(tooltip);
    return tooltip;
  }

  formatLength(length) {
    if (length > 1000) {
      return Math.round((length / 1000) * 100) / 100 + " km";
    }
    return Math.round(length) + " m";
  }

  calculateLength(coords) {
    const line = new ol.geom.LineString(coords);
    return ol.sphere.getLength(line);
  }

  removeLastPoint() {
    if (this.draw) {
      this.draw.removeLastPoint();
      this.updateMeasurements();
    }
  }

  updateMeasurements() {
    if (!this.currentPoint) return;

    const coords = this.currentPoint.getGeometry().getCoordinates();
    if (coords.length < 2) return;

    // Clear existing tooltips
    this.clearTooltips();

    // Add tooltips for each segment
    for (let i = 0; i < coords.length - 1; i++) {
      const segmentCoords = [coords[i], coords[i + 1]];
      const length = this.calculateLength(segmentCoords);
      const midpoint = [
        (coords[i][0] + coords[i + 1][0]) / 2,
        (coords[i][1] + coords[i + 1][1]) / 2,
      ];
      this.createSegmentTooltip(midpoint, this.formatLength(length));
    }

    // Add total distance tooltip at the last point
    if (coords.length > 2) {
      const totalLength = this.calculateLength(coords);
      this.createSegmentTooltip(
        coords[coords.length - 1],
        "Total: " + this.formatLength(totalLength)
      );
    }

    // Update history panel
    this.updateHistoryPanel();
  }

  clearTooltips() {
    this.segmentTooltips.forEach((tooltip) => {
      this.map.removeOverlay(tooltip);
    });
    this.segmentTooltips = [];
  }

  activate() {
    if (this.active) return;

    this.active = true;

    // Clear any existing features when activating
    if (!this.currentPoint) {
      this.source.clear();
      this.clearTooltips();
    }

    this.draw = new ol.interaction.Draw({
      source: this.source,
      type: "LineString",
      style: this.createStyle(),
      // Prevent finishing on double-click
      finishCondition: (event) => {
        // Never finish the line automatically
        return false;
      },
      // Handle all click events except double-click
      condition: (event) => {
        if (event.type === "dblclick") {
          event.preventDefault();
          return false;
        }
        return true;
      },
    });

    this.map.addInteraction(this.draw);

    // Modify draw start to check for existing features
    this.draw.on("drawstart", (evt) => {
      // If there's already a feature, abort and clear
      if (this.currentPoint) {
        this.draw.abortDrawing();
        this.source.clear();
        this.clearTooltips();
      }

      this.currentPoint = evt.feature;
      this.currentPoint.getGeometry().on("change", () => {
        this.updateMeasurements();
      });
    });

    this.draw.on("drawend", () => {
      if (this.currentPoint) {
        const coords = this.currentPoint.getGeometry().getCoordinates();
        if (coords.length >= 2) {
          this.updateMeasurements();
        }
      }
    });
  }

  deactivate() {
    if (!this.active) return;

    this.active = false;
    if (this.draw) {
      this.map.removeInteraction(this.draw);
      this.draw = null;
    }
    this.clearTooltips();
    this.source.clear();
    this.currentPoint = null;
    this.updateHistoryPanel();
  }

  toggle() {
    if (this.active) {
      this.deactivate();
      this.modal.hide();
    } else {
      this.clear();
      this.activate();
      this.modal.show();
    }
  }

  clear() {
    this.source.clear();
    this.clearTooltips();
    this.currentPoint = null;
    const historyDiv = document.getElementById("measurementHistory");
    if (historyDiv) {
      historyDiv.innerHTML = `
            <div class="list-group list-group-flush">
                <div class="list-group-item text-center text-muted">
                    No measurements yet
                </div>
            </div>`;
    }
    if (this.undoButton) {
      this.undoButton.disabled = true;
    }
  }
}
