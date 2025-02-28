package controllers

import (
	"fmt"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/goravel/framework/contracts/http"
	"github.com/goravel/framework/facades"

	// "goravel/app/http/requests"
	"goravel/app/models"
)

type KapalController struct {
	// You could inject services here
	// kapalService services.KapalServiceInterface
}

func NewKapalController() *KapalController {
	return &KapalController{
		// Initialize services
		// kapalService: services.NewKapalService(),
	}
}

// View returns the HTML for the kapal management view
// @Summary Get vessel management view
// @Description Returns HTML for vessel management interface
// @Tags Kapal
// @Accept json
// @Produce html
// @Success 200 {string} string
// @Router /api/kapal/view [get]
func (c *KapalController) View(ctx http.Context) http.Response {
	// Return the HTML template for the vessel management interface
	return ctx.Response().View().Make("pages/vessel_modal.html")
}

// Index returns a list of all vessels
// @Summary Get all vessels
// @Description Get a list of all vessels
// @Tags Kapal
// @Accept json
// @Produce json
// @Success 200 {object} http.Response
// @Failure 500 {object} http.Response
// @Router /api/kapal [get]
func (c *KapalController) Index(ctx http.Context) http.Response {
	var kapals []models.Kapal

	// Get query parameters for pagination
	page, _ := strconv.Atoi(ctx.Request().Query("page", "1"))
	limit, _ := strconv.Atoi(ctx.Request().Query("limit", "10"))

	// Get query parameter for including soft deleted records
	withTrashed := ctx.Request().Query("with_trashed", "false") == "true"

	// Initialize query builder
	query := facades.Orm().Query()

	// Apply filters if provided
	if flag := ctx.Request().Query("flag", ""); flag != "" {
		query = query.Where("flag", flag)
	}

	if kelas := ctx.Request().Query("kelas", ""); kelas != "" {
		query = query.Where("kelas", kelas)
	}

	if recordStatus := ctx.Request().Query("record_status", ""); recordStatus != "" {
		// Convert string to bool if provided
		if recordStatus == "true" {
			query = query.Where("record_status", true)
		} else if recordStatus == "false" {
			query = query.Where("record_status", false)
		}
	}

	// Handle soft deletes
	if !withTrashed {
		query = query.WhereNull("deleted_at")
	}

	// Get total count for pagination
	var total int64
	if err := query.Model(&models.Kapal{}).Count(&total); err != nil {
		return ctx.Response().Json(http.StatusInternalServerError, http.Json{
			"message": "Failed to count records",
			"error":   err.Error(),
		})
	}

	// Execute the paginated query
	offset := (page - 1) * limit
	if err := query.Model(&models.Kapal{}).Offset(offset).Limit(limit).Find(&kapals); err != nil {
		return ctx.Response().Json(http.StatusInternalServerError, http.Json{
			"message": "Failed to retrieve vessels",
			"error":   err.Error(),
		})
	}

	// Process image URLs for each vessel
	for i := range kapals {
		if kapals[i].Image != "" && !strings.HasPrefix(kapals[i].Image, "http") {
			kapals[i].Image = facades.Storage().Url(kapals[i].Image)
		}
		if kapals[i].ImageMap != "" && !strings.HasPrefix(kapals[i].ImageMap, "http") {
			kapals[i].ImageMap = facades.Storage().Url(kapals[i].ImageMap)
		}
	}

	// Return response with pagination info
	return ctx.Response().Json(http.StatusOK, http.Json{
		"data": kapals,
		"meta": http.Json{
			"current_page": page,
			"per_page":     limit,
			"total":        total,
			"last_page":    (int(total) + limit - 1) / limit,
		},
	})
}

// Show returns a single vessel by call sign
// @Summary Get a vessel
// @Description Get a vessel by call sign
// @Tags Kapal
// @Accept json
// @Produce json
// @Param call_sign path string true "Call Sign"
// @Success 200 {object} http.Response
// @Failure 404 {object} http.Response
// @Failure 500 {object} http.Response
// @Router /api/kapal/{call_sign} [get]
func (c *KapalController) Show(ctx http.Context) http.Response {
	callSign := ctx.Request().Route("call_sign")

	var kapal models.Kapal

	// Try to find the vessel, including soft deleted if requested
	withTrashed := ctx.Request().Query("with_trashed", "false") == "true"

	query := facades.Orm().Query().Where("call_sign", callSign)
	if !withTrashed {
		query = query.WhereNull("deleted_at")
	}

	if err := query.First(&kapal); err != nil {
		// Check if the error is a "record not found" error
		if err.Error() == "record not found" {
			return ctx.Response().Json(http.StatusNotFound, http.Json{
				"message": "Vessel not found",
			})
		}

		return ctx.Response().Json(http.StatusInternalServerError, http.Json{
			"message": "Failed to retrieve vessel",
			"error":   err.Error(),
		})
	}

	// Convert image paths to full URLs
	if kapal.Image != "" && !strings.HasPrefix(kapal.Image, "http") {
		kapal.Image = facades.Storage().Url(kapal.Image)
	}
	if kapal.ImageMap != "" && !strings.HasPrefix(kapal.ImageMap, "http") {
		kapal.ImageMap = facades.Storage().Url(kapal.ImageMap)
	}

	return ctx.Response().Json(http.StatusOK, http.Json{
		"data": kapal,
	})
}

// Store creates a new vessel
// @Summary Create a vessel
// @Description Create a new vessel
// @Tags Kapal
// @Accept multipart/form-data
// @Produce json
// @Param call_sign formData string true "Call Sign"
// @Param flag formData string true "Flag"
// @Param kelas formData string true "Class"
// @Param builder formData string true "Builder"
// @Param year_built formData int true "Year Built"
// @Param heading_direction formData int true "Heading Direction"
// @Param calibration formData float true "Calibration"
// @Param width_m formData float true "Width in meters"
// @Param length_m formData float true "Length in meters"
// @Param bow_to_stern formData float true "Bow to Stern"
// @Param port_to_starboard formData float true "Port to Starboard"
// @Param history_per_second formData int true "History Per Second"
// @Param minimum_knot_per_liter_gasoline formData float true "Minimum Knot Per Liter Gasoline"
// @Param maximum_knot_per_liter_gasoline formData float true "Maximum Knot Per Liter Gasoline"
// @Param record_status formData bool true "Record Status"
// @Param image_file formData file false "Vessel Image"
// @Param image_map_file formData file false "Vessel Map Image"
// @Success 201 {object} http.Response
// @Failure 400 {object} http.Response
// @Failure 500 {object} http.Response
// @Router /api/kapal [post]
func (c *KapalController) Store(ctx http.Context) http.Response {
	// Get form data
	callSign := ctx.Request().Input("call_sign")
	if callSign == "" {
		return ctx.Response().Json(http.StatusBadRequest, http.Json{
			"message": "Call sign is required",
		})
	}

	// Check if vessel with this call sign already exists
	var existingCount int64
	if err := facades.Orm().Query().Model(&models.Kapal{}).Where("call_sign", callSign).Count(&existingCount); err != nil {
		return ctx.Response().Json(http.StatusInternalServerError, http.Json{
			"message": "Failed to check for existing vessel",
			"error":   err.Error(),
		})
	}

	if existingCount > 0 {
		return ctx.Response().Json(http.StatusBadRequest, http.Json{
			"message": "A vessel with this call sign already exists",
		})
	}

	// Create new vessel
	kapal := models.Kapal{
		CallSign:                    callSign,
		Flag:                        ctx.Request().Input("flag"),
		Kelas:                       ctx.Request().Input("kelas"),
		Builder:                     ctx.Request().Input("builder"),
		YearBuilt:                   uint(c.parseIntField(ctx, "year_built")),
		HeadingDirection:            int64(c.parseIntField(ctx, "heading_direction")),
		Calibration:                 int64(c.parseFloatField(ctx, "calibration")),
		WidthM:                      int64(c.parseFloatField(ctx, "width_m")),
		LengthM:                     int64(c.parseFloatField(ctx, "length_m")),
		BowToStern:                  int64(c.parseFloatField(ctx, "bow_to_stern")),
		PortToStarboard:             int64(c.parseFloatField(ctx, "port_to_starboard")),
		HistoryPerSecond:            int64(c.parseIntField(ctx, "history_per_second")),
		MinimumKnotPerLiterGasoline: c.parseFloatField(ctx, "minimum_knot_per_liter_gasoline"),
		MaximumKnotPerLiterGasoline: c.parseFloatField(ctx, "maximum_knot_per_liter_gasoline"),
		RecordStatus:                ctx.Request().Input("record_status") == "true",
		CreatedAt:                   time.Now(),
		UpdatedAt:                   time.Now(),
	}

	// Handle image uploads
	imageFile, err := ctx.Request().File("image_file")
	if err == nil && imageFile != nil {
		// Generate a unique filename
		extension := filepath.Ext(imageFile.GetClientOriginalName())
		uniqueName := fmt.Sprintf("vessel_%s_%d%s", callSign, time.Now().Unix(), extension)
		
		// Store the file using PutFileAs
		imagePath, err := facades.Storage().Disk("public").PutFileAs("vessels/vessel", imageFile, uniqueName)
		if err != nil {
			return ctx.Response().Json(http.StatusInternalServerError, http.Json{
				"message": "Failed to save vessel image",
				"error":   err.Error(),
			})
		}
		
		kapal.Image = imagePath
	}

	// Handle map image uploads
	imageMapFile, err := ctx.Request().File("image_map_file")
	if err == nil && imageMapFile != nil {
		// Generate a unique filename
		extension := filepath.Ext(imageMapFile.GetClientOriginalName())
		uniqueName := fmt.Sprintf("vessel_map_%s_%d%s", callSign, time.Now().Unix(), extension)
		
		// Store the file using PutFileAs
		imagePath, err := facades.Storage().Disk("public").PutFileAs("vessels/vessel_map", imageMapFile, uniqueName)
		if err != nil {
			return ctx.Response().Json(http.StatusInternalServerError, http.Json{
				"message": "Failed to save vessel map image",
				"error":   err.Error(),
			})
		}
		
		kapal.ImageMap = imagePath
	}

	// Save to database
	if err := facades.Orm().Query().Create(&kapal); err != nil {
		return ctx.Response().Json(http.StatusInternalServerError, http.Json{
			"message": "Failed to create vessel",
			"error":   err.Error(),
		})
	}

	// Convert image paths to full URLs for response
	if kapal.Image != "" && !strings.HasPrefix(kapal.Image, "http") {
		kapal.Image = facades.Storage().Url(kapal.Image)
	}
	if kapal.ImageMap != "" && !strings.HasPrefix(kapal.ImageMap, "http") {
		kapal.ImageMap = facades.Storage().Url(kapal.ImageMap)
	}

	return ctx.Response().Json(http.StatusCreated, http.Json{
		"message": "Vessel created successfully",
		"data":    kapal,
	})
}

// Update updates an existing vessel
// @Summary Update a vessel
// @Description Update an existing vessel
// @Tags Kapal
// @Accept multipart/form-data
// @Produce json
// @Param call_sign path string true "Call Sign"
// @Param flag formData string false "Flag"
// @Param kelas formData string false "Class"
// @Param builder formData string false "Builder"
// @Param year_built formData int false "Year Built"
// @Param heading_direction formData int false "Heading Direction"
// @Param calibration formData float false "Calibration"
// @Param width_m formData float false "Width in meters"
// @Param length_m formData float false "Length in meters"
// @Param bow_to_stern formData float false "Bow to Stern"
// @Param port_to_starboard formData float false "Port to Starboard"
// @Param history_per_second formData int false "History Per Second"
// @Param minimum_knot_per_liter_gasoline formData float false "Minimum Knot Per Liter Gasoline"
// @Param maximum_knot_per_liter_gasoline formData float false "Maximum Knot Per Liter Gasoline"
// @Param record_status formData bool false "Record Status"
// @Param image_file formData file false "Vessel Image"
// @Param image_map_file formData file false "Vessel Map Image"
// @Param remove_image formData bool false "Remove vessel image"
// @Param remove_image_map formData bool false "Remove vessel map image"
// @Success 200 {object} http.Response
// @Failure 400 {object} http.Response
// @Failure 404 {object} http.Response
// @Failure 500 {object} http.Response
// @Router /api/kapal/{call_sign} [put]
func (c *KapalController) Update(ctx http.Context) http.Response {
	callSign := ctx.Request().Route("call_sign")

	// First, find the vessel
	var kapal models.Kapal
	if err := facades.Orm().Query().Where("call_sign", callSign).WhereNull("deleted_at").First(&kapal); err != nil {
		// Check if the error is a "record not found" error
		if err.Error() == "record not found" {
			return ctx.Response().Json(http.StatusNotFound, http.Json{
				"message": "Vessel not found",
			})
		}

		return ctx.Response().Json(http.StatusInternalServerError, http.Json{
			"message": "Failed to retrieve vessel",
			"error":   err.Error(),
		})
	}

	// Update vessel data from form input
	if flag := ctx.Request().Input("flag"); flag != "" {
		kapal.Flag = flag
	}
	if kelas := ctx.Request().Input("kelas"); kelas != "" {
		kapal.Kelas = kelas
	}
	if builder := ctx.Request().Input("builder"); builder != "" {
		kapal.Builder = builder
	}
	if yearBuilt := uint(c.parseIntField(ctx, "year_built")); yearBuilt != 0 {
		kapal.YearBuilt = yearBuilt
	}
	if headingDirection := int64(c.parseIntField(ctx, "heading_direction")); headingDirection != 0 {
		kapal.HeadingDirection = headingDirection
	}
	if calibration := int64(c.parseFloatField(ctx, "calibration")); calibration != 0 {
		kapal.Calibration = calibration
	}
	if widthM := int64(c.parseFloatField(ctx, "width_m")); widthM != 0 {
		kapal.WidthM = widthM
	}
	if lengthM := int64(c.parseFloatField(ctx, "length_m")); lengthM != 0 {
		kapal.LengthM = lengthM
	}
	if bowToStern := int64(c.parseFloatField(ctx, "bow_to_stern")); bowToStern != 0 {
		kapal.BowToStern = bowToStern
	}
	if portToStarboard := int64(c.parseFloatField(ctx, "port_to_starboard")); portToStarboard != 0 {
		kapal.PortToStarboard = portToStarboard
	}
	if historyPerSecond := int64(c.parseIntField(ctx, "history_per_second")); historyPerSecond != 0 {
		kapal.HistoryPerSecond = historyPerSecond
	}
	if minKnot := c.parseFloatField(ctx, "minimum_knot_per_liter_gasoline"); minKnot != 0 {
		kapal.MinimumKnotPerLiterGasoline = minKnot
	}
	if maxKnot := c.parseFloatField(ctx, "maximum_knot_per_liter_gasoline"); maxKnot != 0 {
		kapal.MaximumKnotPerLiterGasoline = maxKnot
	}

	// Update record status if provided
	if recordStatus := ctx.Request().Input("record_status"); recordStatus != "" {
		kapal.RecordStatus = recordStatus == "true"
	}

	// Check if we should remove the vessel image
	removeImage := ctx.Request().Input("remove_image") == "true"
	if removeImage && kapal.Image != "" && !strings.HasPrefix(kapal.Image, "http") {
		// Delete the image file
		facades.Storage().Delete(kapal.Image)
		kapal.Image = ""
	}

	// Check if we should remove the vessel map image
	removeImageMap := ctx.Request().Input("remove_image_map") == "true"
	if removeImageMap && kapal.ImageMap != "" && !strings.HasPrefix(kapal.ImageMap, "http") {
		// Delete the image map file
		facades.Storage().Delete(kapal.ImageMap)
		kapal.ImageMap = ""
	}

	// Handle image uploads
	imageFile, err := ctx.Request().File("image_file")
	fmt.Println(imageFile)
	if err == nil && imageFile != nil {
		// Delete old image if exists (only if we're uploading a new image)
		if kapal.Image != "" && !strings.HasPrefix(kapal.Image, "http") {
			facades.Storage().Delete(kapal.Image)
		}

		// Generate a unique filename
		extension := filepath.Ext(imageFile.GetClientOriginalName())
		uniqueName := fmt.Sprintf("vessel_%s_%d%s", callSign, time.Now().Unix(), extension)
		
		// Store the file using PutFileAs
		imagePath, err := facades.Storage().Disk("public").PutFileAs("vessels/vessel", imageFile, uniqueName)
		if err != nil {
			return ctx.Response().Json(http.StatusInternalServerError, http.Json{
				"message": "Failed to save vessel image",
				"error":   err.Error(),
			})
		}
		
		kapal.Image = imagePath
	}

	// Handle map image uploads
	imageMapFile, err := ctx.Request().File("image_map_file")
	if err == nil && imageMapFile != nil {
		// Delete old image if exists (only if we're uploading a new image)
		if kapal.ImageMap != "" && !strings.HasPrefix(kapal.ImageMap, "http") {
			facades.Storage().Delete(kapal.ImageMap)
		}

		// Generate a unique filename
		extension := filepath.Ext(imageMapFile.GetClientOriginalName())
		uniqueName := fmt.Sprintf("vessel_map_%s_%d%s", callSign, time.Now().Unix(), extension)
		
		// Store the file using PutFileAs
		imagePath, err := facades.Storage().Disk("public").PutFileAs("vessels/vessel_map", imageMapFile, uniqueName)
		if err != nil {
			return ctx.Response().Json(http.StatusInternalServerError, http.Json{
				"message": "Failed to save vessel map image",
				"error":   err.Error(),
			})
		}
		
		kapal.ImageMap = imagePath
	}

	// Always update the UpdatedAt timestamp
	kapal.UpdatedAt = time.Now()

	// Save the updated vessel
	if err := facades.Orm().Query().Save(&kapal); err != nil {
		return ctx.Response().Json(http.StatusInternalServerError, http.Json{
			"message": "Failed to update vessel",
			"error":   err.Error(),
		})
	}

	// Convert image paths to full URLs for response
	if kapal.Image != "" && !strings.HasPrefix(kapal.Image, "http") {
		kapal.Image = facades.Storage().Url(kapal.Image)
	}
	if kapal.ImageMap != "" && !strings.HasPrefix(kapal.ImageMap, "http") {
		kapal.ImageMap = facades.Storage().Url(kapal.ImageMap)
	}

	return ctx.Response().Json(http.StatusOK, http.Json{
		"message": "Vessel updated successfully",
		"data":    kapal,
	})
}

// Destroy soft deletes a vessel
// @Summary Delete a vessel
// @Description Soft delete a vessel by call sign
// @Tags Kapal
// @Accept json
// @Produce json
// @Param call_sign path string true "Call Sign"
// @Success 200 {object} http.Response
// @Failure 404 {object} http.Response
// @Failure 500 {object} http.Response
// @Router /api/kapal/{call_sign} [delete]
func (c *KapalController) Destroy(ctx http.Context) http.Response {
	callSign := ctx.Request().Route("call_sign")

	// Find the vessel
	var kapal models.Kapal
	if err := facades.Orm().Query().Where("call_sign", callSign).WhereNull("deleted_at").First(&kapal); err != nil {
		if err.Error() == "record not found" {
			return ctx.Response().Json(http.StatusNotFound, http.Json{
				"message": "Vessel not found",
			})
		}

		return ctx.Response().Json(http.StatusInternalServerError, http.Json{
			"message": "Failed to retrieve vessel",
			"error":   err.Error(),
		})
	}

	// Perform soft delete by setting the DeletedAt timestamp
	now := time.Now()
	kapal.DeletedAt = &now

	if err := facades.Orm().Query().Save(&kapal); err != nil {
		return ctx.Response().Json(http.StatusInternalServerError, http.Json{
			"message": "Failed to delete vessel",
			"error":   err.Error(),
		})
	}

	return ctx.Response().Json(http.StatusOK, http.Json{
		"message": "Vessel deleted successfully",
	})
}

// Restore restores a soft-deleted vessel
// @Summary Restore a vessel
// @Description Restore a soft-deleted vessel
// @Tags Kapal
// @Accept json
// @Produce json
// @Param call_sign path string true "Call Sign"
// @Success 200 {object} http.Response
// @Failure 404 {object} http.Response
// @Failure 500 {object} http.Response
// @Router /api/kapal/{call_sign}/restore [put]
func (c *KapalController) Restore(ctx http.Context) http.Response {
	callSign := ctx.Request().Route("call_sign")

	// Find the soft-deleted vessel
	var kapal models.Kapal
	if err := facades.Orm().Query().Where("call_sign", callSign).WhereNotNull("deleted_at").First(&kapal); err != nil {
		// Check if the error is a "record not found" error
		if err.Error() == "record not found" {
			return ctx.Response().Json(http.StatusNotFound, http.Json{
				"message": "Deleted vessel not found",
			})
		}

		return ctx.Response().Json(http.StatusInternalServerError, http.Json{
			"message": "Failed to retrieve vessel",
			"error":   err.Error(),
		})
	}

	// Restore by setting DeletedAt to nil
	kapal.DeletedAt = nil
	kapal.UpdatedAt = time.Now()

	if err := facades.Orm().Query().Save(&kapal); err != nil {
		return ctx.Response().Json(http.StatusInternalServerError, http.Json{
			"message": "Failed to restore vessel",
			"error":   err.Error(),
		})
	}

	// Convert image paths to full URLs for response
	if kapal.Image != "" && !strings.HasPrefix(kapal.Image, "http") {
		kapal.Image = facades.Storage().Url(kapal.Image)
	}
	if kapal.ImageMap != "" && !strings.HasPrefix(kapal.ImageMap, "http") {
		kapal.ImageMap = facades.Storage().Url(kapal.ImageMap)
	}

	return ctx.Response().Json(http.StatusOK, http.Json{
		"message": "Vessel restored successfully",
		"data":    kapal,
	})
}

// Helper functions

// parseIntField safely parses an integer field from the request
func (c *KapalController) parseIntField(ctx http.Context, fieldName string) int {
	value := ctx.Request().Input(fieldName)
	if value == "" {
		return 0
	}

	intValue, err := strconv.Atoi(value)
	if err != nil {
		return 0
	}

	return intValue
}

// parseFloatField safely parses a float field from the request
func (c *KapalController) parseFloatField(ctx http.Context, fieldName string) float64 {
	value := ctx.Request().Input(fieldName)
	if value == "" {
		return 0
	}

	floatValue, err := strconv.ParseFloat(value, 64)
	if err != nil {
		return 0
	}

	return floatValue
}