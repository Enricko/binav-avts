let locationPickingActive = false;
let locationMarker = null;
let locationPickerClickListener = null;
let markerLayer = null; 

let originalCenter = null;
let originalZoom = null;
let sensorModalInstance = null;
let sensorManagementModalInstance = null;

var extent = ol.proj.transformExtent(
  [92.0, -15.0, 143.0, 10.0],
  "EPSG:4326",
  "EPSG:3857"
);
var map = new ol.Map({
  target: "map",
  layers: [
    new ol.layer.Tile({
      source: new ol.source.OSM(),
      opacity: 0.7,
    }),
  ],
  view: new ol.View({
    center: ol.proj.fromLonLat([116.855698, -1.219515]),
    zoom: 10,
    extent: extent,
    minZoom: 5,
    maxZoom: 19,
  }),
});

// Disable double click zoom after map initialization
map.getInteractions().forEach(function (interaction) {
  if (interaction instanceof ol.interaction.DoubleClickZoom) {
    map.removeInteraction(interaction);
  }
});

var darkOverlay = new ol.layer.Vector({
  source: new ol.source.Vector({
    features: [
      new ol.Feature({
        geometry: new ol.geom.Polygon.fromExtent(extent),
      }),
    ],
  }),
  style: new ol.style.Style({
    fill: new ol.style.Fill({
      color: "rgba(0, 0, 0, 0.2)",
    }),
  }),
  zIndex: 1,
});

map.addLayer(darkOverlay);
window.map = map;
