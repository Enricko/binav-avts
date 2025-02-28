// kapal-api-model.js
class KapalApiModel {
  constructor() {
    this.baseUrl = "/api/kapal";
    this.authToken = localStorage.getItem("auth_token"); // Assuming token is stored in localStorage
  }

  // Set authentication token
  setAuthToken(token) {
    this.authToken = token;
    localStorage.setItem("auth_token", token);
  }

  // Get request headers
  getHeaders(includeAuth = true) {
    const headers = {
      Accept: "application/json",
    };

    if (includeAuth && this.authToken) {
      headers["Authorization"] = `Bearer ${this.authToken}`;
    }

    return headers;
  }

  // Handle API errors
  handleError(response) {
    if (!response.ok) {
      if (response.status === 401) {
        // Unauthorized - token may have expired
        this.handleAuthError();
      }

      return response.json().then((data) => {
        throw new Error(data.message || "API Error");
      });
    }
    return response;
  }

  // Handle authentication errors
  handleAuthError() {
    // Redirect to login or show auth error
    console.error("Authentication error");
    // window.location.href = '/login';
  }

  /**
   * Fetch all vessels with pagination and optional filters
   * @param {Object} params - Query parameters
   * @param {number} params.page - Page number
   * @param {number} params.limit - Items per page
   * @param {string} params.flag - Filter by flag
   * @param {string} params.kelas - Filter by class
   * @param {boolean} params.record_status - Filter by status
   * @param {boolean} params.with_trashed - Include soft-deleted records
   * @returns {Promise<Object>} - Paginated vessel data
   */
  async fetchVessels(params = {}) {
    const queryParams = new URLSearchParams();

    // Add pagination params
    if (params.page) queryParams.append("page", params.page);
    if (params.limit) queryParams.append("limit", params.limit);

    // Add filter params
    if (params.flag) queryParams.append("flag", params.flag);
    if (params.kelas) queryParams.append("kelas", params.kelas);
    if (params.record_status !== undefined)
      queryParams.append("record_status", params.record_status);
    if (params.with_trashed)
      queryParams.append("with_trashed", params.with_trashed);

    const url = `${this.baseUrl}?${queryParams.toString()}`;

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: this.getHeaders(false), // Public endpoint, no auth needed
      });

      await this.handleError(response);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching vessels:", error);
      throw error;
    }
  }

  /**
   * Get a single vessel by call sign
   * @param {string} callSign - Vessel call sign
   * @param {boolean} withTrashed - Include soft-deleted vessels
   * @returns {Promise<Object>} - Vessel data
   */
  async getVessel(callSign, withTrashed = false) {
    const queryParams = new URLSearchParams();
    if (withTrashed) queryParams.append("with_trashed", "true");

    const url = `${this.baseUrl}/${callSign}?${queryParams.toString()}`;

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: this.getHeaders(false), // Public endpoint, no auth needed
      });

      await this.handleError(response);
      const data = await response.json();
      return data.data; // Return the vessel object directly
    } catch (error) {
      console.error(`Error fetching vessel ${callSign}:`, error);
      throw error;
    }
  }

  /**
   * Create a new vessel
   * @param {Object} vesselData - Vessel data
   * @returns {Promise<Object>} - Created vessel data
   */
  async createVessel(vesselData) {
    try {
      // Handle file uploads and form data
      const formData = new FormData();

      // Add all basic fields to the form data
      for (const key in vesselData) {
        // Skip file fields - we'll handle them separately
        if (key === "image" || key === "image_map") continue;

        // Add all other fields to formData
        if (vesselData[key] !== null && vesselData[key] !== undefined) {
          formData.append(key, vesselData[key]);
        }
      }

      // Handle image if it's a data URL
      if (vesselData.image) {
        if (
          typeof vesselData.image === "string" &&
          vesselData.image.startsWith("data:image")
        ) {
          // Convert data URL to File
          const imageFile = this.dataURLtoFile(
            vesselData.image,
            "vessel_image.jpg"
          );
          formData.append("image_file", imageFile);
        } else {
          // It's already a File object
          formData.append("image_file", vesselData.image);
        }
      }

      // Same for image_map
      if (vesselData.image_map) {
        if (
          typeof vesselData.image_map === "string" &&
          vesselData.image_map.startsWith("data:image")
        ) {
          const imageMapFile = this.dataURLtoFile(
            vesselData.image_map,
            "vessel_map_image.jpg"
          );
          formData.append("image_map_file", imageMapFile);
        } else {
          formData.append("image_map_file", vesselData.image_map);
        }
      }

      // Make the API request
      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: this.getHeaders(true), // Auth required, but don't set Content-Type
        body: formData,
      });

      await this.handleError(response);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error creating vessel:", error);
      throw error;
    }
  }

  /**
   * Update an existing vessel
   * @param {string} callSign - Vessel call sign
   * @param {Object} vesselData - Updated vessel data
   * @returns {Promise<Object>} - Updated vessel data
   */
  async updateVessel(callSign, vesselData) {
    try {
      // Handle file uploads and form data
      const formData = new FormData();

      // Add HTTP method override for PUT
      formData.append("_method", "PUT");

      // Add all basic fields to the form data
      for (const key in vesselData) {
        // Skip file fields - we'll handle them separately
        if (key === "image" || key === "image_map") continue;

        // Add all other fields to formData
        if (vesselData[key] !== null && vesselData[key] !== undefined) {
          formData.append(key, vesselData[key]);
        }
      }

      // Handle image if it's a data URL
      if (vesselData.image) {
        if (
          typeof vesselData.image === "string" &&
          vesselData.image.startsWith("data:image")
        ) {
          // Convert data URL to File
          const imageFile = this.dataURLtoFile(
            vesselData.image,
            "vessel_image.jpg"
          );
          formData.append("image_file", imageFile);
        } else {
          // It's already a File object
          formData.append("image_file", vesselData.image);
        }
      }

      // Same for image_map
      if (vesselData.image_map) {
        if (
          typeof vesselData.image_map === "string" &&
          vesselData.image_map.startsWith("data:image")
        ) {
          const imageMapFile = this.dataURLtoFile(
            vesselData.image_map,
            "vessel_map_image.jpg"
          );
          formData.append("image_map_file", imageMapFile);
        } else {
          formData.append("image_map_file", vesselData.image_map);
        }
      }
      // Add remove image flags if needed
      if (vesselData.remove_image) {
        formData.append("remove_image", "true");
      }

      if (vesselData.remove_image_map) {
        formData.append("remove_image_map", "true");
      }

      // Make the API request
      const response = await fetch(`${this.baseUrl}/${callSign}`, {
        method: "POST", // Use POST with _method parameter for Laravel/Goravel compatibility
        headers: this.getHeaders(true), // Auth required, but don't set Content-Type
        body: formData,
      });
      // Before sending the request
      for (let pair of formData.entries()) {
        console.log(pair[0] + ": " + pair[1]);
      }

      await this.handleError(response);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error updating vessel ${callSign}:`, error);
      throw error;
    }
  }

  /**
   * Delete a vessel (soft delete)
   * @param {string} callSign - Vessel call sign
   * @returns {Promise<Object>} - Response data
   */
  async deleteVessel(callSign) {
    try {
      const response = await fetch(`${this.baseUrl}/${callSign}`, {
        method: "DELETE",
        headers: this.getHeaders(true), // Auth required
      });

      await this.handleError(response);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error deleting vessel ${callSign}:`, error);
      throw error;
    }
  }

  /**
   * Restore a soft-deleted vessel
   * @param {string} callSign - Vessel call sign
   * @returns {Promise<Object>} - Response data
   */
  async restoreVessel(callSign) {
    try {
      const response = await fetch(`${this.baseUrl}/${callSign}/restore`, {
        method: "PUT",
        headers: this.getHeaders(true), // Auth required
      });

      await this.handleError(response);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error restoring vessel ${callSign}:`, error);
      throw error;
    }
  }

  /**
   * Get vessel classes (reference data)
   * @returns {Array} - List of vessel classes
   */
  getVesselClasses() {
    return [
      { value: "Cargo", label: "Cargo" },
      { value: "Tanker", label: "Tanker" },
      { value: "Passenger", label: "Passenger" },
      { value: "Fishing", label: "Fishing" },
      { value: "Military", label: "Military" },
      { value: "Pleasure", label: "Pleasure Craft" },
      { value: "Other", label: "Other" },
    ];
  }

  /**
   * Get country flags (reference data)
   * @returns {Array} - List of country flags
   */
  getCountryFlags() {
    return [
      { value: "Indonesia", label: "Indonesia" },
      { value: "Singapore", label: "Singapore" },
      { value: "Malaysia", label: "Malaysia" },
      { value: "Thailand", label: "Thailand" },
      { value: "Philippines", label: "Philippines" },
      { value: "Vietnam", label: "Vietnam" },
      { value: "Japan", label: "Japan" },
      { value: "China", label: "China" },
      { value: "South Korea", label: "South Korea" },
    ];
  }

  dataURLtoFile(dataURL, fileNameBase) {
    // Extract the content type and base64 data
    const arr = dataURL.split(",");
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);

    // Determine the extension based on mime type
    let extension = "jpg"; // Default
    if (mime === "image/png") extension = "png";
    if (mime === "image/gif") extension = "gif";
    if (mime === "image/webp") extension = "webp";
    if (mime === "image/svg+xml") extension = "svg";

    // Full filename with correct extension
    const fileName = `${fileNameBase}.${extension}`;

    // Convert to binary
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }

    // Create File object
    return new File([u8arr], fileName, { type: mime });
  }
}

export default KapalApiModel;
