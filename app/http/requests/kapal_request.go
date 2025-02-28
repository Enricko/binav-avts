package requests

import (
	"github.com/goravel/framework/contracts/http"
	"github.com/goravel/framework/contracts/validation"
)

// KapalRequest represents the request data structure for creating a vessel
type KapalRequest struct {
	CallSign                    string  `form:"call_sign" json:"call_sign"`
	Flag                        string  `form:"flag" json:"flag"`
	Kelas                       string  `form:"kelas" json:"kelas"`
	Builder                     string  `form:"builder" json:"builder"`
	YearBuilt                   uint    `form:"year_built" json:"year_built"`
	HeadingDirection            int64   `form:"heading_direction" json:"heading_direction"`
	Calibration                 int64   `form:"calibration" json:"calibration"`
	WidthM                      int64   `form:"width_m" json:"width_m"`
	LengthM                     int64   `form:"length_m" json:"length_m"`
	BowToStern                  int64   `form:"bow_to_stern" json:"bow_to_stern"`
	PortToStarboard             int64   `form:"port_to_starboard" json:"port_to_starboard"`
	ImageMap                    string  `form:"image_map" json:"image_map"`
	Image                       string  `form:"image" json:"image"`
	HistoryPerSecond            int64   `form:"history_per_second" json:"history_per_second"`
	MinimumKnotPerLiterGasoline float64 `form:"minimum_knot_per_liter_gasoline" json:"minimum_knot_per_liter_gasoline"`
	MaximumKnotPerLiterGasoline float64 `form:"maximum_knot_per_liter_gasoline" json:"maximum_knot_per_liter_gasoline"`
	RecordStatus                bool    `form:"record_status" json:"record_status"`
}

// Authorize indicates if the current user can make this request
func (r *KapalRequest) Authorize(ctx http.Context) error {
	// Implement authorization logic here if needed
	// For example, check if the user has the right permission
	return nil
}

// Rules returns the validation rules for the request
func (r *KapalRequest) Rules(ctx http.Context) map[string]string {
	return map[string]string{
		"call_sign":                      "required|string|max:255",
		"flag":                           "required|string|max:300",
		"kelas":                          "required|string|max:300",
		"builder":                        "required|string|max:300",
		"year_built":                     "required|numeric|min:1900|max:2100",
		"heading_direction":              "required|numeric|min:0|max:359",
		"calibration":                    "required|numeric",
		"width_m":                        "required|numeric|min:1",
		"length_m":                       "required|numeric|min:1",
		"bow_to_stern":                   "required|numeric|min:1",
		"port_to_starboard":              "required|numeric|min:1",
		"image_map":                      "required|string",
		"image":                          "required|string",
		"history_per_second":             "required|numeric|min:1",
		"minimum_knot_per_liter_gasoline": "required|numeric|min:0.1",
		"maximum_knot_per_liter_gasoline": "required|numeric|min:0.1",
		"record_status":                   "boolean",
	}
}

// Messages returns custom error messages for validation failures
func (r *KapalRequest) Messages(ctx http.Context) map[string]string {
	return map[string]string{
		"call_sign.required":     "Call sign is required",
		"flag.required":          "Flag is required",
		"kelas.required":         "Class is required",
		"builder.required":       "Builder is required",
		"year_built.required":    "Year built is required",
		"year_built.min":         "Year built must be at least 1900",
		"year_built.max":         "Year built cannot be greater than 2100",
		"heading_direction.min":  "Heading direction must be between 0 and 359",
		"heading_direction.max":  "Heading direction must be between 0 and 359",
		"width_m.min":            "Width must be at least 1 meter",
		"length_m.min":           "Length must be at least 1 meter",
		"bow_to_stern.min":       "Bow to stern must be at least 1 meter",
		"port_to_starboard.min":  "Port to starboard must be at least 1 meter",
		"image_map.required":     "Image map is required",
		"image.required":         "Image is required",
	}
}

// Attributes returns custom attribute names for validation errors
func (r *KapalRequest) Attributes(ctx http.Context) map[string]string {
	return map[string]string{
		"call_sign":                      "Call Sign",
		"flag":                           "Flag",
		"kelas":                          "Class",
		"builder":                        "Builder",
		"year_built":                     "Year Built",
		"heading_direction":              "Heading Direction",
		"calibration":                    "Calibration",
		"width_m":                        "Width (m)",
		"length_m":                       "Length (m)",
		"bow_to_stern":                   "Bow to Stern",
		"port_to_starboard":              "Port to Starboard",
		"image_map":                      "Image Map",
		"image":                          "Image",
		"history_per_second":             "History Per Second",
		"minimum_knot_per_liter_gasoline": "Minimum Knot Per Liter Gasoline",
		"maximum_knot_per_liter_gasoline": "Maximum Knot Per Liter Gasoline",
		"record_status":                   "Status",
	}
}

// PrepareForValidation allows you to modify the request before validation
func (r *KapalRequest) PrepareForValidation(ctx http.Context, data validation.Data) error {
	// Convert any data if needed before validation
	return nil
}

// KapalUpdateRequest represents the request data structure for updating a vessel
// Similar to KapalRequest but fields are optional for updates
type KapalUpdateRequest struct {
	Flag                        string   `form:"flag" json:"flag"`
	Kelas                       string   `form:"kelas" json:"kelas"`
	Builder                     string   `form:"builder" json:"builder"`
	YearBuilt                   uint     `form:"year_built" json:"year_built"`
	HeadingDirection            int64    `form:"heading_direction" json:"heading_direction"`
	Calibration                 int64    `form:"calibration" json:"calibration"`
	WidthM                      int64    `form:"width_m" json:"width_m"`
	LengthM                     int64    `form:"length_m" json:"length_m"`
	BowToStern                  int64    `form:"bow_to_stern" json:"bow_to_stern"`
	PortToStarboard             int64    `form:"port_to_starboard" json:"port_to_starboard"`
	ImageMap                    string   `form:"image_map" json:"image_map"`
	Image                       string   `form:"image" json:"image"`
	HistoryPerSecond            int64    `form:"history_per_second" json:"history_per_second"`
	MinimumKnotPerLiterGasoline float64  `form:"minimum_knot_per_liter_gasoline" json:"minimum_knot_per_liter_gasoline"`
	MaximumKnotPerLiterGasoline float64  `form:"maximum_knot_per_liter_gasoline" json:"maximum_knot_per_liter_gasoline"`
	RecordStatus                *bool    `form:"record_status" json:"record_status"`
}

// Authorize indicates if the current user can make this request
func (r *KapalUpdateRequest) Authorize(ctx http.Context) error {
	return nil
}

// Rules returns the validation rules for the request
// All fields are optional for updates, but if provided, they must pass validation
func (r *KapalUpdateRequest) Rules(ctx http.Context) map[string]string {
	return map[string]string{
		"flag":                            "string|max:300",
		"kelas":                           "string|max:300",
		"builder":                         "string|max:300",
		"year_built":                      "numeric|min:1900|max:2100",
		"heading_direction":               "numeric|min:0|max:359",
		"calibration":                     "numeric",
		"width_m":                         "numeric|min:1",
		"length_m":                        "numeric|min:1",
		"bow_to_stern":                    "numeric|min:1",
		"port_to_starboard":               "numeric|min:1",
		"image_map":                       "string",
		"image":                           "string",
		"history_per_second":              "numeric|min:1",
		"minimum_knot_per_liter_gasoline": "numeric|min:0.1",
		"maximum_knot_per_liter_gasoline": "numeric|min:0.1",
		"record_status":                   "boolean",
	}
}

// Messages returns custom error messages for validation failures
func (r *KapalUpdateRequest) Messages(ctx http.Context) map[string]string {
	return map[string]string{
		"year_built.min":        "Year built must be at least 1900",
		"year_built.max":        "Year built cannot be greater than 2100",
		"heading_direction.min": "Heading direction must be between 0 and 359",
		"heading_direction.max": "Heading direction must be between 0 and 359",
		"width_m.min":           "Width must be at least 1 meter",
		"length_m.min":          "Length must be at least 1 meter",
		"bow_to_stern.min":      "Bow to stern must be at least 1 meter",
		"port_to_starboard.min": "Port to starboard must be at least 1 meter",
	}
}

// Attributes returns custom attribute names for validation errors
func (r *KapalUpdateRequest) Attributes(ctx http.Context) map[string]string {
	return map[string]string{
		"flag":                            "Flag",
		"kelas":                           "Class",
		"builder":                         "Builder",
		"year_built":                      "Year Built",
		"heading_direction":               "Heading Direction",
		"calibration":                     "Calibration",
		"width_m":                         "Width (m)",
		"length_m":                        "Length (m)",
		"bow_to_stern":                    "Bow to Stern",
		"port_to_starboard":               "Port to Starboard",
		"image_map":                       "Image Map",
		"image":                           "Image",
		"history_per_second":              "History Per Second",
		"minimum_knot_per_liter_gasoline": "Minimum Knot Per Liter Gasoline",
		"maximum_knot_per_liter_gasoline": "Maximum Knot Per Liter Gasoline",
		"record_status":                   "Status",
	}
}

// PrepareForValidation allows you to modify the request before validation
func (r *KapalUpdateRequest) PrepareForValidation(ctx http.Context, data validation.Data) error {
	// Convert any data if needed before validation
	return nil
}