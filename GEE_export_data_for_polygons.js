// Import Sentinel-2 Surface Reflectance collection
var s2 = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED");

// Import cloud scoring module (CS+)
var csPlus = ee.ImageCollection("GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED");

// Define study area geometry from a loaded asset table
var roi = ee.FeatureCollection('projects/ee-project/geometry');  // Replace with your asset path

// Quality Assessment (QA) settings
var QA_BAND = 'cs';                        // QA band name for cloud score
var CLEAR_THRESHOLD = 0.65;                // Threshold for clear pixels

// Filter and mask Sentinel-2 collection
var s2_cloudmask = s2
    .filterBounds(roi)                                            // Keep images over our ROI
    .filterDate('2020-01-01', '2024-12-31')                      // Date range filter
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))         // Cloud cover <20%
    .linkCollection(csPlus, [QA_BAND])                           // Attach cloud score band
    .map(function(img) {                                         // Mask out cloudy pixels
      return img.updateMask(img.select(QA_BAND).gte(CLEAR_THRESHOLD));
    });
// Print the filtered, cloud-masked collection
print('Filtered and Cloud Masked Sentinel-2 Collection:', s2_cloudmask);

// Function to add NDVI band
var addNDVI = function(image) {
  var ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI'); 
  return image.addBands(ndvi);
};

// Function to add NDMI band
var addNDMI = function(image) {
  var ndmi = image.normalizedDifference(['B8', 'B11']).rename('NDMI');
  return image.addBands(ndmi);
};

// Function to add NDRE band
var addNDRE = function(image) {
  var ndre = image.normalizedDifference(['B8', 'B5']).rename('NDRE');
  return image.addBands(ndre);
};

// Function to add NDSI band
var addNDSI = function(image) {
  var ndsi = image.normalizedDifference(['B3', 'B11']).rename('NDSI');
  return image.addBands(ndsi);
};

// Function to add WNDII band (custom water index)
var addWNDII = function(image) {
  var swir = image.select('B11');
  var nir = image.select('B8');
  var wndii = image.expression(
    '(2 * NIR - SWIR) / (2 * NIR + SWIR)', {
      'NIR': nir,
      'SWIR': swir
    }).rename('WNDII');
  return image.addBands(wndii);
};

// Function to add Enhanced Vegetation Index (EVI)
var addEVI = function(image) {
  var nir = image.select('B8').divide(10000);   // Scale reflectance
  var red = image.select('B4').divide(10000);
  var blue = image.select('B2').divide(10000);
  var evi = image.expression(
    'G * ((NIR - RED) / (NIR + C1 * RED - C2 * BLUE + L))', {
      'NIR': nir,
      'RED': red,
      'BLUE': blue,
      'G': 2.5, 'C1': 6, 'C2': 7.5, 'L': 1
    }).rename('EVI');
  return image.addBands(evi);
};

// Function to add Modified Soil-Adjusted Vegetation Index (MSAVI)
var addMSAVI = function(image) {
  var nir = image.select('B8').divide(10000);
  var red = image.select('B4').divide(10000);
  var msavi = image.expression(
    '(2 * NIR + 1 - sqrt((2 * NIR + 1)**2 - 8 * (NIR - RED))) / 2', {
      'NIR': nir,
      'RED': red
    }).rename('MSAVI');
  return image.addBands(msavi);
};

// Function to add Tasseled Cap Wetness (TCW)
var addTCW = function(image) {
  // Coefficients for Sentinel-2 bands
  var b2 = image.select('B2').multiply(0.1509);
  var b3 = image.select('B3').multiply(0.1973);
  var b4 = image.select('B4').multiply(0.3279);
  var b8 = image.select('B8').multiply(0.3406);
  var b11 = image.select('B11').multiply(-0.7112);
  var b12 = image.select('B12').multiply(-0.4572);
  var tcw = b2.add(b3).add(b4).add(b8).add(b11).add(b12).rename('TCW');
  return image.addBands(tcw);
};

// Import biophysical parameters module for FAPAR and LAI
var biopar = require('users/kristofvantricht/s2_biopar:biopar');
function addFAPARandLAI(image) {
  var FAPAR = biopar.get_fapar(image).rename('FAPAR');        // fAPAR
  var LAI = biopar.get_lai(image).rename('LAI');              // LAI
  var FAPAR_3b = biopar.get_fapar3band(image).rename('FAPAR_3b');
  var LAI_3b = biopar.get_lai3band(image).rename('LAI_3b');
  return image.addBands([FAPAR, LAI, LAI_3b, FAPAR_3b]);
}

// Chain all band-adding functions to collection
var s2_add_bands = s2K_cloudmask
  .map(addNDVI)
  .map(addNDMI)
  .map(addNDSI)
  .map(addEVI)
  .map(addNDRE)
  .map(addMSAVI)
  .map(addFAPARandLAI)
  .map(addWNDII)
  .map(addTCW);

// Set up interactive map view
Map.centerObject(roi, 12);                          // Focus on ROI
Map.addLayer(roi, {color: 'red'}, 'ROI');   // Add ROI layer

// Create chart panel for time series plotting
var chartPanel = ui.Panel();
chartPanel.style().set({width: '600px'});
ui.root.widgets().add(chartPanel);

// Function to update NDMI chart on map click
var updateChart = function(coords) {
  var clickedPoint = ee.Geometry.Point(coords.lon, coords.lat);
  var updatedChart = ui.Chart.image.series({
    imageCollection: s2_add_bands.select('NDMI'),    // Select NDMI band
    region: clickedPoint,                              // Point region
    reducer: ee.Reducer.mean(),                       // Mean value
    scale: 30
  }).setOptions({
    title: 'NDMI Time Series at Clicked Point',
    vAxis: {title: 'NDMI'},
    hAxis: {title: 'Date'},
    lineWidth: 2,
    pointSize: 4
  });
  chartPanel.clear();
  chartPanel.add(updatedChart);
};

// Bind click event to update chart
Map.onClick(function(coords) {
  updateChart(coords);
});

// Prepare and export data

// Reduce images over ROI and get mean values for selected indices
var getData = s2_add_bands.select([
  'NDVI', 'EVI', 'NBR', 'NDMI', 'NDSI', 'NDRE', 'MSAVI', 'FAPAR', 'LAI', 'WNDII', 'TCW'
]).map(function(img) {
  return img.reduceRegions({
    collection: roi,
    reducer: ee.Reducer.mean(),
    scale: 10
  });
});

// Flatten the results and remove nulls
var to_export = getData.flatten().filter(ee.Filter.notNull(['MSAVI']));

// Export the table to Google Drive
Export.table.toDrive({
  collection: to_export,
  description: 'export',
  folder: 'Export_GEE',
  fileNamePrefix: 'export',
  fileFormat: 'CSV'
});
