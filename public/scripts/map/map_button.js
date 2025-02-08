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
    top: 60px;
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
