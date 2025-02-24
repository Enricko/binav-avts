class VesselDetail extends BaseDetail {
  constructor() {
    super("vessel");
    this.historyData = [];
    this.isPlaying = false;
    this.playbackSpeed = 1;
    this.currentPlaybackIndex = 0;
    this.currentVessel = null;
    this.trackLayer = null;
    this.vesselOverlay = null;
    this.filterInterval = 1; // Default 1 second
  }

  // Add method to create track layer
  createTrackLayer() {
    if (this.trackLayer) {
      window.map.removeLayer(this.trackLayer);
    }

    this.trackLayer = new ol.layer.Vector({
      source: new ol.source.Vector(),
      zIndex: 998,
    });

    window.map.addLayer(this.trackLayer);
  }

  createTrackStyle(status) {
    return new ol.style.Style({
      stroke: new ol.style.Stroke({
        color:
          status === "Connected"
            ? [16, 185, 129, 0.8] // Green with 0.8 opacity
            : [239, 68, 68, 0.8], // Red with 0.8 opacity
        width: 4,
        lineCap: "round",
        lineJoin: "round",
      }),
    });
  }

  // Add method to update track visualization
  updateTrackVisualization(historicalData) {
    if (!this.trackLayer) {
      this.createTrackLayer();
    }

    this.trackLayer.getSource().clear();

    // Create segments based on status changes
    let segments = [];
    let currentSegment = {
      coordinates: [],
      status: historicalData[0]?.telnet_status,
    };

    historicalData.forEach((record, index) => {
      const coord = [record.longitude, record.latitude];

      // If status changes or it's the last point
      if (
        record.telnet_status !== currentSegment.status ||
        index === historicalData.length - 1
      ) {
        // Add the current point to finish the current segment
        currentSegment.coordinates.push(coord);
        segments.push({ ...currentSegment });

        // Start new segment with current point
        currentSegment = {
          coordinates: [coord],
          status: record.telnet_status,
        };
      } else {
        currentSegment.coordinates.push(coord);
      }
    });

    // Create features for each segment
    segments.forEach((segment) => {
      if (segment.coordinates.length > 1) {
        const projectedCoords = segment.coordinates.map((coord) =>
          ol.proj.fromLonLat(coord)
        );

        const segmentFeature = new ol.Feature({
          geometry: new ol.geom.LineString(projectedCoords),
        });

        segmentFeature.setStyle(this.createTrackStyle(segment.status));
        this.trackLayer.getSource().addFeature(segmentFeature);
      }
    });

    // Fit map view to track extent
    const extent = this.trackLayer.getSource().getExtent();
    window.map.getView().fit(extent, {
      padding: [50, 50, 50, 50],
      duration: 1000,
    });
  }

  // Helper function to parse DMS coordinates
  parseDMSToDecimal(dmsStr) {
    const matches = dmsStr.match(/(\d+)°(\d+\.\d+)°([NSEW])/);
    if (!matches) return null;

    const degrees = parseInt(matches[1]);
    const minutes = parseFloat(matches[2]);
    const direction = matches[3];

    let decimal = degrees + minutes / 60;
    if (direction === "S" || direction === "W") {
      decimal = -decimal;
    }

    return decimal;
  }

  formatDecimalToDMS(decimal, isLatitude) {
    const absolute = Math.abs(decimal);
    const degrees = Math.floor(absolute);
    const minutesNotTruncated = (absolute - degrees) * 60;
    const minutes = minutesNotTruncated.toFixed(4);

    let direction = "";
    if (isLatitude) {
      direction = decimal >= 0 ? "N" : "S";
    } else {
      direction = decimal >= 0 ? "E" : "W";
    }

    return `${degrees}°${minutes}'${direction}`;
  }

  showVesselDetails(vessel) {
    this.currentVessel = vessel;

    if (!this.vesselOverlay) {
      this.vesselOverlay = new AnimatedVesselOverlay(window.map, {
        position: [
          vessel.telemetry.longitude_decimal, // Use decimal coordinates
          vessel.telemetry.latitude_decimal,
        ],
        device: vessel.call_sign,
        status: vessel.telemetry.telnet_status,
        rotationAngle: vessel.telemetry.heading_degree,
        speed: vessel.telemetry.speed_in_knots,
        imageUrl: vessel.vessel.vessel_map_image, // Use vessel map image
      });
    }

    this.setTitle(`Vessel Details - ${vessel.call_sign}`);
    const content = this.modal.querySelector(".detail-content");

    // Format current position coordinates
    const currentLat = this.formatDecimalToDMS(vessel.telemetry.latitude, true);
    const currentLon = this.formatDecimalToDMS(
      vessel.telemetry.longitude,
      false
    );
    content.innerHTML = `
      <div class="detail-section">
      <div class="detail-row">
        <span class="detail-label">Call Sign</span>
        <span class="detail-value">${vessel.call_sign}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Flag</span>
        <span class="detail-value">${vessel.vessel.flag}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Class</span>
        <span class="detail-value">${vessel.vessel.kelas}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Builder</span>
        <span class="detail-value">${vessel.vessel.builder}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Year Built</span>
        <span class="detail-value">${vessel.vessel.year_built}</span>
      </div>
    </div>
      
      <!-- Current Data Section -->
       <div class="detail-section">
     <div class="section-header">Current Position</div>
      <div class="detail-row">
        <span class="detail-label">Latitude</span>
        <span class="detail-value" id="currentLatitude">${currentLon}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Longitude</span>
        <span class="detail-value" id="currentLongitude">${currentLat}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Speed</span>
        <span class="detail-value" id="currentSpeed">${
          vessel.telemetry.speed_in_knots
        } knots</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Heading</span>
        <span class="detail-value" id="currentHeading">${
          vessel.telemetry.heading_degree
        }°</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">GPS Quality</span>
        <span class="detail-value" id="currentGPS">${
          vessel.telemetry.gps_quality_indicator
        }</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Status</span>
        <span class="detail-value" id="currentStatus" style="color: ${
          vessel.telemetry.telnet_status === "Connected" ? "#10B981" : "#EF4444"
        }">${vessel.telemetry.telnet_status}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Water Depth</span>
        <span class="detail-value" id="currentWaterDepth">${
          vessel.telemetry.water_depth
        } m</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Last Update</span>
        <span class="detail-value" id="currentTime">${
          vessel.telemetry.last_update
        }</span>
      </div>
    </div>
  
      <!-- History Section -->
      <div class="history-section">
        <div class="section-header">Historical Data</div>
        <div class="date-inputs">
          <input type="datetime-local" class="date-input" id="vesselStartDate">
          <input type="datetime-local" class="date-input" id="vesselEndDate">
        </div>
        <div class="filter-row">
          <div class="interval-control">
            <select class="interval-select" id="intervalSelect">
              <optgroup label="Seconds">
                <option value="1">Every Second</option>
                <option value="3">Every 3 Seconds</option>
                <option value="5">Every 5 Seconds</option>
                <option value="10">Every 10 Seconds</option>
                <option value="15">Every 15 Seconds</option>
                <option value="30">Every 30 Seconds</option>
              </optgroup>
              <optgroup label="Minutes">
                <option value="60">Every Minute</option>
                <option value="180">Every 3 Minutes</option>
                <option value="300">Every 5 Minutes</option>
                <option value="600">Every 10 Minutes</option>
                <option value="900">Every 15 Minutes</option>
                <option value="1800">Every 30 Minutes</option>
                <option value="3600">Every Hour</option>
              </optgroup>
            </select>
          </div>
          <button class="fetch-button" id="fetchVesselHistory">
            Fetch History
          </button>
        </div>
         <div class="download-row">
          <div class="download-control">
            <select class="download-select" id="downloadFormat">
              <option value="csv">CSV</option>
              <option value="excel">Excel</option>
            </select>
          </div>
          <button class="download-button" id="downloadHistory" disabled>
            Download History
          </button>
        </div>
        
        <!-- Historical Data Display -->
        <div class="detail-section history-data">
          <div class="detail-row">
            <span class="detail-label">Latitude</span>
            <span class="detail-value" id="historyLatitude">-</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Longitude</span>
            <span class="detail-value" id="historyLongitude">-</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Heading</span>
            <span class="detail-value" id="historyHeading">-</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Speed</span>
            <span class="detail-value" id="historySpeed">-</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Water Depth</span>
            <span class="detail-value" id="historyWaterDepth">-</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Status</span>
            <span class="detail-value" id="historyStatus">-</span>
          </div>
        </div>

        <!-- Timestamp Display -->
        <div class="timestamp-display">
          <span class="detail-label">Historical Time:</span>
          <span id="currentTimestamp" class="detail-value">-</span>
        </div>
        
        <!-- Playback Controls -->
        <div class="vessel-controls">
          <button class="playback-button" id="playButton" disabled>
            <i class="bi bi-play-fill"></i>
            <span>Play</span>
          </button>
          
          <div class="speed-control">
            <label>Speed:</label>
            <select class="speed-select" id="speedSelect">
              <option value="1">1x</option>
              <option value="2">2x</option>
              <option value="4">4x</option>
              <option value="8">8x</option>
              <option value="10">10x</option>
            </select>
          </div>
          
          <div class="timeline" id="timeline">
            <div class="timeline-progress"></div>
            <div class="timeline-handle"></div>
          </div>
        </div>
      </div>
    `;

    this.setupVesselHistoryControls();
    this.show();
  }

  // Update setupVesselHistoryControls method in VesselDetail class
  setupVesselHistoryControls() {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 1);

    const vesselStartDate = document.getElementById("vesselStartDate");
    const vesselEndDate = document.getElementById("vesselEndDate");
    const intervalSelect = document.getElementById("intervalSelect");
    const fetchButton = document.getElementById("fetchVesselHistory");
    const playButton = document.getElementById("playButton");
    const speedSelect = document.getElementById("speedSelect");
    const timeline = document.getElementById("timeline");
    const downloadButton = document.getElementById("downloadHistory");
    const downloadFormat = document.getElementById("downloadFormat");

    vesselStartDate.value = startDate.toISOString().slice(0, 16);
    vesselEndDate.value = endDate.toISOString().slice(0, 16);

    // Setup event listeners
    fetchButton.addEventListener("click", () => this.fetchVesselHistory());
    playButton.addEventListener("click", () => this.togglePlayback());
    speedSelect.addEventListener("change", (e) => {
      this.playbackSpeed = parseFloat(e.target.value);
    });
    intervalSelect.addEventListener("change", (e) => {
      this.filterInterval = parseInt(e.target.value);
    });
    downloadButton.addEventListener("click", () => {
      const format = downloadFormat.value;
      this.downloadHistory(format);
    });
    // Timeline drag functionality
    let isDragging = false;

    const updateTimelineFromEvent = (e) => {
      if (!this.historyData?.length) return;

      const rect = timeline.getBoundingClientRect();
      let position = (e.clientX - rect.left) / rect.width;
      position = Math.max(0, Math.min(1, position));

      this.seekToPosition(position);
    };

    // Click on timeline
    timeline.addEventListener("click", (e) => {
      if (!this.historyData?.length) return;
      updateTimelineFromEvent(e);
    });

    // Mouse down on timeline or handle
    timeline.addEventListener("mousedown", (e) => {
      if (!this.historyData?.length) return;
      isDragging = true;
      document.body.style.userSelect = "none"; // Prevent text selection while dragging

      // Store the initial playback state
      const wasPlaying = this.isPlaying;
      if (wasPlaying) {
        this.togglePlayback(); // Pause if playing
      }

      const handleDrag = (moveEvent) => {
        if (isDragging) {
          updateTimelineFromEvent(moveEvent);
        }
      };

      const stopDrag = () => {
        isDragging = false;
        document.body.style.userSelect = "";
        document.removeEventListener("mousemove", handleDrag);
        document.removeEventListener("mouseup", stopDrag);

        // Resume playback if it was playing before
        if (wasPlaying) {
          this.togglePlayback();
        }
      };

      document.addEventListener("mousemove", handleDrag);
      document.addEventListener("mouseup", stopDrag);
    });

    // Hover effect to show timestamp
    timeline.addEventListener("mousemove", (e) => {
      if (!this.historyData?.length || isDragging) return;

      const rect = timeline.getBoundingClientRect();
      const position = (e.clientX - rect.left) / rect.width;
      const index = Math.floor(position * (this.historyData.length - 1));

      if (index >= 0 && index < this.historyData.length) {
        // Create or update tooltip
        let tooltip = document.getElementById("timeline-tooltip");
        if (!tooltip) {
          tooltip = document.createElement("div");
          tooltip.id = "timeline-tooltip";
          tooltip.className = "timeline-tooltip";
          document.body.appendChild(tooltip);
        }

        const timestamp = this.historyData[index].timestamp;
        tooltip.textContent = this.formatTimestamp(timestamp);

        // Position tooltip above cursor
        tooltip.style.left = `${e.clientX}px`;
        tooltip.style.top = `${rect.top - 25}px`;
        tooltip.style.display = "block";
      }
    });

    // Hide tooltip when leaving timeline
    timeline.addEventListener("mouseleave", () => {
      const tooltip = document.getElementById("timeline-tooltip");
      if (tooltip) {
        tooltip.style.display = "none";
      }
    });

    // Update timestamp display initially
    const timestampDisplay = document.getElementById("currentTimestamp");
    timestampDisplay.textContent = "-";
  }
  downloadHistory(format) {
    if (!this.historyData?.length) return;

    const headers = [
      "time",
      "latitude",
      "longitude",
      "heading_degree",
      "speed_in_knots",
      "gps_quality_indicator",
      "water_depth",
    ];

    const data = this.historyData.map((record) => ({
      time: record.timestamp.toISOString(),
      latitude: record.latitude, // Use decimal format for CSV
      longitude: record.longitude, // Use decimal format for CSV
      heading_degree: record.heading_degree.toFixed(3),
      speed_in_knots: record.speed_in_knots.toFixed(2),
      gps_quality_indicator: record.gps_quality || "RTK",
      water_depth: record.water_depth || 0,
    }));

    if (format === "csv") {
      this.downloadCSV(headers, data);
    } else {
      this.downloadExcel(headers, data);
    }
  }

  downloadCSV(headers, data) {
    const csvContent = [
      headers.join(","),
      ...data.map((row) => headers.map((header) => row[header]).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `vessel_history_${this.currentVessel.call_sign}_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    link.click();
  }

  downloadExcel(headers, data) {
    const worksheet = XLSX.utils.json_to_sheet(data, { header: headers });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Vessel History");
    XLSX.writeFile(
      workbook,
      `vessel_history_${this.currentVessel.call_sign}_${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`
    );
  }
  async fetchVesselHistory() {
    const startDate = document.getElementById("vesselStartDate").value;
    const endDate = document.getElementById("vesselEndDate").value;
    const fetchButton = document.getElementById("fetchVesselHistory");
    const playButton = document.getElementById("playButton");

    try {
      fetchButton.disabled = true;
      fetchButton.textContent = "Fetching...";

      const formatDateTime = (dateStr) => {
        const date = new Date(dateStr);
        return date.toISOString().slice(0, 19) + "Z";
      };

      const url = `/api/vessel/stream-history?${new URLSearchParams({
        call_sign: this.currentVessel.call_sign,
        start_time: formatDateTime(startDate),
        end_time: formatDateTime(endDate),
        interval: this.filterInterval,
      })}`;

      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch vessel history");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let historicalData = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const jsonStr = buffer.endsWith(",") ? buffer.slice(0, -1) : buffer;

        try {
          const records = JSON.parse(`[${jsonStr}]`);

          historicalData = records.map((record) => ({
            timestamp: new Date(record.timestamp),
            latitude: this.parseDMSToDecimal(record.latitude),
            longitude: this.parseDMSToDecimal(record.longitude),
            heading_degree: record.heading_degree,
            speed_in_knots: record.speed_in_knots,
            water_depth: record.water_depth,
            telnet_status: record.telnet_status || "Disconnected", // Ensure status is never undefined
            series_id: record.series_id,
          }));

          // Update track visualization
          this.updateTrackVisualization(historicalData);

          if (historicalData.length % 100 === 0) {
            this.updateTimelinePosition(0);
            this.currentPlaybackIndex = 0;
          }
        } catch (e) {
          console.warn("Partial data received, waiting for more...", e);
        }
      }

      this.historyData = historicalData;
      this.currentPlaybackIndex = 0;

      playButton.disabled = false;
      fetchButton.textContent = "Fetch Vessel History";
      fetchButton.disabled = false;

      this.updateTimelinePosition(0);

      if (this.historyData.length > 0) {
        const downloadButton = document.getElementById("downloadHistory");
        downloadButton.disabled = false;

        const currentPosition = this.historyData[0];
        this.updateVesselPosition(currentPosition);
        this.updateHistoricalDisplay(currentPosition);

        const timestampDisplay = document.getElementById("currentTimestamp");
        if (timestampDisplay) {
          timestampDisplay.textContent = this.formatTimestamp(
            currentPosition.timestamp
          );
        }
      }
    } catch (error) {
      console.error("Error fetching vessel history:", error);
      fetchButton.textContent = "Error - Try Again";
      fetchButton.disabled = false;
      playButton.disabled = true;
    }
  }

  updateHistoricalDisplay(record) {
    if (!record) return;

    const elements = {
      latitude: document.getElementById("historyLatitude"),
      longitude: document.getElementById("historyLongitude"),
      heading: document.getElementById("historyHeading"),
      speed: document.getElementById("historySpeed"),
      waterDepth: document.getElementById("historyWaterDepth"),
      status: document.getElementById("historyStatus"),
      timestamp: document.getElementById("currentTimestamp"), // Add timestamp element
    };

    if (elements.latitude)
      elements.latitude.textContent = this.formatDecimalToDMS(
        record.latitude,
        true
      );
    if (elements.longitude)
      elements.longitude.textContent = this.formatDecimalToDMS(
        record.longitude,
        false
      );
    if (elements.heading)
      elements.heading.textContent = `${record.heading_degree.toFixed(1)}°`;
    if (elements.speed)
      elements.speed.textContent = `${record.speed_in_knots.toFixed(1)} knots`;
    if (elements.waterDepth)
      elements.waterDepth.textContent = `${record.water_depth.toFixed(1)} m`;
    if (elements.status) {
      elements.status.textContent = record.telnet_status;
      elements.status.className =
        "detail-value " +
        (record.telnet_status === "Connected"
          ? "status-connected"
          : "status-disconnected");
    }
    // Update timestamp
    if (elements.timestamp) {
      elements.timestamp.textContent = this.formatTimestamp(record.timestamp);
    }
  }

  togglePlayback() {
    const playButton = document.getElementById("playButton");

    if (this.isPlaying) {
      this.isPlaying = false;
      playButton.innerHTML = '<i class="bi bi-play-fill"></i><span>Play</span>';
    } else {
      this.isPlaying = true;
      playButton.innerHTML =
        '<i class="bi bi-pause-fill"></i><span>Pause</span>';
      this.playVesselHistory();
    }
  }

  playVesselHistory() {
    if (
      !this.isPlaying ||
      this.currentPlaybackIndex >= this.historyData.length - 1
    ) {
      if (this.currentPlaybackIndex >= this.historyData.length - 1) {
        this.currentPlaybackIndex = 0;
      }
      this.isPlaying = false;
      const playButton = document.getElementById("playButton");
      playButton.innerHTML = '<i class="bi bi-play-fill"></i><span>Play</span>';
      return;
    }

    const currentPosition = this.historyData[this.currentPlaybackIndex];

    // Update vessel position with animation
    this.updateVesselPosition(currentPosition);

    // Update historical display including timestamp
    this.updateHistoricalDisplay(currentPosition);

    // Make sure timestamp is updated
    const timestampDisplay = document.getElementById("currentTimestamp");
    if (timestampDisplay) {
      timestampDisplay.textContent = this.formatTimestamp(
        currentPosition.timestamp
      );
    }

    this.currentPlaybackIndex++;
    this.updateTimelinePosition(
      this.currentPlaybackIndex / (this.historyData.length - 1)
    );

    setTimeout(() => {
      if (this.isPlaying) {
        this.playVesselHistory();
      }
    }, 1000 / this.playbackSpeed);
  }

  updateTimelinePosition(position) {
    const progress = document.querySelector(".timeline-progress");
    const handle = document.querySelector(".timeline-handle");

    if (progress && handle) {
      const percentage = position * 100;
      progress.style.width = `${percentage}%`;
      handle.style.left = `${percentage}%`;
    }
  }

  formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  }

  seekToPosition(position) {
    this.currentPlaybackIndex = Math.floor(
      position * (this.historyData.length - 1)
    );
    this.updateTimelinePosition(position);

    if (this.currentPlaybackIndex < this.historyData.length) {
      const currentPosition = this.historyData[this.currentPlaybackIndex];
      this.updateVesselPosition(currentPosition);
      this.updateHistoricalDisplay(currentPosition);
    }
  }

  // Update the vessel position event with the correct data
  updateVesselPosition(record) {
    if (!record) return;

    // Update the vessel overlay
    if (this.vesselOverlay) {
      this.vesselOverlay.update({
        position: [record.longitude, record.latitude],
        rotationAngle: record.heading_degree,
        speed: record.speed_in_knots,
        status: record.telnet_status,
        waterDepth: record.water_depth, // Add this line
      });
    }

    // Update event dispatch to include water_depth
    const event = new CustomEvent("vesselPositionUpdate", {
      detail: {
        vesselId: this.currentVessel.call_sign,
        position: {
          latitude: parseFloat(record.latitude),
          longitude: parseFloat(record.longitude),
          heading: record.heading_degree,
          speed: record.speed_in_knots,
          status: record.telnet_status,
          water_depth: record.water_depth, // Add this line
        },
      },
    });
    document.dispatchEvent(event);
  }

  // Update telemetry display with the correct data structure
  updateTelemetryDisplay(record) {
    document.getElementById(
      "speedValue"
    ).textContent = `${record.speed_in_knots.toFixed(1)} knots`;
    document.getElementById(
      "headingValue"
    ).textContent = `${record.heading_degree.toFixed(1)}°`;
    document.getElementById("statusValue").textContent = record.telnet_status;
    document.getElementById("statusValue").style.color =
      record.telnet_status === "Connected" ? "#10B981" : "#EF4444";

    // Optional: Update water depth if you have an element for it
    const depthElement = document.getElementById("depthValue");
    if (depthElement) {
      depthElement.textContent = `${record.water_depth.toFixed(1)} m`;
    }
  }

  // Update remove method to clean up track layer
  remove() {
    if (this.trackLayer) {
      window.map.removeLayer(this.trackLayer);
      this.trackLayer = null;
    }
    if (this.vesselOverlay) {
      this.vesselOverlay.remove();
      this.vesselOverlay = null;
    }
    super.remove();
  }
}

// Create global instance
const vesselDetail = new VesselDetail();

class VesselTrackOverlay extends VesselOverlay {
  constructor(map, options) {
    super(map, options);
    this.trackLayer = new ol.layer.Vector({
      source: new ol.source.Vector(),
      style: this.createTrackStyle(),
      zIndex: 998,
    });
    this.map.addLayer(this.trackLayer);
    this.historyCoordinates = [];

    document.addEventListener("vesselPositionUpdate", (event) => {
      if (event.detail.vesselId === this.device) {
        const pos = event.detail.position;
        this.updateTrack(pos);
        if (pos.water_depth !== undefined) {
          this.waterDepth = pos.water_depth; // Store water depth
        }
      }
    });
  }

  createTrackStyle() {
    return new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: "#2563EB",
        width: 2,
        lineDash: [4, 4], // Creates a dashed line effect
      }),
    });
  }

  // Convert DMS string to decimal degrees
  parseDMSToDecimal(dmsStr) {
    const matches = dmsStr.match(/(\d+)°(\d+\.\d+)°([NSEW])/);
    if (!matches) return null;

    const degrees = parseInt(matches[1]);
    const minutes = parseFloat(matches[2]);
    const direction = matches[3];

    let decimal = degrees + minutes / 60;
    if (direction === "S" || direction === "W") {
      decimal = -decimal;
    }

    return decimal;
  }

  updateTrack(position) {
    // Convert position to decimal degrees if needed
    let lat =
      typeof position.latitude === "string"
        ? this.parseDMSToDecimal(position.latitude)
        : position.latitude;

    let lon =
      typeof position.longitude === "string"
        ? this.parseDMSToDecimal(position.longitude)
        : position.longitude;

    if (lat === null || lon === null) return;

    // Add new coordinate to history
    this.historyCoordinates.push([lon, lat]);

    // Create or update the track feature
    this.trackLayer.getSource().clear();

    const trackFeature = new ol.Feature({
      geometry: new ol.geom.LineString(
        this.historyCoordinates.map((coord) => ol.proj.fromLonLat(coord))
      ),
    });

    this.trackLayer.getSource().addFeature(trackFeature);
  }

  clearTrack() {
    this.historyCoordinates = [];
    this.trackLayer.getSource().clear();
  }

  remove() {
    if (this.trackLayer) {
      this.map.removeLayer(this.trackLayer);
    }
    super.remove();
  }
}
