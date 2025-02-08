class VesselOverlay {
    constructor(map, options) {
      this.map = map;
      this.position = options.position;
      this.width = options.width || 10;
      this.height = options.height || 20;
      this.rotationAngle = options.rotationAngle || 0;
      this.status = options.status || "Unknown";
      this.device = options.device;
      this.imageUrl = options.imageUrl;
      this.imageDisplayUrl = options.imageDisplayUrl;
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
          this.createLayerWithFallback();
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
  
      return new ol.style.Style({
        image: new ol.style.Icon({
          src: this.imageUrl,
          scale: scale,
          rotation: (this.rotationAngle * Math.PI) / 180,
          anchor: [0.5, 0.5],
          anchorXUnits: "fraction",
          anchorYUnits: "fraction",
          crossOrigin: "anonymous",
        }),
        text: this.createLabel(scale),
      });
    }
  
    createFallbackStyle(feature) {
      const scale = this.calculateRealWorldScale();
  
      return new ol.style.Style({
        image: new ol.style.RegularShape({
          points: 3,
          radius: 10 * scale,
          rotation: (this.rotationAngle * Math.PI) / 180,
          fill: new ol.style.Fill({ color: "#ff0000" }),
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
          stroke: new ol.style.Stroke({
            color: "#ffffff",
            width: 3,
          }),
          font: `${fontSize}px sans-serif`,
        });
      }
      return null;
    }
  
    addHoverInteraction() {
      const tooltipElement = document.createElement("div");
      tooltipElement.className = "vessel-tooltip";
      tooltipElement.style.cssText = `
        display: none;
        position: absolute;
        background: rgba(0, 0, 0, 0.85);
        padding: 15px;
        border-radius: 4px;
        font-family: sans-serif;
        font-size: 12px;
        color: white;
        pointer-events: none;
        z-index: 1000;
        min-width: 200px;
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
  
    createTooltipContent() {
      return `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
          <div style="font-size: 14px;">${this.device}</div>
          <img src="${this.imageDisplayUrl}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px;" />
        </div>
        <div style="display: grid; gap: 5px;">
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #aaa;">Latitude:</span>
            <span>${this.position[1].toFixed(4)}°S</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #aaa;">Longitude:</span>
            <span>${this.position[0].toFixed(4)}°E</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #aaa;">Heading:</span>
            <span>${this.rotationAngle.toFixed(1)}°</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #aaa;">Speed:</span>
            <span>${this.speed || "0"} knots</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #aaa;">Water Depth:</span>
            <span>${this.waterDepth || "0"} meters</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #aaa;">GPS Quality:</span>
            <span>${this.gpsQuality || "RTK Fixed"}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #aaa;">Status:</span>
            <span style="color: ${this.status === "Connected" ? "#4CAF50" : "#f44336"}">
              ${this.status || "Disconnected"}
            </span>
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
      if (options.rotationAngle !== undefined) this.rotationAngle = options.rotationAngle;
      if (options.status) this.status = options.status;
      if (options.speed) this.speed = options.speed;
      if (options.waterDepth) this.waterDepth = options.waterDepth;
      if (options.gpsQuality) this.gpsQuality = options.gpsQuality;
      if (options.imageUrl && options.imageUrl !== this.imageUrl) {
        this.imageUrl = options.imageUrl;
        this.loadImage();
      }
  
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
      this.animationDuration = 1000;
      this.currentAnimation = null;
    }
  
    update(options) {
      if (!this.layer) return;
  
      const startPosition = [...this.position];
      const startRotation = this.rotationAngle;
  
      if (options.status) this.status = options.status;
      if (options.speed) this.speed = options.speed;
      if (options.waterDepth) this.waterDepth = options.waterDepth;
      if (options.gpsQuality) this.gpsQuality = options.gpsQuality;
  
      if (this.currentAnimation) {
        cancelAnimationFrame(this.currentAnimation);
      }
  
      if (options.position) {
        const endPosition = options.position;
        const endRotation = options.rotationAngle !== undefined ? 
          options.rotationAngle : this.rotationAngle;
  
        const startTime = performance.now();
  
        const animate = (currentTime) => {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / this.animationDuration, 1);
          const eased = progress < 0.5 
            ? 2 * progress * progress 
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;
  
          this.position = [
            startPosition[0] + (endPosition[0] - startPosition[0]) * eased,
            startPosition[1] + (endPosition[1] - startPosition[1]) * eased
          ];
  
          this.rotationAngle = startRotation + (endRotation - startRotation) * eased;
  
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
  