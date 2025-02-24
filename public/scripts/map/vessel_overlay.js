class VesselOverlay {
  constructor(map, options) {
    this.map = map;
    this.position = options.position;
    this.width = options.width || 10;
    this.height = options.height || 20;
    this.rotationAngle = options.rotationAngle || 0;
    this.status = options.status || "Unknown";
    this.device = options.device;
    this.imageUrl = options.imageUrl || "/storage/vessel_map/default.png"; // Set default path
    this.speed = options.speed;
    this.waterDepth = options.waterDepth;
    this.gpsQuality = options.gpsQuality;
    this.imageLoaded = false;

    this.loadImage()
      .then(() => {
        this.createLayer();
      })
      .catch((error) => {
        console.error("Failed to load vessel image:", error);
        this.createLayer(); // Will use fallback style if image not loaded
      });
  }

  loadImage() {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.imageLoaded = true;
        resolve(img);
      };
      img.onerror = () => {
        reject(new Error("Failed to load image"));
      };
      img.src = this.imageUrl;
    });
  }

  createLayer() {
    this.layer = new ol.layer.Vector({
      source: new ol.source.Vector(),
      style: (feature) => this.createVesselStyle(feature),
      zIndex: 999,
      updateWhileAnimating: true,
      updateWhileInteracting: true,
    });

    this.feature = new ol.Feature({
      geometry: new ol.geom.Point(ol.proj.fromLonLat(this.position)),
    });

    this.layer.getSource().addFeature(this.feature);
    this.map.addLayer(this.layer);

    this.addHoverInteraction();
    this.addDoubleClickInteraction();

    this.map.getView().on(["change:resolution", "change:center"], () => {
      this.layer.changed();
    });
  }

  metersToPixels(meters, latitude) {
    const view = this.map.getView();
    const zoom = view.getZoom();
    return (
      meters /
      ((156543.03392 * Math.cos((latitude * Math.PI) / 180)) /
        Math.pow(2, zoom))
    );
  }

  calculateRealWorldScale() {
    const latitude = this.position[1];
    const widthInPixels = this.metersToPixels(this.width, latitude);
    const baseIconSize = 20;
    return widthInPixels / baseIconSize;
  }

  createVesselStyle(feature) {
    const scale = this.calculateRealWorldScale();
    const statusColor =
      this.status === "Connected"
        ? [0, 255, 0, 0.3] // Green with 0.3 opacity
        : [255, 0, 0, 0.3]; // Red with 0.3 opacity

    if (this.imageLoaded) {
      return new ol.style.Style({
        image: new ol.style.Icon({
          src: this.imageUrl,
          scale: scale,
          rotation: (this.rotationAngle * Math.PI) / 180,
          anchor: [0.5, 0.5],
          anchorXUnits: "fraction",
          anchorYUnits: "fraction",
          color: statusColor,
        }),
        text: this.createLabel(scale),
      });
    } else {
      // Fallback to triangle shape if image fails to load
      return new ol.style.Style({
        image: new ol.style.RegularShape({
          points: 3,
          radius: 10 * scale,
          rotation: (this.rotationAngle * Math.PI) / 180,
          fill: new ol.style.Fill({
            color:
              this.status === "Connected" ? [0, 255, 0, 1] : [255, 0, 0, 1],
          }),
          stroke: new ol.style.Stroke({ color: "#ffffff", width: 2 }),
        }),
        text: this.createLabel(scale),
      });
    }
  }

  createFallbackStyle(feature) {
    const scale = this.calculateRealWorldScale();
    const statusColor =
      this.status === "Connected"
        ? [0, 255, 0, 1] // Green with 0.3 opacity for Connected
        : [255, 0, 0, 1]; // Red with 0.3 opacity for Disconnected

    return new ol.style.Style({
      image: new ol.style.RegularShape({
        points: 3,
        radius: 10 * scale,
        rotation: (this.rotationAngle * Math.PI) / 180,
        fill: new ol.style.Fill({ color: statusColor }),
        stroke: new ol.style.Stroke({ color: "#ffffff", width: 2 }),
      }),
      text: this.createLabel(scale),
    });
  }

  createLabel(scale) {
    const view = this.map.getView();
    const zoom = view.getZoom();

    if (zoom > 13) {
      const fontSize = Math.max(14 * (scale * 0.8), 12);
      return new ol.style.Text({
        text: this.device,
        offsetY: -(this.height * scale) / 2 - 10,
        fill: new ol.style.Fill({ color: "#000000" }),
        stroke: new ol.style.Stroke({ color: "#ffffff", width: 3 }),
        font: `${fontSize}px sans-serif`,
      });
    }
    return null;
  }

  addHoverInteraction() {
    const tooltipElement = document.createElement("div");
    tooltipElement.className = "vessel-tooltip";
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
      min-width: 250px;
      border-left: 4px solid #2563EB;
      font-family: 'Arial', sans-serif;
    `;

    const tooltip = new ol.Overlay({
      element: tooltipElement,
      positioning: "bottom-center",
      offset: [0, -10],
      stopEvent: false,
    });

    this.map.addOverlay(tooltip);

    this.map.on("pointermove", (evt) => {
      const pixel = this.map.getEventPixel(evt.originalEvent);
      const hit = this.map.hasFeatureAtPixel(pixel, {
        layerFilter: (layer) => layer === this.layer,
      });

      if (hit) {
        const coordinate = evt.coordinate;
        tooltipElement.innerHTML = this.createTooltipContent();
        tooltipElement.style.display = "block";
        tooltip.setPosition(coordinate);
      } else {
        tooltipElement.style.display = "none";
      }
    });
  }

  addDoubleClickInteraction() {
    this.map.on("dblclick", (evt) => {
      const pixel = this.map.getEventPixel(evt.originalEvent);
      const hit = this.map.hasFeatureAtPixel(pixel, {
        layerFilter: (layer) => layer === this.layer,
        hitTolerance: 5,
      });

      if (hit) {
        evt.stopPropagation();
        evt.preventDefault();

        const feature = this.layer
          .getSource()
          .getClosestFeatureToCoordinate(evt.coordinate);

        if (feature === this.feature) {
          // Update search input if exists
          const searchInput = document.querySelector(".search-input");
          if (searchInput) {
            searchInput.value = this.device;
          }

          // Show vessel details using the global vesselDetail instance
          vesselDetail.showVesselDetails(wsData.navigation[this.device]);

          // Zoom to vessel
          this.zoomToVessel();

          // Create pulse animation
          const element = document.createElement("div");
          element.className = "pulse-animation";
          element.style.cssText = `
            position: absolute;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: rgba(37, 99, 235, 0.3);
            animation: pulse 1s ease-out;
            pointer-events: none;
            transform: translate(-50%, -50%);
          `;

          const pulseOverlay = new ol.Overlay({
            element: element,
            position: evt.coordinate,
            positioning: "center-center",
          });

          this.map.addOverlay(pulseOverlay);
          setTimeout(() => this.map.removeOverlay(pulseOverlay), 1000);
        }
      }
    });
  }

  createTooltipContent() {
    const timestamp = new Date().toLocaleString();
    return `
      <div style="color: #1F2937;">
        <div style="display: flex; align-items: center; margin-bottom: 8px; gap: 8px;">
          <div style="
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: #2563EB;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
          ">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 8c0 4-6 10-6 10s-6-6-6-10a6 6 0 0 1 12 0"/>
              <circle cx="12" cy="8" r="2"/>
            </svg>
          </div>
          <div>
            <div style="font-weight: bold; font-size: 14px;">${
              this.device
            }</div>
            <div style="font-size: 11px; color: #6B7280;">${timestamp}</div>
          </div>
        </div>

        <div style="
          background: #F3F4F6;
          padding: 8px;
          border-radius: 4px;
          margin: 8px 0;
          font-size: 13px;
          display: grid;
          gap: 4px;
        ">
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #6B7280;">Heading</span>
            <span style="font-weight: 500;">${this.rotationAngle.toFixed(
              1
            )}°</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #6B7280;">Speed</span>
            <span style="font-weight: 500;">${this.speed || "0"} knots</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #6B7280;">Water Depth</span>
            <span style="font-weight: 500;">${
              this.waterDepth || "0"
            } meters</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #6B7280;">GPS Quality</span>
            <span style="font-weight: 500;">${
              this.gpsQuality || "RTK Fixed"
            }</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #6B7280;">Status</span>
            <span style="color: ${
              this.status === "Connected" ? "#10B981" : "#EF4444"
            }; font-weight: 500;">
              ${this.status || "Disconnected"}
            </span>
          </div>
        </div>

        <div style="
          display: flex;
          gap: 8px;
          font-size: 11px;
          color: #6B7280;
        ">
          <span>Lat: ${this.position[1].toFixed(6)}°S</span>
          <span>Lon: ${this.position[0].toFixed(6)}°E</span>
        </div>
      </div>
    `;
  }

  zoomToVessel() {
    this.map.getView().animate({
      center: ol.proj.fromLonLat(this.position),
      zoom: 18,
      duration: 1000,
    });
  }

  update(options) {
    if (!this.layer) return;

    if (options.position) {
      this.position = options.position;
      this.feature.setGeometry(
        new ol.geom.Point(ol.proj.fromLonLat(this.position))
      );
    }
    if (options.width !== undefined) this.width = options.width;
    if (options.height !== undefined) this.height = options.height;
    if (options.rotationAngle !== undefined)
      this.rotationAngle = options.rotationAngle;
    if (options.status) this.status = options.status;
    if (options.speed) this.speed = options.speed;
    if (options.waterDepth) this.waterDepth = options.waterDepth;
    if (options.gpsQuality) this.gpsQuality = options.gpsQuality;

    this.layer.changed();
  }

  remove() {
    if (this.layer) {
      this.map.removeLayer(this.layer);
    }
  }
}
class AnimatedVesselOverlay extends VesselOverlay {
  constructor(map, options) {
    super(map, options);
    this.baseAnimationDuration = 1000; // Base duration for 1x speed
    this.currentAnimation = null;
  }

  update(options) {
    if (!this.layer) return;

    const startPosition = [...this.position];
    const startRotation = this.rotationAngle;

    // Update static properties
    if (options.status) this.status = options.status;
    if (options.speed) this.speed = options.speed;
    if (options.waterDepth) this.waterDepth = options.waterDepth;
    if (options.gpsQuality) this.gpsQuality = options.gpsQuality;

    // Cancel any ongoing animation
    if (this.currentAnimation) {
      cancelAnimationFrame(this.currentAnimation);
    }

    if (options.position) {
      const endPosition = options.position;
      const endRotation =
        options.rotationAngle !== undefined
          ? options.rotationAngle
          : this.rotationAngle;

      // Calculate animation duration based on playback speed
      const playbackSpeed = options.playbackSpeed || 1;
      const animationDuration = this.baseAnimationDuration / playbackSpeed;

      const startTime = performance.now();

      const animate = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / animationDuration, 1);

        // Linear interpolation instead of easing for more accurate tracking
        this.position = [
          startPosition[0] + (endPosition[0] - startPosition[0]) * progress,
          startPosition[1] + (endPosition[1] - startPosition[1]) * progress,
        ];

        this.rotationAngle =
          startRotation + (endRotation - startRotation) * progress;

        this.feature.setGeometry(
          new ol.geom.Point(ol.proj.fromLonLat(this.position))
        );
        this.layer.changed();

        if (progress < 1) {
          this.currentAnimation = requestAnimationFrame(animate);
        }
      };

      this.currentAnimation = requestAnimationFrame(animate);
    }
  }

  remove() {
    if (this.currentAnimation) {
      cancelAnimationFrame(this.currentAnimation);
    }
    super.remove();
  }
}
