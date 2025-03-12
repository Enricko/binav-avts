package controllers

import (
	"fmt"
	"goravel/app/models"
	"goravel/app/services"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/goravel/framework/contracts/http"
	"github.com/goravel/framework/facades"
)

type GeolayerController struct {
	geoserver *services.GeoServerService
}

func NewGeolayerController() *GeolayerController {
	return &GeolayerController{
		geoserver: services.NewGeoServerService(
			facades.Config().GetString("geoserver.url"),
			facades.Config().GetString("geoserver.username"),
			facades.Config().GetString("geoserver.password"),
		),
	}
}

// View returns the HTML for the geolayer management view
// @Summary Get geolayer management view
// @Description Returns HTML for geolayer management interface
// @Tags Geolayer
// @Accept json
// @Produce html
// @Success 200 {string} string
// @Router /api/geolayers/view [get]
func (c *GeolayerController) View(ctx http.Context) http.Response {
	// Return the HTML template for the geolayer management interface
	return ctx.Response().View().Make("pages/geolayer_modal.html")
}

// Index returns a list of all geolayers
// @Summary Get all geolayers
// @Description Get a list of all geolayers
// @Tags Geolayer
// @Accept json
// @Produce json
// @Param page query int false "Page number"
// @Param limit query int false "Number of items per page"
// @Param file_type query string false "Filter by file type"
// @Param workspace query string false "Filter by workspace"
// @Param with_trashed query bool false "Include soft deleted records"
// @Success 200 {object} http.Response
// @Failure 500 {object} http.Response
// @Router /api/geolayers [get]
func (c *GeolayerController) Index(ctx http.Context) http.Response {
	var geolayers []models.Geolayer

	// Get query parameters for pagination
	page, _ := strconv.Atoi(ctx.Request().Query("page", "1"))
	limit, _ := strconv.Atoi(ctx.Request().Query("limit", "10"))

	// Get query parameter for including soft deleted records
	withTrashed := ctx.Request().Query("with_trashed", "false") == "true"

	// Initialize query builder
	query := facades.Orm().Query()

	// Apply filters if provided
	if fileType := ctx.Request().Query("file_type", ""); fileType != "" {
		query = query.Where("file_type", fileType)
	}

	if workspace := ctx.Request().Query("workspace", ""); workspace != "" {
		query = query.Where("workspace", workspace)
	}

	// Handle soft deletes
	if !withTrashed {
		query = query.WhereNull("deleted_at")
	}

	// Get total count for pagination
	var total int64
	if err := query.Model(&models.Geolayer{}).Count(&total); err != nil {
		return ctx.Response().Json(http.StatusInternalServerError, http.Json{
			"message": "Failed to count records",
			"error":   err.Error(),
		})
	}

	// Execute the paginated query
	offset := (page - 1) * limit
	if err := query.Model(&models.Geolayer{}).Offset(offset).Limit(limit).Find(&geolayers); err != nil {
		return ctx.Response().Json(http.StatusInternalServerError, http.Json{
			"message": "Failed to retrieve geolayers",
			"error":   err.Error(),
		})
	}

	// Process file paths to URLs for each geolayer
	for i := range geolayers {
		if geolayers[i].FilePath != "" && !strings.HasPrefix(geolayers[i].FilePath, "http") {
			geolayers[i].FilePath = facades.Storage().Url(geolayers[i].FilePath)
		}
	}

	// Return response with pagination info
	return ctx.Response().Json(http.StatusOK, http.Json{
		"data": geolayers,
		"meta": http.Json{
			"current_page": page,
			"per_page":     limit,
			"total":        total,
			"last_page":    (int(total) + limit - 1) / limit,
		},
	})
}

// Show returns a single geolayer by ID
// @Summary Get a geolayer
// @Description Get a geolayer by ID
// @Tags Geolayer
// @Accept json
// @Produce json
// @Param id path int true "Geolayer ID"
// @Param with_trashed query bool false "Include soft deleted records"
// @Success 200 {object} http.Response
// @Failure 404 {object} http.Response
// @Failure 500 {object} http.Response
// @Router /api/geolayers/{id} [get]
func (c *GeolayerController) Show(ctx http.Context) http.Response {
	id := ctx.Request().Route("id")

	var geolayer models.Geolayer

	// Try to find the geolayer, including soft deleted if requested
	withTrashed := ctx.Request().Query("with_trashed", "false") == "true"

	query := facades.Orm().Query()
	if !withTrashed {
		query = query.WhereNull("deleted_at")
	}

	if err := query.Find(&geolayer, id); err != nil {
		// Check if the error is a "record not found" error
		if err.Error() == "record not found" {
			return ctx.Response().Json(http.StatusNotFound, http.Json{
				"message": "Geolayer not found",
			})
		}

		return ctx.Response().Json(http.StatusInternalServerError, http.Json{
			"message": "Failed to retrieve geolayer",
			"error":   err.Error(),
		})
	}

	// Convert file path to full URL
	if geolayer.FilePath != "" && !strings.HasPrefix(geolayer.FilePath, "http") {
		geolayer.FilePath = facades.Storage().Url(geolayer.FilePath)
	}

	return ctx.Response().Json(http.StatusOK, http.Json{
		"data": geolayer,
	})
}

// Store creates a new geolayer
// @Summary Create a geolayer
// @Description Create a new geolayer
// @Tags Geolayer
// @Accept multipart/form-data
// @Produce json
// @Param name formData string true "Layer Name"
// @Param file formData file true "Layer File (gpkg, kml, kmz, etc.)"
// @Param workspace formData string false "Workspace name (optional)"
// @Success 201 {object} http.Response
// @Failure 400 {object} http.Response
// @Failure 500 {object} http.Response
// @Router /api/geolayers [post]
func (c *GeolayerController) Store(ctx http.Context) http.Response {
	// Get the uploaded file
	file, err := ctx.Request().File("file")
	if err != nil {
		return ctx.Response().Json(http.StatusBadRequest, http.Json{
			"message": "Invalid file upload",
			"error":   err.Error(),
		})
	}

	if file == nil {
		return ctx.Response().Json(http.StatusBadRequest, http.Json{
			"message": "No file uploaded",
		})
	}

	// Get layer name from form
	name := ctx.Request().Input("name")
	if name == "" {
		name = file.GetClientOriginalName()
	}

	// Generate a unique filename
	originalName := file.GetClientOriginalName()
	extension := filepath.Ext(originalName)
	
	// Validate supported file types
	if !c.isSupportedFileType(extension) {
		return ctx.Response().Json(http.StatusBadRequest, http.Json{
			"message": "Unsupported file type. Supported types: .kml, .kmz, .json, .geojson, .gpkg, .dwg",
		})
	}

	uniqueName := fmt.Sprintf("%d%s", time.Now().Unix(), extension)

	// Store file using Goravel's Storage facade
	path, err := facades.Storage().PutFile("geolayers", file)
	if err != nil {
		return ctx.Response().Json(http.StatusInternalServerError, http.Json{
			"message": "Failed to save file",
			"error":   err.Error(),
		})
	}

	// Get the full path for processing
	fullPath := facades.Storage().Path(path)

	// Handle different file types
	workspace := ctx.Request().Input("workspace", "geolayers")
	storeName := fmt.Sprintf("store_%s", strings.TrimSuffix(uniqueName, extension))
	var layerNames []string
	var bbox string

	// Process different file types
	switch strings.ToLower(extension) {
	case ".gpkg":
		// For GeoPackage, read the table names
		var err error
		layerNames, err = c.geoserver.GetGeoPackageTableNames(fullPath)
		if err != nil {
			facades.Storage().Delete(path)
			return ctx.Response().Json(http.StatusBadRequest, http.Json{
				"message": "Failed to read GeoPackage tables",
				"error":   err.Error(),
			})
		}

		// Create workspace if it doesn't exist
		if err := c.geoserver.CreateWorkspace(workspace); err != nil {
			fmt.Printf("Workspace creation error (might exist already): %v\n", err)
		}

		// Create datastore in GeoServer
		if err := c.geoserver.CreateDataStore(workspace, storeName, fullPath); err != nil {
			facades.Storage().Delete(path)
			return ctx.Response().Json(http.StatusInternalServerError, http.Json{
				"message": "Failed to create GeoServer datastore",
				"error":   err.Error(),
			})
		}

		// Publish each layer in the GeoPackage
		var publishedLayers []models.Geolayer
		for _, tableName := range layerNames {
			// Publish the layer
			if err := c.geoserver.PublishLayer(workspace, storeName, tableName); err != nil {
				// Log error but continue with other layers
				fmt.Printf("Failed to publish layer %s: %v\n", tableName, err)
				continue
			}

			// Create database record for each layer
			geolayer := &models.Geolayer{
				Name:      fmt.Sprintf("%s-%s", name, tableName),
				FilePath:  path,
				FileType:  extension,
				Workspace: workspace,
				StoreName: storeName,
				LayerName: tableName,
				Bbox:      bbox,
				CreatedAt: time.Now(),
				UpdatedAt: time.Now(),
			}

			if err := facades.Orm().Query().Create(geolayer); err != nil {
				fmt.Printf("Failed to create database record for layer %s: %v\n", tableName, err)
				continue
			}

			publishedLayers = append(publishedLayers, *geolayer)
		}

		if len(publishedLayers) == 0 {
			facades.Storage().Delete(path)
			return ctx.Response().Json(http.StatusInternalServerError, http.Json{
				"message": "Failed to publish any layers from the GeoPackage",
			})
		}

		return ctx.Response().Json(http.StatusCreated, http.Json{
			"message": fmt.Sprintf("Successfully published %d layers", len(publishedLayers)),
			"layers":  publishedLayers,
		})

	case ".kml", ".kmz", ".json", ".geojson", ".dwg":
		// For KML/KMZ files, we'll skip trying to publish to GeoServer
		// and just store the file information in the database
		layerName := strings.TrimSuffix(uniqueName, extension)
		
		// Create database record for the file
		geolayer := &models.Geolayer{
			Name:      name,
			FilePath:  path,
			FileType:  extension,
			Workspace: workspace,
			StoreName: storeName,
			LayerName: layerName,
			Bbox:      bbox,
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}

		if err := facades.Orm().Query().Create(geolayer); err != nil {
			facades.Storage().Delete(path)
			return ctx.Response().Json(http.StatusInternalServerError, http.Json{
				"message": "Failed to create database record",
				"error":   err.Error(),
			})
		}

		// Convert file path to URL for response
		if geolayer.FilePath != "" {
			geolayer.FilePath = facades.Storage().Url(geolayer.FilePath)
		}

		return ctx.Response().Json(http.StatusCreated, http.Json{
			"message": "Layer successfully uploaded",
			"layer":   geolayer,
		})

	default:
		// Should never reach here due to validation above
		facades.Storage().Delete(path)
		return ctx.Response().Json(http.StatusBadRequest, http.Json{
			"message": "Unsupported file type",
		})
	}
}

// Update updates an existing geolayer
// @Summary Update a geolayer
// @Description Update an existing geolayer
// @Tags Geolayer
// @Accept multipart/form-data
// @Produce json
// @Param id path int true "Geolayer ID"
// @Param name formData string false "Layer name"
// @Param file formData file false "New layer file"
// @Success 200 {object} http.Response
// @Failure 400 {object} http.Response
// @Failure 404 {object} http.Response
// @Failure 500 {object} http.Response
// @Router /api/geolayers/{id} [put]
func (c *GeolayerController) Update(ctx http.Context) http.Response {
	id := ctx.Request().Route("id")

	// Find the geolayer
	var geolayer models.Geolayer
	if err := facades.Orm().Query().WhereNull("deleted_at").Find(&geolayer, id); err != nil {
		// Check if the error is a "record not found" error
		if err.Error() == "record not found" {
			return ctx.Response().Json(http.StatusNotFound, http.Json{
				"message": "Geolayer not found",
			})
		}

		return ctx.Response().Json(http.StatusInternalServerError, http.Json{
			"message": "Failed to retrieve geolayer",
			"error":   err.Error(),
		})
	}

	// Update name if provided
	if name := ctx.Request().Input("name"); name != "" {
		geolayer.Name = name
	}

	// Check if a new file is being uploaded
	file, err := ctx.Request().File("file")
	if err == nil && file != nil {
		originalName := file.GetClientOriginalName()
		extension := filepath.Ext(originalName)

		// Validate supported file types
		if !c.isSupportedFileType(extension) {
			return ctx.Response().Json(http.StatusBadRequest, http.Json{
				"message": "Unsupported file type. Supported types: .kml, .kmz, .json, .geojson, .gpkg, .dwg",
			})
		}

		// Delete old file
		if geolayer.FilePath != "" {
			facades.Storage().Delete(geolayer.FilePath)
		}

		// Delete old datastore from GeoServer if it's a GPKG file
		if geolayer.FileType == ".gpkg" {
			if err := c.geoserver.DeleteDataStore(geolayer.Workspace, geolayer.StoreName); err != nil {
				fmt.Printf("Warning: failed to delete old datastore: %v\n", err)
			}
		}

		// Store new file
		uniqueName := fmt.Sprintf("%d%s", time.Now().Unix(), extension)
		path, err := facades.Storage().PutFile("geolayers", file)
		if err != nil {
			return ctx.Response().Json(http.StatusInternalServerError, http.Json{
				"message": "Failed to save file",
				"error":   err.Error(),
			})
		}

		// Get the full path for processing
		fullPath := facades.Storage().Path(path)
		storeName := fmt.Sprintf("store_%s", strings.TrimSuffix(uniqueName, extension))

		// Process new file based on type
		switch strings.ToLower(extension) {
		case ".gpkg":
			// For GeoPackage, read the table names
			layerNames, err := c.geoserver.GetGeoPackageTableNames(fullPath)
			if err != nil {
				facades.Storage().Delete(path)
				return ctx.Response().Json(http.StatusBadRequest, http.Json{
					"message": "Failed to read GeoPackage tables",
					"error":   err.Error(),
				})
			}

			// Create datastore in GeoServer
			if err := c.geoserver.CreateDataStore(geolayer.Workspace, storeName, fullPath); err != nil {
				facades.Storage().Delete(path)
				return ctx.Response().Json(http.StatusInternalServerError, http.Json{
					"message": "Failed to create GeoServer datastore",
					"error":   err.Error(),
				})
			}

			// Publish the first layer (for update we'll just use the first layer to replace the old one)
			if len(layerNames) > 0 {
				if err := c.geoserver.PublishLayer(geolayer.Workspace, storeName, layerNames[0]); err != nil {
					facades.Storage().Delete(path)
					return ctx.Response().Json(http.StatusInternalServerError, http.Json{
						"message": "Failed to publish layer",
						"error":   err.Error(),
					})
				}

				// Update geolayer properties
				geolayer.FilePath = path
				geolayer.FileType = extension
				geolayer.StoreName = storeName
				geolayer.LayerName = layerNames[0]
			} else {
				facades.Storage().Delete(path)
				return ctx.Response().Json(http.StatusBadRequest, http.Json{
					"message": "No layers found in GeoPackage",
				})
			}

		case ".kml", ".kmz", ".json", ".geojson", ".dwg":
			// For other file types, just update the database record
			layerName := strings.TrimSuffix(uniqueName, extension)

			// Update geolayer properties
			geolayer.FilePath = path
			geolayer.FileType = extension
			geolayer.StoreName = storeName
			geolayer.LayerName = layerName
		}
	}

	// Update the timestamp
	geolayer.UpdatedAt = time.Now()

	// Save the changes
	if err := facades.Orm().Query().Save(&geolayer); err != nil {
		return ctx.Response().Json(http.StatusInternalServerError, http.Json{
			"message": "Failed to update geolayer",
			"error":   err.Error(),
		})
	}

	// Convert file path to full URL for response
	if geolayer.FilePath != "" && !strings.HasPrefix(geolayer.FilePath, "http") {
		geolayer.FilePath = facades.Storage().Url(geolayer.FilePath)
	}

	return ctx.Response().Json(http.StatusOK, http.Json{
		"message": "Geolayer updated successfully",
		"data":    geolayer,
	})
}

// Destroy soft-deletes a geolayer
// @Summary Delete a geolayer
// @Description Soft delete a geolayer by ID
// @Tags Geolayer
// @Accept json
// @Produce json
// @Param id path int true "Geolayer ID"
// @Success 200 {object} http.Response
// @Failure 404 {object} http.Response
// @Failure 500 {object} http.Response
// @Router /api/geolayers/{id} [delete]
func (c *GeolayerController) Destroy(ctx http.Context) http.Response {
	id := ctx.Request().Route("id")

	var geolayer models.Geolayer
	if err := facades.Orm().Query().WhereNull("deleted_at").Find(&geolayer, id); err != nil {
		if err.Error() == "record not found" {
			return ctx.Response().Json(http.StatusNotFound, http.Json{
				"message": "Geolayer not found",
			})
		}

		return ctx.Response().Json(http.StatusInternalServerError, http.Json{
			"message": "Failed to retrieve geolayer",
			"error":   err.Error(),
		})
	}

	// Soft delete by setting deleted_at timestamp
	now := time.Now()
	geolayer.DeletedAt = &now

	if err := facades.Orm().Query().Save(&geolayer); err != nil {
		return ctx.Response().Json(http.StatusInternalServerError, http.Json{
			"message": "Failed to delete geolayer",
			"error":   err.Error(),
		})
	}

	return ctx.Response().Json(http.StatusOK, http.Json{
		"message": "Geolayer deleted successfully",
	})
}

// ForceDestroy permanently deletes a geolayer
// @Summary Permanently delete a geolayer
// @Description Permanently delete a geolayer and its files
// @Tags Geolayer
// @Accept json
// @Produce json
// @Param id path int true "Geolayer ID"
// @Success 200 {object} http.Response
// @Failure 404 {object} http.Response
// @Failure 500 {object} http.Response
// @Router /api/geolayers/{id}/force [delete]
func (c *GeolayerController) ForceDestroy(ctx http.Context) http.Response {
	id := ctx.Request().Route("id")

	var geolayer models.Geolayer
	if err := facades.Orm().Query().Find(&geolayer, id); err != nil {
		if err.Error() == "record not found" {
			return ctx.Response().Json(http.StatusNotFound, http.Json{
				"message": "Geolayer not found",
			})
		}

		return ctx.Response().Json(http.StatusInternalServerError, http.Json{
			"message": "Failed to retrieve geolayer",
			"error":   err.Error(),
		})
	}

	// Delete file
	if geolayer.FilePath != "" {
		if err := facades.Storage().Delete(geolayer.FilePath); err != nil {
			fmt.Printf("Warning: failed to delete file: %v\n", err)
		}
	}

	// Delete from GeoServer if it's a GPKG file
	if geolayer.FileType == ".gpkg" {
		if err := c.geoserver.DeleteDataStore(geolayer.Workspace, geolayer.StoreName); err != nil {
			fmt.Printf("Warning: failed to delete datastore from GeoServer: %v\n", err)
		}
	}

	// Delete from database
	if _, err := facades.Orm().Query().Delete(&geolayer); err != nil {
		return ctx.Response().Json(http.StatusInternalServerError, http.Json{
			"message": "Failed to delete geolayer from database",
			"error":   err.Error(),
		})
	}

	return ctx.Response().Json(http.StatusOK, http.Json{
		"message": "Geolayer permanently deleted",
	})
}

// Restore restores a soft-deleted geolayer
// @Summary Restore a geolayer
// @Description Restore a soft-deleted geolayer
// @Tags Geolayer
// @Accept json
// @Produce json
// @Param id path int true "Geolayer ID"
// @Success 200 {object} http.Response
// @Failure 404 {object} http.Response
// @Failure 500 {object} http.Response
// @Router /api/geolayers/{id}/restore [put]
func (c *GeolayerController) Restore(ctx http.Context) http.Response {
	id := ctx.Request().Route("id")

	var geolayer models.Geolayer
	if err := facades.Orm().Query().WhereNotNull("deleted_at").Find(&geolayer, id); err != nil {
		if err.Error() == "record not found" {
			return ctx.Response().Json(http.StatusNotFound, http.Json{
				"message": "Deleted geolayer not found",
			})
		}

		return ctx.Response().Json(http.StatusInternalServerError, http.Json{
			"message": "Failed to retrieve geolayer",
			"error":   err.Error(),
		})
	}

	// Restore by setting DeletedAt to nil
	geolayer.DeletedAt = nil
	geolayer.UpdatedAt = time.Now()

	// Save the changes
	if err := facades.Orm().Query().Save(&geolayer); err != nil {
		return ctx.Response().Json(http.StatusInternalServerError, http.Json{
			"message": "Failed to restore geolayer",
			"error":   err.Error(),
		})
	}

	// Convert file path to full URL for response
	if geolayer.FilePath != "" && !strings.HasPrefix(geolayer.FilePath, "http") {
		geolayer.FilePath = facades.Storage().Url(geolayer.FilePath)
	}

	return ctx.Response().Json(http.StatusOK, http.Json{
		"message": "Geolayer restored successfully",
		"data":    geolayer,
	})
}

// Helper methods

// isSupportedFileType checks if the file extension is supported
func (c *GeolayerController) isSupportedFileType(extension string) bool {
	ext := strings.ToLower(extension)
	supportedTypes := map[string]bool{
		".kml":     true,
		".kmz":     true,
		".json":    true,
		".geojson": true,
		".gpkg":    true,
		".dwg":     true,
	}
	return supportedTypes[ext]
}

func (c *GeolayerController) handleNonGeoPackageFile(workspace, storeName, layerName, filePath, fileType string) error {
	// Process different file types
	switch strings.ToLower(fileType) {
	case ".kml", ".kmz":
		// Try multiple approaches for KML/KMZ files

		// First, try the simple approach
		err := c.geoserver.UploadSimpleKMLFile(workspace, storeName, layerName, filePath)
		if err != nil {
			fmt.Printf("Simple KML upload failed, trying external layer approach: %v\n", err)

			// If that fails, try registering as external layer
			err = c.geoserver.RegisterKMLAsExternalLayer(workspace, storeName, layerName, filePath)
			if err != nil {
				fmt.Printf("External layer approach failed: %v\n", err)

				// If all else fails, we'll need to implement a conversion process
				// Convert KML to Shapefile or another format GeoServer natively supports
				return fmt.Errorf("Unable to process KML/KMZ file with available GeoServer extensions. " +
					"Consider installing the KML extension for GeoServer or converting the file to a different format.")
			}
		}
		return nil

	case ".json", ".geojson":
		// GeoJSON specific processing
		// You might need to create a custom GeoServer endpoint or use specific GeoJSON handling APIs
		return fmt.Errorf("GeoJSON support not yet implemented")

	case ".dwg":
		// DWG specific processing
		// This would require special handling, possibly with additional services
		return fmt.Errorf("DWG file support not yet implemented")

	default:
		return fmt.Errorf("unsupported file type: %s", fileType)
	}
}
