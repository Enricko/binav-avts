var extent = ol.proj.transformExtent([92.0, -15.0, 143.0, 10.0], 'EPSG:4326', 'EPSG:3857');

var map = new ol.Map({
  target: "map",
  layers: [
    new ol.layer.Tile({
      source: new ol.source.OSM(),
      // Apply darkness through opacity instead of filters
      opacity: 0.7,
      // Remove the style filter that was causing issues
    }),
  ],
  view: new ol.View({
    // center: ol.proj.fromLonLat([118.0, -2.0]), // Center of Indonesia
    center: ol.proj.fromLonLat([116.855698, -1.219515]), // Center of Indonesia
    zoom: 20,
    extent: extent,
    minZoom: 5,
    maxZoom: 19
  }),
});

// Remove the brightness filter from the map container
// document.querySelector('#map').style.filter = 'brightness(0.7)';

// Add a dark overlay layer underneath your vessel layers
var darkOverlay = new ol.layer.Vector({
  source: new ol.source.Vector({
    features: [
      new ol.Feature({
        geometry: new ol.geom.Polygon.fromExtent(extent)
      })
    ]
  }),
  style: new ol.style.Style({
    fill: new ol.style.Fill({
      color: 'rgba(0, 0, 0, 0.2)'
    })
  }),
  zIndex: 1  // Place it above the base map but below your vessel layers
});

map.addLayer(darkOverlay);