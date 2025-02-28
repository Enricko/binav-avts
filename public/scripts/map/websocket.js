const ws = new WebSocket("ws://127.0.0.1:3000/ws");
let vesselOverlays = {};
const sensorOverlayManager = new SensorOverlay(map);

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  // Update wsData for search functionality
  if (data.navigation) wsData.navigation = data.navigation;
  if (data.sensors) wsData.sensors = data.sensors;

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
            vessel.vessel.image || `storege/${vessel.vessel.vessel_map_image}`,
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
  if (document.activeElement === searchInput && searchInput.value) {
    updateDropdown(searchInput.value);
  }
};

ws.onclose = () => {
  setTimeout(() => {
    ws = new WebSocket("ws://127.0.0.1:3000/ws");
  }, 1000);
};
