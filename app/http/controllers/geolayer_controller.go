package controllers

import (
	"fmt"
	"goravel/app/models"
	"goravel/app/services"
	"path/filepath"
	"strings"
	"time"

	"github.com/goravel/framework/contracts/http"
	"github.com/goravel/framework/facades"
	// "github.com/goravel/framework/filesystem"
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

func (c *GeolayerController) Index(ctx http.Context) http.Response {
	var layers []models.Geolayer
	if err := facades.Orm().Query().Find(&layers); err != nil {
		return ctx.Response().Json(http.StatusInternalServerError, map[string]string{
			"error": "Failed to fetch layers",
		})
	}

	// Convert to response format
	response := make([]map[string]interface{}, len(layers))
	for i, layer := range layers {
		response[i] = map[string]interface{}{
			"id":         layer.ID,
			"name":       layer.Name,
			"workspace":  layer.Workspace,
			"layer_name": layer.LayerName,
			"file_type":  layer.FileType,
		}
	}

	return ctx.Response().Json(http.StatusOK, response)
}
func (c *GeolayerController) Store(ctx http.Context) http.Response {
    // Get the uploaded file
    file, err := ctx.Request().File("file")
    if err != nil {
        return ctx.Response().Json(http.StatusBadRequest, map[string]string{
            "error": "Invalid file upload",
        })
    }

    // Generate a unique filename
    originalName := file.GetClientOriginalName()
    extension := filepath.Ext(originalName)
    uniqueName := fmt.Sprintf("%d%s", time.Now().Unix(), extension)

    // Store file using Goravel's Storage facade
    path, err := facades.Storage().PutFile("geolayers", file)
    if err != nil {
        return ctx.Response().Json(http.StatusInternalServerError, map[string]string{
            "error": "Failed to save file",
        })
    }

    // Get the full path for GeoServer
    fullPath := facades.Storage().Path(path)

    // Read table names from GeoPackage
    tableNames, err := c.geoserver.GetGeoPackageTableNames(fullPath)
    if err != nil {
        facades.Storage().Delete(path)
        return ctx.Response().Json(http.StatusBadRequest, map[string]string{
            "error": fmt.Sprintf("Failed to read GeoPackage tables: %v", err),
        })
    }

    // Create workspace if it doesn't exist
    workspace := "geolayers"
    if err := c.geoserver.CreateWorkspace(workspace); err != nil {
        fmt.Printf("Workspace creation error (might exist already): %v\n", err)
    }

    // Generate store name (without extension)
    storeName := fmt.Sprintf("store_%s", strings.TrimSuffix(uniqueName, extension))

    // Create datastore in GeoServer
    if err := c.geoserver.CreateDataStore(workspace, storeName, fullPath); err != nil {
        facades.Storage().Delete(path)
        return ctx.Response().Json(http.StatusInternalServerError, map[string]string{
            "error": fmt.Sprintf("Failed to create GeoServer datastore: %v", err),
        })
    }

    // Publish each layer in the GeoPackage
    var publishedLayers []models.Geolayer
    for _, tableName := range tableNames {
        // Publish the layer
        if err := c.geoserver.PublishLayer(workspace, storeName, tableName); err != nil {
            // Log error but continue with other layers
            fmt.Printf("Failed to publish layer %s: %v\n", tableName, err)
            continue
        }

        // Create database record for each layer
        geolayer := &models.Geolayer{
            Name:      fmt.Sprintf("%s-%s", originalName, tableName),
            FilePath:  path,
            FileType:  extension,
            Workspace: workspace,
            StoreName: storeName,
            LayerName: tableName,
        }

        if err := facades.Orm().Query().Create(geolayer); err != nil {
            fmt.Printf("Failed to create database record for layer %s: %v\n", tableName, err)
            continue
        }

        publishedLayers = append(publishedLayers, *geolayer)
    }

    if len(publishedLayers) == 0 {
        facades.Storage().Delete(path)
        return ctx.Response().Json(http.StatusInternalServerError, map[string]string{
            "error": "Failed to publish any layers from the GeoPackage",
        })
    }

    return ctx.Response().Json(http.StatusCreated, map[string]interface{}{
        "message": fmt.Sprintf("Successfully published %d layers", len(publishedLayers)),
        "layers":  publishedLayers,
    })
}

func (c *GeolayerController) Destroy(ctx http.Context) http.Response {
	id := ctx.Request().Input("id")

	var geolayer models.Geolayer
	if err := facades.Orm().Query().Find(&geolayer, id); err != nil {
		return ctx.Response().Json(http.StatusNotFound, map[string]string{
			"error": "Layer not found",
		})
	}

	// Delete from GeoServer
	if err := c.geoserver.DeleteDataStore(geolayer.Workspace, geolayer.StoreName); err != nil {
		return ctx.Response().Json(http.StatusInternalServerError, map[string]string{
			"error": "Failed to delete from GeoServer",
		})
	}

	// Delete file using Storage facade
	if err := facades.Storage().Delete(geolayer.FilePath); err != nil {
		// Log error but continue
	}

	// Delete database record
	if _, err := facades.Orm().Query().Delete(&geolayer); err != nil {
		return ctx.Response().Json(http.StatusInternalServerError, map[string]string{
			"error": "Failed to delete database record",
		})
	}

	return ctx.Response().Json(http.StatusOK, map[string]string{
		"message": "Layer deleted successfully",
	})
}
