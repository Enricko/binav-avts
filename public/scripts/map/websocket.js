
// WebSocket connection and vessel management
const ws = new WebSocket('ws://127.0.0.1:3000/ws');
let vesselOverlays = {};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  Object.entries(data.navigation).forEach(([callSign, vessel]) => {
    const position = [
      vessel.telemetry.longitude_decimal, 
      vessel.telemetry.latitude_decimal
    ];
    
    if (!vesselOverlays[callSign]) {
      vesselOverlays[callSign] = new AnimatedVesselOverlay(map, {
        position: position,
        width: vessel.vessel.width_m,
        height: vessel.vessel.length_m,
        rotationAngle: vessel.telemetry.heading_degree,
        status: vessel.telemetry.telnet_status,
        device: vessel.call_sign,
        imageUrl: `/storage${vessel.vessel.vessel_map_image}`,
        imageDisplayUrl: vessel.vessel.image || `/storage${vessel.vessel.vessel_map_image}`,
        speed: vessel.telemetry.speed_in_knots,
        waterDepth: vessel.telemetry.water_depth,
        gpsQuality: vessel.telemetry.gps_quality_indicator
      });
    } else {
      vesselOverlays[callSign].update({
        position: position,
        rotationAngle: vessel.telemetry.heading_degree,
        status: vessel.telemetry.telnet_status,
        speed: vessel.telemetry.speed_in_knots,
        waterDepth: vessel.telemetry.water_depth,
        gpsQuality: vessel.telemetry.gps_quality_indicator
      });
    }
  });
};

ws.onclose = () => {
  setTimeout(() => {
    ws = new WebSocket("ws://127.0.0.1:3000/ws");
  }, 1000);
};