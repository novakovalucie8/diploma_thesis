# Krušné Time Series Analysis Repository

This repository provides end-to-end scripts and notebooks for processing, analyzing, clustering, classifying, and mapping Sentinel‑2 time series data over the Krušné Mountains region.

## Prerequisites

### 1. Google Earth Engine
- A Google Earth Engine account (https://earthengine.google.com/).
- Run `scripts/gee_script_with_comments.js` in the GEE Code Editor to generate CSV exports in your Drive under the `Export_GEE` folder.

### 2. Python 3.8+ environment
Install required Python packages:
```bash
pip install \
  pandas numpy matplotlib seaborn scikit-learn sktime tslearn geopandas folium \
  joblib shapely kneed
```

Optionally, use a virtual environment or `conda` for isolation.

## Usage

### A. Earth Engine Processing
1. Open `scripts/gee_script_with_comments.js` in the GEE Code Editor.
2. Update any placeholder geometries or collection names as needed.
3. Run the script to filter, mask, compute spectral indices, and export to CSV on Google Drive.

### B. Plot NDVI Time Series (Jupyter Notebook)
1. Launch Jupyter Lab or Notebook:
   ```bash
   jupyter lab
   ```
2. Open `notebooks/ndvi_time_series_notebook.ipynb`.
3. Modify the `data_path` variable to point to your downloaded CSV (e.g., `data_csv/TS_data_obdelnik_maly.csv`).
4. Run all cells to generate interactive plots of NDVI by phase, you can change indicies.

### C. Time Series Clustering
1. Open `notebooks/kmedoids_clustering.ipynb`.
2. Execute cells to build a 3D ndarray, perform interpolation, run time series clustering, and visualize results.

### D. Classification Tuning & Evaluation (TS-SVC)
1. Open `notebooks/TS_classification_model.ipynb`.
2. Verify paths to CSVs and the pretrained model in `modely_svc/`.
3. Run cells to tune the TS-SVC `C` parameter, evaluate univariate and multivariate feature sets, and view F1/accuracy results.

### E. Generate Predictions & Shapefiles
1. Open `notebooks/TS_classification_per_pixel.ipynb`.
2. The script will:
   - Load `dataset_for_per_pixel_classification.csv` and parse dates/IDs.
   - Load the pretrained TS-SVC from `modely_svc/`.
   - Predict cluster labels per polygon ID.
   - Aggregate predictions and extract coordinates.
   - Create two shapefiles:
     - `shapefile.shp` (points)
     - `model_pixels.shp` (10 m square pixels) in EPSG:32633.

## Notes
- All code files include detailed English comments explaining each step. Feel free to adapt thresholds, feature combinations, or mapping parameters.

## License
This project is released under the MIT License. See [LICENSE](LICENSE) for details.

---

*For questions or contributions, please open an issue or submit a pull request.*



