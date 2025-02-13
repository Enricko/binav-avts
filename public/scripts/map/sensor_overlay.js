class SensorOverlay {
  constructor(map) {
    this.map = map;
    this.sensorOverlays = {};
    this.tooltipOverlay = null;
    this.setupTooltip();
    this.setupZoomHandler();
  }

  setupZoomHandler() {
    this.map.getView().on("change:resolution", () => {
      const zoom = this.map.getView().getZoom();
      this.updateVisibility(zoom);
    });
  }

  updateVisibility(zoom) {
    Object.values(this.sensorOverlays).forEach((overlay) => {
      const element = overlay.getElement();
      if (zoom >= 10 && zoom <= 20) {
        element.style.display = "block";
      } else {
        element.style.display = "none";
        // Hide tooltip when sensors are hidden
        this.hideTooltip();
      }
    });
  }

  setupTooltip() {
    const tooltipElement = document.createElement("div");
    tooltipElement.className = "sensor-tooltip";
    tooltipElement.style.cssText = `
        position: absolute;
        background: rgba(255, 255, 255, 0.95);
        padding: 12px;
        border-radius: 8px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        z-index: 1000;
        font-size: 13px;
        display: none;
        pointer-events: none;
        min-width: 220px;
        border-left: 4px solid #3B82F6;
        font-family: 'Arial', sans-serif;
      `;
    document.body.appendChild(tooltipElement);

    this.tooltipOverlay = new ol.Overlay({
      element: tooltipElement,
      positioning: "bottom-center",
      offset: [0, -10],
      stopEvent: false,
    });
    this.map.addOverlay(this.tooltipOverlay);
  }

  getTypeStyle(type) {
    const styles = {
      tide: {
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
                  <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
                  <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
                </svg>`,
        color: "#3B82F6",
        label: "Tide Gauge",
      },
      // Add more types here as needed
    };
    return styles[type] || styles.tide; // Default to tide style if type not found
  }

  // Add this to SensorOverlay class

  createSensorElement(sensor) {
    const element = document.createElement("div");
    element.className = "sensor-marker";
    const typeStyle = this.getTypeStyle(sensor.types[0]);

    element.style.cssText = `
    width: 32px;
    height: 32px;
    position: absolute;
    transform: translate(-50%, -50%);
    cursor: pointer;
    transition: all 0.3s ease;
  `;

    element.innerHTML = `
    <div style="
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: ${typeStyle.color};
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      transition: all 0.3s ease;
      color: white;
    ">
      ${typeStyle.icon}
    </div>
    <div style="
      position: absolute;
      bottom: -4px;
      right: -4px;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background-color: ${
        sensor.connection_status === "Connected" ? "#10B981" : "#EF4444"
      };
      border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    "></div>
  `;

    // Mouse events
    element.addEventListener("mouseenter", () => {
      const markerDiv = element.querySelector("div");
      markerDiv.style.transform = "scale(1.1)";
      markerDiv.style.boxShadow = "0 4px 6px rgba(0,0,0,0.3)";
      this.showTooltip(sensor);
    });

    element.addEventListener("mouseleave", () => {
      const markerDiv = element.querySelector("div");
      markerDiv.style.transform = "scale(1)";
      markerDiv.style.boxShadow = "0 2px 4px rgba(0,0,0,0.2)";
      this.hideTooltip();
    });

    // Double click handler
    element.addEventListener("dblclick", (evt) => {
      evt.stopPropagation();
      evt.preventDefault();
      const searchInput = document.querySelector(".search-input");
      if (searchInput) {
        searchInput.value = sensor.websocketKey;
      }

      detailOverlay.showSensorDetails(sensor);

      const coordinate = ol.proj.fromLonLat([
        parseFloat(sensor.longitude),
        parseFloat(sensor.latitude),
      ]);

      this.map.getView().animate({
        center: coordinate,
        zoom: 18,
        duration: 1000,
      });

      // Pulse animation
      const pulseElement = document.createElement("div");
      pulseElement.style.cssText = `
      position: absolute;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: rgba(59, 130, 246, 0.3);
      animation: pulse 1s ease-out;
      pointer-events: none;
      transform: translate(-50%, -50%);
    `;

      const pulseOverlay = new ol.Overlay({
        element: pulseElement,
        position: coordinate,
        positioning: "center-center",
      });

      this.map.addOverlay(pulseOverlay);
      setTimeout(() => this.map.removeOverlay(pulseOverlay), 1000);
    });

    return element;
  }

  // addDoubleClickHandler(element, sensor) {
  //   element.addEventListener("dblclick", (evt) => {
  //     console.log("Double click event");
  //     evt.stopPropagation();
  //     evt.preventDefault();

  //     const markerDiv = element.querySelector("div");
  //     if (!markerDiv) return;

  //     // Get current zoom level
  //     const zoom = this.map.getView().getZoom();
  //     if (zoom < 10 || zoom > 20) return;

  //     const coordinate = ol.proj.fromLonLat([
  //       parseFloat(sensor.longitude),
  //       parseFloat(sensor.latitude),
  //     ]);

  //     this.map.getView().animate({
  //       center: coordinate,
  //       zoom: 18,
  //       duration: 1000,
  //     });

  //     // Create pulse animation
  //     const pulseElement = document.createElement("div");
  //     pulseElement.style.cssText = `
  //       position: absolute;
  //       width: 40px;
  //       height: 40px;
  //       border-radius: 50%;
  //       background: rgba(59, 130, 246, 0.3);
  //       animation: pulse 1s ease-out;
  //       pointer-events: none;
  //       transform: translate(-50%, -50%);
  //     `;

  //     const pulseOverlay = new ol.Overlay({
  //       element: pulseElement,
  //       position: coordinate,
  //       positioning: "center-center",
  //     });

  //     this.map.addOverlay(pulseOverlay);
  //     setTimeout(() => this.map.removeOverlay(pulseOverlay), 1000);
  //   });
  // }

  showTooltip(sensor) {
    const tooltipElement = this.tooltipOverlay.getElement();
    tooltipElement.style.display = "block";
    const typeStyle = this.getTypeStyle(sensor.types[0]);

    const tideHeightMatch = sensor.raw_data.match(
      /TIDE HEIGHT: ([\+\-]\d+\.\d+)/
    );
    const tideHeight = tideHeightMatch ? tideHeightMatch[1] : "N/A";
    const timestamp = new Date(sensor.last_update).toLocaleString();

    tooltipElement.style.borderLeftColor = typeStyle.color;
    tooltipElement.innerHTML = `
        <div style="color: #1F2937;">
          <div style="display: flex; align-items: center; margin-bottom: 8px; gap: 8px;">
            <div style="
              width: 24px;
              height: 24px;
              border-radius: 50%;
              background: ${typeStyle.color};
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
            ">${typeStyle.icon}</div>
            <div>
              <div style="font-weight: bold; font-size: 14px;">${
                typeStyle.label
              } - ${sensor.id}</div>
              <div style="font-size: 11px; color: #6B7280;">${timestamp}</div>
            </div>
          </div>
          
          <div style="
            background: #F3F4F6;
            padding: 8px;
            border-radius: 4px;
            margin: 8px 0;
            font-size: 13px;
          ">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span>Height:</span>
              <span style="font-weight: bold;">${tideHeight} m</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>Status:</span>
              <span style="
                color: ${
                  sensor.connection_status === "Connected"
                    ? "#10B981"
                    : "#EF4444"
                };
                font-weight: bold;
              ">${sensor.connection_status}</span>
            </div>
          </div>
          
          <div style="
            font-size: 11px;
            color: #6B7280;
            display: flex;
            gap: 8px;
          ">
            <span>Lat: ${parseFloat(sensor.latitude).toFixed(6)}°</span>
            <span>Lon: ${parseFloat(sensor.longitude).toFixed(6)}°</span>
          </div>
        </div>
    `;

    const coordinate = ol.proj.fromLonLat([
      parseFloat(sensor.longitude),
      parseFloat(sensor.latitude),
    ]);
    this.tooltipOverlay.setPosition(coordinate);
  }

  hideTooltip() {
    const tooltipElement = this.tooltipOverlay.getElement();
    tooltipElement.style.display = "none";
  }

  updateSensors(sensors) {
    Object.entries(sensors).forEach(([sensorId, sensor]) => {
      try {
        // Validate coordinates
        if (
          !this.isValidLatitude(sensor.latitude) ||
          !this.isValidLongitude(sensor.longitude)
        ) {
          // console.error(`Invalid coordinates for sensor ${sensorId}:`, {
          //   latitude: sensor.latitude,
          //   longitude: sensor.longitude,
          // });
          return; // Skip this sensor
        }

        const position = ol.proj.fromLonLat([
          parseFloat(sensor.longitude),
          parseFloat(sensor.latitude),
        ]);

        sensor.websocketKey = sensorId;

        if (!this.sensorOverlays[sensorId]) {
          const element = this.createSensorElement(sensor);
          const overlay = new ol.Overlay({
            element: element,
            position: position,
            positioning: "center-center",
            stopEvent: false,
          });

          const zoom = this.map.getView().getZoom();
          element.style.display = zoom >= 10 && zoom <= 20 ? "block" : "none";

          this.sensorOverlays[sensorId] = overlay;
          this.map.addOverlay(overlay);
        } else {
          this.sensorOverlays[sensorId].setPosition(position);
        }
      } catch (error) {
        console.error(`Error processing sensor ${sensorId}:`, error);
      }
    });
  }

  destroy() {
    Object.values(this.sensorOverlays).forEach((overlay) => {
      this.map.removeOverlay(overlay);
    });

    if (this.tooltipOverlay) {
      this.map.removeOverlay(this.tooltipOverlay);
      const tooltipElement = this.tooltipOverlay.getElement();
      if (tooltipElement && tooltipElement.parentNode) {
        tooltipElement.parentNode.removeChild(tooltipElement);
      }
    }
  }

  isValidLatitude(lat) {
    const latitude = parseFloat(lat);
    return !isNaN(latitude) && latitude >= -90 && latitude <= 90;
  }

  isValidLongitude(lon) {
    const longitude = parseFloat(lon);
    return !isNaN(longitude) && longitude >= -180 && longitude <= 180;
  }
}
