// public/scripts/models/overlay_api_model.js
class GeolayerApiModel {
  constructor() {
    this.baseUrl = "/api/geolayers";
    this.authToken = localStorage.getItem("auth_token");
    this.timeout = 30 * 60 * 1000; // 30 minutes for large files
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
        throw new Error(data.message || data.error || "API Error");
      });
    }
    return response;
  }

  // Handle authentication errors
  handleAuthError() {
    console.error("Authentication error");
    // Redirect to login or show auth error
  }

  /**
   * Fetch all geolayers with pagination and optional filters
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} - Paginated geolayer data
   */
  async fetchGeolayers(params = {}) {
    const queryParams = new URLSearchParams();

    // Standard pagination params
    if (params.page) queryParams.append("page", params.page);
    if (params.limit) queryParams.append("limit", params.limit);

    // Add filter params
    if (params.name) queryParams.append("name", params.name);
    if (params.file_type) queryParams.append("file_type", params.file_type);
    if (params.workspace) queryParams.append("workspace", params.workspace);
    if (params.with_trashed) queryParams.append("with_trashed", params.with_trashed);

    const url = `${this.baseUrl}?${queryParams.toString()}`;

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: this.getHeaders(),
      });

      await this.handleError(response);
      return await response.json();
    } catch (error) {
      console.error("Error fetching geolayers:", error);
      throw error;
    }
  }

  /**
   * Get a single geolayer by ID
   * @param {number} id - Geolayer ID
   * @param {boolean} withTrashed - Include soft-deleted geolayers
   * @returns {Promise<Object>} - Geolayer data
   */
  async getGeolayer(id, withTrashed = false) {
    const queryParams = new URLSearchParams();
    if (withTrashed) queryParams.append("with_trashed", "true");

    const url = `${this.baseUrl}/${id}?${queryParams.toString()}`;

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: this.getHeaders(),
      });

      await this.handleError(response);
      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error(`Error fetching geolayer ${id}:`, error);
      throw error;
    }
  }

  /**
   * Create a new geolayer
   * @param {Object} geolayerData - Geolayer data including file
   * @param {Function} onProgress - Optional progress callback
   * @returns {Promise<Object>} - Created geolayer data
   */
  async createGeolayer(geolayerData, onProgress = null) {
    // Check if we have a file and if it's large
    const hasFile = geolayerData.file instanceof File;
    const isLargeFile = hasFile && geolayerData.file.size > 5 * 1024 * 1024; // 5MB threshold
    
    // For large files, use XHR with progress tracking
    if (hasFile && isLargeFile && onProgress) {
      return new Promise((resolve, reject) => {
        // Create form data
        const formData = new FormData();
        
        // Add all fields
        Object.keys(geolayerData).forEach(key => {
          formData.append(key, geolayerData[key]);
        });
        
        // Create XHR
        const xhr = new XMLHttpRequest();
        
        // Setup upload progress
        if (onProgress && typeof onProgress === 'function') {
          xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
              const progress = Math.round((event.loaded / event.total) * 100);
              onProgress(progress);
            }
          });
        }
        
        // Handle completion
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              resolve(response);
            } catch (e) {
              reject(new Error("Invalid JSON response from server"));
            }
          } else {
            try {
              const errorData = JSON.parse(xhr.responseText);
              reject(new Error(errorData.message || errorData.error || `Upload failed with status ${xhr.status}`));
            } catch (e) {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          }
        });
        
        // Handle network errors
        xhr.addEventListener('error', () => {
          reject(new Error("Network error occurred during upload"));
        });
        
        // Handle timeout
        xhr.addEventListener('timeout', () => {
          reject(new Error("Upload timed out"));
        });
        
        // Configure XHR
        xhr.open('POST', this.baseUrl);
        xhr.timeout = this.timeout;
        
        // Add authorization header if needed
        if (this.authToken) {
          xhr.setRequestHeader('Authorization', `Bearer ${this.authToken}`);
        }
        
        // Send the request
        xhr.send(formData);
      });
    }
    
    // For smaller files or no progress tracking
    try {
      // Handle file uploads with FormData
      const formData = new FormData();

      // Add all form fields
      Object.keys(geolayerData).forEach((key) => {
        formData.append(key, geolayerData[key]);
      });

      // Make the API request
      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: this.getHeaders(),
        body: formData,
      });

      await this.handleError(response);
      return await response.json();
    } catch (error) {
      console.error("Error creating geolayer:", error);
      throw error;
    }
  }

  /**
   * Update an existing geolayer
   * @param {number} id - Geolayer ID
   * @param {Object} geolayerData - Updated geolayer data
   * @param {Function} onProgress - Optional progress callback
   * @returns {Promise<Object>} - Updated geolayer data
   */
  async updateGeolayer(id, geolayerData, onProgress = null) {
    // Check if we have a file and if it's large
    const hasFile = geolayerData.file instanceof File;
    const isLargeFile = hasFile && geolayerData.file.size > 5 * 1024 * 1024; // 5MB threshold
    
    // For large files, use XHR with progress tracking
    if (hasFile && isLargeFile && onProgress) {
      return new Promise((resolve, reject) => {
        // Create form data
        const formData = new FormData();
        
        // Add all fields
        Object.keys(geolayerData).forEach(key => {
          formData.append(key, geolayerData[key]);
        });
        
        // Create XHR
        const xhr = new XMLHttpRequest();
        
        // Setup upload progress
        if (onProgress && typeof onProgress === 'function') {
          xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
              const progress = Math.round((event.loaded / event.total) * 100);
              onProgress(progress);
            }
          });
        }
        
        // Handle completion
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              resolve(response);
            } catch (e) {
              reject(new Error("Invalid JSON response from server"));
            }
          } else {
            try {
              const errorData = JSON.parse(xhr.responseText);
              reject(new Error(errorData.message || errorData.error || `Upload failed with status ${xhr.status}`));
            } catch (e) {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          }
        });
        
        // Handle network errors
        xhr.addEventListener('error', () => {
          reject(new Error("Network error occurred during upload"));
        });
        
        // Handle timeout
        xhr.addEventListener('timeout', () => {
          reject(new Error("Upload timed out"));
        });
        
        // Configure XHR
        xhr.open('PUT', `${this.baseUrl}/${id}`);
        xhr.timeout = this.timeout;
        
        // Add authorization header if needed
        if (this.authToken) {
          xhr.setRequestHeader('Authorization', `Bearer ${this.authToken}`);
        }
        
        // Send the request
        xhr.send(formData);
      });
    }
    
    // For smaller files
    try {
      // Handle file uploads with FormData
      const formData = new FormData();

      // Add all form fields
      Object.keys(geolayerData).forEach((key) => {
        formData.append(key, geolayerData[key]);
      });

      // Make the API request
      const response = await fetch(`${this.baseUrl}/${id}`, {
        method: "PUT",
        headers: this.getHeaders(),
        body: formData,
      });

      await this.handleError(response);
      return await response.json();
    } catch (error) {
      console.error(`Error updating geolayer ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete a geolayer (soft delete)
   * @param {number} id - Geolayer ID
   * @returns {Promise<Object>} - Response data
   */
  async deleteGeolayer(id) {
    try {
      const response = await fetch(`${this.baseUrl}/${id}`, {
        method: "DELETE",
        headers: this.getHeaders(),
      });

      await this.handleError(response);
      return await response.json();
    } catch (error) {
      console.error(`Error deleting geolayer ${id}:`, error);
      throw error;
    }
  }

  /**
   * Restore a soft-deleted geolayer
   * @param {number} id - Geolayer ID
   * @returns {Promise<Object>} - Response data
   */
  async restoreGeolayer(id) {
    try {
      const response = await fetch(`${this.baseUrl}/${id}/restore`, {
        method: "PUT",
        headers: this.getHeaders(),
      });

      await this.handleError(response);
      return await response.json();
    } catch (error) {
      console.error(`Error restoring geolayer ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get file download URL for a specific geolayer
   * @param {string} filePath - File path 
   * @returns {string} - File download URL
   */
  getFileUrl(filePath) {
    return filePath;
  }

  /**
   * Get WMS base URL for the geolayer
   * @param {string} workspace - Workspace name
   * @returns {string} - WMS URL
   */
  getWmsBaseUrl(workspace) {
    const baseUrl = window.location.origin;
    return `${baseUrl}/geoserver/${workspace}/wms`;
  }
}

export default GeolayerApiModel;