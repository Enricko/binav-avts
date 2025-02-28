// websocket.js

// Create WebSocket connection
let wsUrl = "ws://127.0.0.1:3000/ws";
let ws = new WebSocket(wsUrl);
let vesselOverlays = {};
const sensorOverlayManager = new SensorOverlay(map);

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  // Update wsData for search functionality
  // Using window.wsData to ensure we're accessing the global variable
  if (data.navigation) window.wsData.navigation = data.navigation;
  if (data.sensors) window.wsData.sensors = data.sensors;

  // Handle vessel data
  if (data.navigation) {
    Object.entries(data.navigation).forEach(([callSign, vessel]) => {
      const position = [
        vessel.telemetry.longitude_decimal,
        vessel.telemetry.latitude_decimal,
      ];

      if (!vesselOverlays[callSign]) {
        vesselOverlays[callSign] = new AnimatedVesselOverlay(map, {
          position: position,
          width: vessel.vessel.width_m,
          height: vessel.vessel.length_m,
          rotationAngle: vessel.telemetry.heading_degree,
          status: vessel.telemetry.telnet_status,
          device: vessel.call_sign,
          imageUrl: `storage/${vessel.vessel.vessel_map_image}`,
          imageDisplayUrl:
            vessel.vessel.image || `storage/${vessel.vessel.vessel_map_image}`,
          speed: vessel.telemetry.speed_in_knots,
          waterDepth: vessel.telemetry.water_depth,
          gpsQuality: vessel.telemetry.gps_quality_indicator,
        });
      } else {
        vesselOverlays[callSign].update({
          position: position,
          rotationAngle: vessel.telemetry.heading_degree,
          status: vessel.telemetry.telnet_status,
          speed: vessel.telemetry.speed_in_knots,
          waterDepth: vessel.telemetry.water_depth,
          gpsQuality: vessel.telemetry.gps_quality_indicator,
        });
      }
    });
  }

  // Handle sensor data
  if (data.sensors) {
    sensorOverlayManager.updateSensors(data.sensors);
  }

  // Always update dropdown if search has input
  // This assumes searchInput is globally accessible
  const searchInput = document.querySelector('.search-input');
  if (searchInput && document.activeElement === searchInput && searchInput.value) {
    // Call the global updateDropdown function
    if (typeof window.updateDropdown === 'function') {
      window.updateDropdown(searchInput.value);
    }
  }
};

ws.onclose = () => {
  console.log("WebSocket connection closed. Attempting to reconnect...");
  setTimeout(() => {
    ws = new WebSocket(wsUrl);
  }, 1000);
};

ws.onerror = (error) => {
  console.error("WebSocket error:", error);
};

// Add log when connection is established
ws.onopen = () => {
  console.log("WebSocket connection established");
};