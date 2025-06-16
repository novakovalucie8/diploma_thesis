// Import Sentinel-2 Surface Reflectance collection
var s2 = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED");

// Import cloud scoring module (CS+)
var csPlus = ee.ImageCollection("GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED");

//  Define study area geometry from a loaded asset table
ee.FeatureCollection('projects/ee-project/geometry');  // Replace with your asset path

// Define analysis time range
var startDate = '2020-01-01',  // Start date for filtering images
    endDate = '2024-12-31';    // End date for filtering images

// Quality Assessment (QA) settings
var QA_BAND = 'cs';               // QA band name (cloud score)
var CLEAR_THRESHOLD = 0.65;       // Minimum threshold for clear pixels

// Import Sentinel-2 Harmonized Surface Reflectance collection
// Apply cloud mask using Cloud Score Plus module
var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')  // Harmonized Sentinel-2 SR data
    .filterBounds(geometry)                                 // Limit to study region
    .filterDate(startDate, endDate)                        // Filter by time range
    .linkCollection(csPlus, [QA_BAND])                     // Attach QA band for cloud scoring
    .map(function(img) {                                   // Mask out cloudy pixels
        return img.updateMask(img.select(QA_BAND).gte(CLEAR_THRESHOLD));
    });

// Index calculation functions

// NDVI: Normalized Difference Vegetation Index
var addNDVI = function(image) {
  var ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI'); // (NIR - RED)/(NIR + RED)
  return image.addBands(ndvi);
};

// NDMI: Normalized Difference Moisture Index
var addNDMI = function(image) {
  var ndmi = image.normalizedDifference(['B8', 'B11']).rename('NDMI'); // (NIR - SWIR)/(NIR + SWIR)
  return image.addBands(ndmi);
};

// NDRE: Normalized Difference Red Edge
var addNDRE = function(image) {
  var ndre = image.normalizedDifference(['B8', 'B5']).rename('NDRE'); // (NIR - RE)/(NIR + RE)
  return image.addBands(ndre);
};

// NDSI: Normalized Difference Snow Index
var addNDSI = function(image) {
  var ndsi = image.normalizedDifference(['B3', 'B11']).rename('NDSI'); // (Green - SWIR)/(Green + SWIR)
  return image.addBands(ndsi);
};

// EVI: Enhanced Vegetation Index
var addEVI = function(image) {
  var nir = image.select('B8').divide(10000);  // Scale reflectance
  var red = image.select('B4').divide(10000);
  var blue = image.select('B2').divide(10000);
  var evi = image.expression(
    'G * ((NIR - RED) / (NIR + C1 * RED - C2 * BLUE + L))', {
      'NIR': nir,
      'RED': red,
      'BLUE': blue,
      'G': 2.5, 'C1': 6, 'C2': 7.5, 'L': 1  // EVI coefficients
    }).rename('EVI');
  return image.addBands(evi);
};

// MSAVI: Modified Soil-Adjusted Vegetation Index
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

// TCW: Tasseled Cap Wetness
var addTCW = function(image) {
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
  var FAPAR = biopar.get_fapar(image).rename('FAPAR');       // Fraction of Absorbed PAR
  var LAI = biopar.get_lai(image).rename('LAI');             // Leaf Area Index
  var FAPAR_3b = biopar.get_fapar3band(image).rename('FAPAR_3b');
  var LAI_3b = biopar.get_lai3band(image).rename('LAI_3b');
  return image.addBands([FAPAR, LAI, LAI_3b, FAPAR_3b]);
}

// Combine all index functions into a single collection workflow
var s2_add_bands = s2
  .map(addNDVI)
  .map(addNDMI)
  .map(addNDSI)
  .map(addEVI)
  .map(addNDRE)
  .map(addMSAVI)
  .map(addFAPARandLAI)
  .map(addWNDII)
  .map(addTCW);

// Sample indices for each pixel within the region of interest
var samples = s2_add_bands
  .select(['NDVI','EVI','NDMI','NDSI','NDRE','MSAVI','FAPAR','LAI','WNDII','TCW'])
  .map(function(img) {
    return img.sample({
      region: geometry,    // Study area geometry
      scale: 10,           // Sampling resolution
      geometries: true     // Include point geometries
    });
  })
  .flatten();

// Print first few sample points to console
print('Sampled index values (first 10):', samples.limit(10));

// Export sampled data to Google Drive as CSV
Export.table.toDrive({
  collection: samples,          // Data to export
  description: 'TS_data_test',  // Task name
  folder: 'Export_GEE',         // Drive folder
  fileNamePrefix: 'TS_data_test',
  fileFormat: 'CSV'             // Format
});
