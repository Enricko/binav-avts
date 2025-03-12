// // overlay_manager.js - Map overlay manager

// // Store overlay layers for reference
// let overlayLayers = {};

// // Handle messages from the overlay management modal
// function handleOverlayMessage(event) {
//   const { data } = event;

//   if (!data || !data.type) return;

//   console.log("Received message:", data.type, data);

//   switch (data.type) {
//     case "PREVIEW_OVERLAY":
//       console.log("Adding overlay layer:", data.overlay);
//       addOverlayLayer(data.overlay);
//       // Zoom when previewing
//       zoomToOverlay(data.overlay.id);
//       break;

//     case "ADD_OVERLAY":
//       addOverlayLayer(data.overlay);
//       break;

//     case "UPDATE_OVERLAY":
//       updateOverlayLayer(data.overlay);
//       break;

//     case "UPDATE_OVERLAY_VISIBILITY":
//       console.log(
//         "Toggling visibility for overlay:",
//         data.overlay.id,
//         "to:",
//         data.overlay.isVisible
//       );
//       toggleOverlayVisibility(data.overlay.id, data.overlay.isVisible);
//       break;

//     case "REMOVE_OVERLAY":
//       removeOverlayLayer(data.overlayId);
//       break;

//     case "ZOOM_TO_OVERLAY":
//       console.log("Zooming to overlay:", data.overlayId);
//       zoomToOverlay(data.overlayId);
//       break;

//     default:
//       console.log("Unknown message type:", data.type);
//   }
// }

// // Add overlay layer to map without zooming
// function addOverlayLayer(overlay) {
//   // Remove existing layer if it exists
//   if (overlayLayers[overlay.id]) {
//     removeOverlayLayer(overlay.id);
//   }

//   let layer;

//   // Create the appropriate layer based on file type
//   switch (overlay.fileType.toLowerCase()) {
//     case "geojson":
//     case "json":
//       layer = createGeoJSONLayer(overlay);
//       break;

//     case "kml":
//       layer = createKMLLayer(overlay);
//       break;

//     case "kmz":
//       // KMZ is processed to KML
//       layer = createKMLLayer(overlay);
//       break;

//     default:
//       // Other formats are converted to GeoJSON
//       layer = createGeoJSONLayer(overlay);
//   }

//   if (layer) {
//     // Set layer properties
//     layer.set("name", overlay.name);
//     layer.set("overlayId", overlay.id);
//     layer.setVisible(overlay.isVisible);
//     layer.setZIndex(overlay.zIndex || 0);

//     // Add layer to map
//     map.addLayer(layer);

//     // Store reference
//     overlayLayers[overlay.id] = {
//       layer,
//       info: overlay,
//     };
//   }
// }

// // Function to zoom to a specific overlay
// function zoomToOverlay(id) {
//   console.log("zoomToOverlay called with ID:", id);

//   const existingOverlay = overlayLayers[id];
//   if (!existingOverlay) {
//     console.error("Overlay not found for zooming:", id);
//     return;
//   }

//   console.log("Found overlay for zooming:", existingOverlay);

//   const source = existingOverlay.layer.getSource();

//   if (source && source instanceof ol.source.Vector) {
//     // If source is already loaded, zoom to it
//     const features = source.getFeatures();
//     console.log("Source features:", features.length);

//     if (features.length > 0) {
//       const extent = source.getExtent();
//       console.log("Zooming to extent:", extent);

//       map.getView().fit(extent, {
//         padding: [50, 50, 50, 50],
//         duration: 1000,
//       });
//     } else {
//       console.log("No features loaded yet, setting up load listener");
//       // Otherwise, wait for it to load
//       source.once("featuresloadend", function () {
//         const loadedFeatures = source.getFeatures();
//         console.log("Features loaded:", loadedFeatures.length);

//         if (loadedFeatures.length > 0) {
//           const extent = source.getExtent();
//           console.log("Zooming to loaded extent:", extent);

//           map.getView().fit(extent, {
//             padding: [50, 50, 50, 50],
//             duration: 1000,
//           });
//         } else {
//           console.warn("No features found after loading");
//         }
//       });
//     }
//   } else {
//     console.error("Source not found or not a vector source");
//   }
// }

// // Create a GeoJSON layer
// function createGeoJSONLayer(overlay) {
//   // Create vector source
//   const vectorSource = new ol.source.Vector({
//     url: overlay.fileUrl,
//     format: new ol.format.GeoJSON(),
//   });

//   // Create random color for styling
//   const color = getRandomColor();
//   const strokeColor = color;
//   const fillColor = ol.color.asArray(color).slice();
//   fillColor[3] = 0.2; // Set alpha

//   // Create vector layer
//   return new ol.layer.Vector({
//     source: vectorSource,
//     style: new ol.style.Style({
//       fill: new ol.style.Fill({
//         color: fillColor,
//       }),
//       stroke: new ol.style.Stroke({
//         color: strokeColor,
//         width: 2,
//       }),
//       image: new ol.style.Circle({
//         radius: 7,
//         fill: new ol.style.Fill({
//           color: strokeColor,
//         }),
//       }),
//     }),
//   });
// }

// // Create a KML layer
// function createKMLLayer(overlay) {
//   // Create vector source
//   const vectorSource = new ol.source.Vector({
//     url: overlay.fileUrl,
//     format: new ol.format.KML({
//       extractStyles: true,
//       extractAttributes: true,
//     }),
//   });

//   // Create vector layer
//   return new ol.layer.Vector({
//     source: vectorSource,
//   });
// }

// // Update an existing overlay layer
// function updateOverlayLayer(overlay) {
//   const existingOverlay = overlayLayers[overlay.id];
//   if (!existingOverlay) return;

//   // Update layer properties
//   if (overlay.name) {
//     existingOverlay.layer.set("name", overlay.name);
//     existingOverlay.info.name = overlay.name;
//   }

//   if (overlay.zIndex !== undefined) {
//     existingOverlay.layer.setZIndex(overlay.zIndex);
//     existingOverlay.info.zIndex = overlay.zIndex;
//   }

//   if (overlay.isVisible !== undefined) {
//     existingOverlay.layer.setVisible(overlay.isVisible);
//     existingOverlay.info.isVisible = overlay.isVisible;
//   }
// }

// // Toggle overlay visibility
// function toggleOverlayVisibility(id, isVisible) {
//   console.log("toggleOverlayVisibility:", id, isVisible);

//   const existingOverlay = overlayLayers[id];
//   if (!existingOverlay) {
//     console.error("Overlay not found for visibility toggle:", id);
//     return;
//   }

//   console.log("Setting visibility of layer to:", isVisible);
//   existingOverlay.layer.setVisible(isVisible);
//   existingOverlay.info.isVisible = isVisible;
// }

// // Remove an overlay layer
// function removeOverlayLayer(id) {
//   const existingOverlay = overlayLayers[id];
//   if (!existingOverlay) return;

//   map.removeLayer(existingOverlay.layer);
//   delete overlayLayers[id];
// }

// // Helper function to generate a random color
// function getRandomColor() {
//   const hue = Math.floor(Math.random() * 360);
//   return `hsl(${hue}, 70%, 45%)`;
// }

// // Load all active overlays without zooming
// function loadActiveOverlays() {
//   fetch("/api/overlays?is_visible=true")
//     .then((response) => {
//       if (!response.ok) throw new Error("Failed to fetch overlays");
//       return response.json();
//     })
//     .then((data) => {
//       // Add each completed overlay to the map
//       if (data.data && Array.isArray(data.data)) {
//         data.data.forEach((overlay) => {
//           if (overlay.processing_status === "completed") {
//             addOverlayLayer({
//               id: overlay.id,
//               name: overlay.name,
//               fileUrl: `/api/overlays/${overlay.id}/file`,
//               fileType: overlay.file_type,
//               zIndex: overlay.z_index,
//               isVisible: overlay.is_visible,
//             });
//           }
//         });
//       }
//     })
//     .catch((error) => {
//       console.error("Failed to load overlays:", error);
//     });
// }

// // Initialize overlay functionality
// function initOverlays() {
//   // Add listener for overlay management modal
//   window.addEventListener("message", handleOverlayMessage);

//   // Load active overlays
//   loadActiveOverlays();
// }

// // Make functions available globally
// window.handleOverlayMessage = handleOverlayMessage;
// window.addOverlayLayer = addOverlayLayer;
// window.updateOverlayLayer = updateOverlayLayer;
// window.toggleOverlayVisibility = toggleOverlayVisibility;
// window.removeOverlayLayer = removeOverlayLayer;
// window.loadActiveOverlays = loadActiveOverlays;
// window.zoomToOverlay = zoomToOverlay;
// window.initOverlays = initOverlays;

// // Initialize when the page is loaded
// document.addEventListener("DOMContentLoaded", initOverlays);
