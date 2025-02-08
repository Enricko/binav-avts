var extent = ol.proj.transformExtent([92.0, -15.0, 143.0, 10.0], 'EPSG:4326', 'EPSG:3857');

var map = new ol.Map({
 target: "map",
 layers: [
   new ol.layer.Tile({
     source: new ol.source.OSM(),
   }),
 ],
 view: new ol.View({
   center: ol.proj.fromLonLat([118.0, -2.0]), // Center of Indonesia
   zoom: 5,
   extent: extent,
   minZoom: 5,
   maxZoom: 19
 }),
});