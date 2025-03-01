// sensor-api-model.js
class SensorApiModel {
  constructor() {
    this.baseUrl = "/api/sensor";
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
      "Content-Type": "application/json",
    };

    if (includeAuth && this.authToken) {
      headers["Authorization"] = `Bearer ${this.authToken}`;
    }

    return headers;
  }

  // Handle API errors
  // Handle API errors with better error information preservation
  handleError(response) {
    if (!response.ok) {
      if (response.status === 401) {
        // Unauthorized - token may have expired
        this.handleAuthError();
      }

      return response.json().then((data) => {
        // Create a more detailed error object
        const errorMessage = data.message || "API Error";
        const error = new Error(errorMessage);

        // Preserve response status and full error data
        error.status = response.status;
        error.statusText = response.statusText;
        error.url = response.url;
        error.data = data;

        console.error("API Error:", {
          status: response.status,
          message: errorMessage,
          data: data,
          url: response.url,
        });

        throw error;
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
   * Fetch all sensors with pagination and optional filters
   * @param {Object} params - Query parameters
   * @param {number} params.page - Page number
   * @param {number} params.limit - Items per page
   * @param {string} params.id - Filter by ID
   * @param {string} params.type - Filter by type
   * @param {boolean} params.with_trashed - Include soft-deleted records
   * @returns {Promise<Object>} - Paginated sensor data
   */
  async fetchSensors(params = {}) {
    const queryParams = new URLSearchParams();

    // Add pagination params
    if (params.page) queryParams.append("page", params.page);
    if (params.limit) queryParams.append("limit", params.limit);

    // Add filter params
    if (params.id) queryParams.append("id", params.id);
    if (params.type) queryParams.append("type", params.type);
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
      console.error("Error fetching sensors:", error);
      throw error;
    }
  }

  /**
   * Get a single sensor by ID
   * @param {string} sensorId - Sensor ID
   * @param {boolean} withTrashed - Include soft-deleted sensors
   * @returns {Promise<Object>} - Sensor data
   */
  async getSensor(sensorId, withTrashed = false) {
    const queryParams = new URLSearchParams();
    if (withTrashed) queryParams.append("with_trashed", "true");

    const url = `${this.baseUrl}/${sensorId}?${queryParams.toString()}`;

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: this.getHeaders(false), // Public endpoint, no auth needed
      });

      await this.handleError(response);
      const data = await response.json();
      return data.data; // Return the sensor object directly
    } catch (error) {
      console.error(`Error fetching sensor ${sensorId}:`, error);
      throw error;
    }
  }

  /**
   * Create a new sensor
   * @param {Object} sensorData - Sensor data
   * @returns {Promise<Object>} - Created sensor data
   */
  async createSensor(sensorData) {
    try {
      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: this.getHeaders(true), // Auth required
        body: JSON.stringify(sensorData),
      });

      await this.handleError(response);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error creating sensor:", error);
      throw error;
    }
  }

  /**
   * Update an existing sensor
   * @param {string} sensorId - Sensor ID
   * @param {Object} sensorData - Updated sensor data
   * @returns {Promise<Object>} - Updated sensor data
   */
  async updateSensor(sensorId, sensorData) {
    try {
      const response = await fetch(`${this.baseUrl}/${sensorId}`, {
        method: "POST",
        headers: {
          ...this.getHeaders(true),
          "X-HTTP-Method-Override": "PUT", // For Laravel/Goravel compatibility
        },
        body: JSON.stringify(sensorData),
      });

      await this.handleError(response);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error updating sensor ${sensorId}:`, error);
      throw error;
    }
  }

  /**
   * Delete a sensor (soft delete)
   * @param {string} sensorId - Sensor ID
   * @returns {Promise<Object>} - Response data
   */
  async deleteSensor(sensorId) {
    try {
      const response = await fetch(`${this.baseUrl}/${sensorId}`, {
        method: "DELETE",
        headers: this.getHeaders(true), // Auth required
      });

      await this.handleError(response);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error deleting sensor ${sensorId}:`, error);
      throw error;
    }
  }

  /**
   * Restore a soft-deleted sensor
   * @param {string} sensorId - Sensor ID
   * @returns {Promise<Object>} - Response data
   */
  async restoreSensor(sensorId) {
    try {
      const response = await fetch(`${this.baseUrl}/${sensorId}/restore`, {
        method: "PUT",
        headers: this.getHeaders(true), // Auth required
      });

      await this.handleError(response);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error restoring sensor ${sensorId}:`, error);
      throw error;
    }
  }

  /**
   * Add a type to a sensor
   * @param {string} sensorId - Sensor ID
   * @param {string} type - Type to add
   * @returns {Promise<Object>} - Response data
   */
  async addSensorType(sensorId, type) {
    try {
      const response = await fetch(`${this.baseUrl}/${sensorId}/type`, {
        method: "POST",
        headers: this.getHeaders(true), // Auth required
        body: JSON.stringify({ type }),
      });

      await this.handleError(response);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error adding type to sensor ${sensorId}:`, error);
      throw error;
    }
  }

  /**
   * Remove a type from a sensor
   * @param {string} sensorId - Sensor ID
   * @param {string} type - Type to remove
   * @returns {Promise<Object>} - Response data
   */
  async removeSensorType(sensorId, type) {
    try {
      const response = await fetch(
        `${this.baseUrl}/${sensorId}/type?type=${type}`,
        {
          method: "DELETE",
          headers: this.getHeaders(true), // Auth required
        }
      );

      await this.handleError(response);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error removing type from sensor ${sensorId}:`, error);
      throw error;
    }
  }

  /**
   * Get sensor history
   * @param {string} sensorId - Sensor ID
   * @param {Date|null} startTime - Optional start time
   * @param {Date|null} endTime - Optional end time
   * @returns {Promise<Array>} - Sensor history records
   */
  async getSensorHistory(sensorId, startTime = null, endTime = null) {
    const queryParams = new URLSearchParams();
    queryParams.append("sensor_id", sensorId);

    if (startTime) {
      queryParams.append("start_time", startTime.toISOString());
    }

    if (endTime) {
      queryParams.append("end_time", endTime.toISOString());
    }

    const url = `${this.baseUrl}/history?${queryParams.toString()}`;

    try {
      // For demonstration, we'll mock some history data
      // In a real implementation, you would fetch this from the API

      // Mock delay for simulating API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Generate mock records
      const mockRecords = [];
      const now = new Date();

      // Create 20 records with timestamps going back from now
      for (let i = 0; i < 20; i++) {
        const timestamp = new Date(now.getTime() - i * 3600000); // each record 1 hour apart

        // Skip if outside time range
        if (startTime && timestamp < startTime) continue;
        if (endTime && timestamp > endTime) continue;

        mockRecords.push({
          id: i + 1,
          id_sensor: sensorId,
          raw_data: `ID:${sensorId},TIMESTAMP:${timestamp.toISOString()},VALUE:${
            Math.random() * 100
          }`,
          created_at: timestamp.toISOString(),
          updated_at: timestamp.toISOString(),
        });
      }

      return mockRecords;
    } catch (error) {
      console.error(`Error fetching history for sensor ${sensorId}:`, error);
      throw error;
    }
  }
}

export default SensorApiModel;
