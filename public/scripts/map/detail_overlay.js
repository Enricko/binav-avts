class DetailOverlay {
  constructor() {
    this.initializeStyles();
    this.createModal();
    this.setupEventListeners();
    this.setupToggleButton();
    this.historicalData = []; // Store historical data
  }

  initializeStyles() {
    const style = document.createElement("style");
    style.textContent = `
          .detail-modal {
            position: fixed;
            top: -100%;
            right: 10px;
            background: rgba(255, 255, 255, 0.98);
            backdrop-filter: blur(8px);
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.15);
            padding: 16px;
            width: 460px;
            z-index: 2000;
            opacity: 0;
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          }
    
          .detail-modal.show {
            top: 10px;
            opacity: 1;
          }
    
          .toggle-button {
            position: fixed;
            top: 10px;
            right: 10px;
            background: #3b82f6;
            color: white;
            border: none;
            border-radius: 8px;
            padding: 8px 16px;
            cursor: pointer;
            z-index: 1999;
            display: none;
            transition: all 0.3s ease;
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
          }
    
          .toggle-button:hover {
            background: #2563eb;
            transform: translateY(-1px);
            box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
          }
    
          .toggle-button.active {
            display: flex;
            align-items: center;
            gap: 8px;
          }
    
          .detail-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
            padding-bottom: 12px;
            border-bottom: 1px solid #e2e8f0;
          }
    
          .detail-title {
            margin: 0;
            font-size: 16px;
            font-weight: 600;
            color: #1e293b;
            display: flex;
            align-items: center;
            gap: 8px;
          }
    
          .close-button {
            border: none;
            background: none;
            color: #64748b;
            cursor: pointer;
            padding: 8px;
            border-radius: 6px;
            transition: all 0.2s;
          }
    
          .close-button:hover {
            background: #f1f5f9;
            color: #1e293b;
          }
    
          .detail-content {
            max-height: 70vh;
            overflow-y: auto;
            scrollbar-width: thin;
            scrollbar-color: #94a3b8 transparent;
          }
    
          .detail-content::-webkit-scrollbar {
            width: 6px;
          }
    
          .detail-content::-webkit-scrollbar-track {
            background: transparent;
          }
    
          .detail-content::-webkit-scrollbar-thumb {
            background: #94a3b8;
            border-radius: 3px;
          }
    
          .detail-section {
            background: #f8fafc;
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 16px;
            transition: all 0.3s ease;
          }
    
          .detail-section:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.05);
          }
    
          .detail-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            font-size: 13px;
            transition: all 0.2s;
          }
    
          .detail-row:last-child {
            margin-bottom: 0;
          }
    
          .detail-row:hover {
            background: rgba(255,255,255,0.8);
            padding: 4px 8px;
            margin: -4px -8px 6px -8px;
            border-radius: 6px;
          }
    
          .detail-label {
            color: #64748b;
            font-weight: 500;
          }
    
          .detail-value {
            font-weight: 600;
            color: #1e293b;
          }

          .history-section {
        background: #f8fafc;
        border-radius: 12px;
        padding: 16px;
        margin-top: 16px;
      }

      .date-inputs {
        display: flex;
        gap: 10px;
        margin-bottom: 12px;
      }

      .date-input {
        flex: 1;
        padding: 8px;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        font-size: 13px;
      }

      .fetch-button {
        width: 100%;
        padding: 8px;
        background: #3b82f6;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        transition: all 0.2s;
      }

      .fetch-button:hover {
        background: #2563eb;
      }

      .fetch-button:disabled {
        background: #94a3b8;
        cursor: not-allowed;
      }

      .chart-wrapper {
        margin-top: 16px;
        background: white;
        border-radius: 8px;
        padding: 16px;
        border: 1px solid #e2e8f0;
        height: 300px;
      }

      .loading {
        text-align: center;
        padding: 16px;
        color: #64748b;
      }

      .download-buttons {
        display: flex;
        gap: 10px;
        margin-top: 12px;
      }

      .download-button {
        flex: 1;
        padding: 8px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
      }

      .download-button.csv {
        background: #059669;
        color: white;
      }

      .download-button.excel {
        background: #166534;
        color: white;
      }

      .download-button:hover {
        opacity: 0.9;
        transform: translateY(-1px);
      }

      .download-button:disabled {
        background: #94a3b8;
        cursor: not-allowed;
        transform: none;
      }
        `;
    document.head.appendChild(style);
  }

  addDownloadButtons(container) {
    const downloadButtons = document.createElement("div");
    downloadButtons.className = "download-buttons";
    downloadButtons.innerHTML = `
      <button class="download-button csv" id="downloadCSV" disabled>
        <i class="bi bi-file-earmark-text"></i>
        Download CSV
      </button>
      <button class="download-button excel" id="downloadExcel" disabled>
        <i class="bi bi-file-earmark-spreadsheet"></i>
        Download Excel
      </button>
    `;
    container.appendChild(downloadButtons);

    // Add event listeners
    document
      .getElementById("downloadCSV")
      .addEventListener("click", () => this.downloadCSV());
    document
      .getElementById("downloadExcel")
      .addEventListener("click", () => this.downloadExcel());
  }

  createModal() {
    this.modal = document.createElement("div");
    this.modal.className = "detail-modal";
    this.modal.innerHTML = `
          <div class="detail-header">
            <h3 class="detail-title">
              <i class="bi bi-info-circle"></i>
              <span>Details</span>
            </h3>
            <button class="close-button"><i class="bi bi-x-lg"></i></button>
          </div>
          <div class="detail-content"></div>
        `;
    document.body.appendChild(this.modal);
  }

  setupToggleButton() {
    this.toggleButton = document.createElement("button");
    this.toggleButton.className = "toggle-button";
    this.toggleButton.innerHTML = `
          <i class="bi bi-eye"></i>
          <span>Show Details</span>
        `;
    document.body.appendChild(this.toggleButton);
  }

  setupEventListeners() {
    // Wait for DOM content to be loaded
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () =>
        this.addEventHandlers()
      );
    } else {
      this.addEventHandlers();
    }
  }

  addEventHandlers() {
    const closeButton = this.modal?.querySelector(".close-button");
    if (closeButton) {
      closeButton.addEventListener("click", () => this.hide());
    }

    if (this.toggleButton) {
      this.toggleButton.addEventListener("click", () => {
        if (this.modal.classList.contains("show")) {
          this.hide();
        } else {
          this.show();
        }
      });
    }
  }

  showVesselDetails(vessel) {
    const content = this.modal.querySelector(".detail-content");
    content.innerHTML = `
        <div class="detail-section">
          <div class="detail-row">
            <span class="detail-label">Call Sign</span>
            <span class="detail-value">${vessel.call_sign}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Flag</span>
            <span class="detail-value">${vessel.vessel.flag}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Class</span>
            <span class="detail-value">${vessel.vessel.kelas}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Builder</span>
            <span class="detail-value">${vessel.vessel.builder}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Year Built</span>
            <span class="detail-value">${vessel.vessel.year_built}</span>
          </div>
        </div>
        <div class="detail-section">
          <div class="detail-row">
            <span class="detail-label">Speed</span>
            <span class="detail-value">${
              vessel.telemetry.speed_in_knots
            } knots</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Heading</span>
            <span class="detail-value">${
              vessel.telemetry.heading_degree
            }°</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">GPS Quality</span>
            <span class="detail-value">${
              vessel.telemetry.gps_quality_indicator
            }</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Status</span>
            <span class="detail-value" style="color: ${
              vessel.telemetry.telnet_status === "Connected"
                ? "#10B981"
                : "#EF4444"
            }">${vessel.telemetry.telnet_status}</span>
          </div>
        </div>
        <div class="detail-section">
          <div class="detail-row">
            <span class="detail-label">Latitude</span>
            <span class="detail-value">${vessel.telemetry.latitude}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Longitude</span>
            <span class="detail-value">${vessel.telemetry.longitude}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Last Update</span>
            <span class="detail-value">${new Date(
              vessel.telemetry.last_update
            ).toLocaleString()}</span>
          </div>
        </div>
      `;
    this.toggleButton.classList.add("active");
    this.show();
  }

  showSensorDetails(sensor) {
    this.currentSensor = sensor;
    const content = this.modal.querySelector(".detail-content");
    const parsedData = this.parseRawData(sensor.raw_data);
    const tideHeight =
      parsedData.tideHeight !== null ? parsedData.tideHeight : "N/A";

    // Calculate default date range (10 days) in UTC
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 10);

    // Format dates for datetime-local input in UTC
    const formatDateForInput = (date) => {
      return date.toISOString().slice(0, 16);
    };

    content.innerHTML = `
          <div class="detail-section">
            <div class="detail-row">
              <span class="detail-label">Sensor ID</span>
              <span class="detail-value">${sensor.id}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Types</span>
              <span class="detail-value">${sensor.types.join(", ")}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Status</span>
              <span class="detail-value" style="color: ${
                sensor.connection_status === "Connected" ? "#10B981" : "#EF4444"
              }">${sensor.connection_status}</span>
            </div>
          </div>
          <div class="detail-section">
            <div class="detail-row">
              <span class="detail-label">Tide Height</span>
              <span class="detail-value">${tideHeight} m</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Latitude</span>
              <span class="detail-value">${sensor.latitude}°</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Longitude</span>
              <span class="detail-value">${sensor.longitude}°</span>
            </div>
          </div>
          <div class="detail-section">
            <div class="detail-row">
              <span class="detail-label">Last Update</span>
              <span class="detail-value">${new Date(
                sensor.last_update
              ).toLocaleString()}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Raw Data</span>
              <span class="detail-value" style="word-break: break-all">${
                sensor.raw_data
              }</span>
            </div>
          </div>
          
          <!-- History Data Section -->
          <div class="history-section">
            <div class="date-inputs">
              <input 
                type="datetime-local" 
                class="date-input" 
                id="startDate" 
                value="${formatDateForInput(startDate)}"
              >
              <input 
                type="datetime-local" 
                class="date-input" 
                id="endDate" 
                value="${formatDateForInput(endDate)}"
              >
            </div>
            <button class="fetch-button" id="fetchHistory">
              Fetch History Data
            </button>
            <div class="chart-wrapper">
              <canvas id="tideChart"></canvas>
            </div>
          </div>
        `;

    const historySection = content.querySelector(".history-section");
    this.addDownloadButtons(historySection);

    this.setupHistoryEventListeners();
    if (parsedData.tideHeight !== null) {
      this.initChart([
        {
          timestamp: parsedData.time || new Date(sensor.created_at),
          tideHeight: parsedData.tideHeight,
        },
      ]);
    }

    this.toggleButton.classList.add("active");
    this.show();
  }

  initChart(initialData) {
    if (this.chart) {
      this.chart.destroy();
    }

    const ctx = document.getElementById("tideChart").getContext("2d");
    this.chart = new Chart(ctx, {
      type: "line",
      data: {
        datasets: [
          {
            label: "Tide Height (m)",
            data: initialData.map((point) => ({
              x: point.timestamp,
              y: point.tideHeight,
            })),
            borderColor: "#3b82f6",
            backgroundColor: "rgba(59, 130, 246, 0.1)", // Light blue background
            borderWidth: 2,
            pointRadius: 0, // Hide points by default
            pointHoverRadius: 6, // Larger hover points
            pointHoverBackgroundColor: "#3b82f6",
            pointHoverBorderColor: "white",
            pointHoverBorderWidth: 2,
            tension: 0.4,
            fill: true, // Fill area under the line
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "index",
          intersect: false,
        },
        scales: {
          x: {
            type: "time",
            time: {
              unit: "hour",
              displayFormats: {
                hour: "MMM d, HH:mm",
              },
            },
            grid: {
              color: "rgba(0, 0, 0, 0.05)",
            },
            title: {
              display: true,
              text: "Time (UTC)",
              font: {
                size: 12,
                weight: "bold",
              },
            },
          },
          y: {
            grid: {
              color: "rgba(0, 0, 0, 0.05)",
            },
            title: {
              display: true,
              text: "Tide Height (m)",
              font: {
                size: 12,
                weight: "bold",
              },
            },
          },
        },
        plugins: {
          tooltip: {
            backgroundColor: "rgba(255, 255, 255, 0.9)",
            titleColor: "#1e293b",
            bodyColor: "#1e293b",
            titleFont: {
              size: 12,
              weight: "bold",
            },
            bodyFont: {
              size: 12,
            },
            padding: 12,
            borderColor: "#e2e8f0",
            borderWidth: 1,
            displayColors: false,
            callbacks: {
              title: function (items) {
                const date = new Date(items[0].parsed.x);
                return date.toLocaleString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                });
              },
              label: function (context) {
                return `Tide Height: ${context.parsed.y.toFixed(3)} m`;
              },
            },
          },
          crosshair: {
            line: {
              color: "#94a3b8",
              width: 1,
              dashPattern: [5, 5],
            },
            sync: {
              enabled: true,
            },
            zoom: {
              enabled: false,
            },
          },
          legend: {
            display: false, // Hide legend since we only have one dataset
          },
        },
        hover: {
          mode: "index",
          intersect: false,
        },
      },
    });
  }

  show() {
    this.modal.classList.add("show");
    this.toggleButton.innerHTML =
      '<i class="bi bi-eye-slash"></i><span>Hide Details</span>';
  }

  hide() {
    this.modal.classList.remove("show");
    this.toggleButton.innerHTML =
      '<i class="bi bi-eye"></i><span>Show Details</span>';
  }

  async fetchHistorySensorData() {
    if (!this.currentSensor) return;

    const startInput = document.getElementById("startDate").value;
    const endInput = document.getElementById("endDate").value;
    const fetchButton = document.getElementById("fetchHistory");

    const formatDateForServer = (dateString) => {
      return dateString + ":00.000Z";
    };

    const startDate = formatDateForServer(startInput);
    const endDate = formatDateForServer(endInput);

    try {
      fetchButton.disabled = true;
      fetchButton.textContent = "Fetching...";

      const url = `/api/sensors/history/stream?sensor_id=${this.currentSensor.id}&start_time=${startDate}&end_time=${endDate}`;
      console.log("Fetching URL:", url);

      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch data");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let historicalData = [];
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");

        for (let i = 0; i < lines.length - 1; i++) {
          if (lines[i].trim() === "") continue;

          const record = JSON.parse(lines[i]);
          const tideMatch = record.raw_data.match(
            /TIDE HEIGHT: ([\+\-]\d+\.\d+)/
          );
          const timeMatch = record.raw_data.match(
            /TIME:(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2})/
          );

          if (tideMatch && timeMatch) {
            // Parse the date from raw data
            const [day, month, year, time] = timeMatch[1]
              .match(/(\d{2})\/(\d{2})\/(\d{4}) (.+)/)
              .slice(1);
            const dateStr = `${year}-${month}-${day}T${time}Z`;

            historicalData.push({
              timestamp: new Date(dateStr),
              tideHeight: parseFloat(tideMatch[1]),
            });
          }
        }

        buffer = lines[lines.length - 1];

        // Update chart every 100 records
        if (historicalData.length % 100 === 0) {
          this.updateChart(historicalData);
        }
      }

      this.historicalData = historicalData; // Store the data

      // Enable download buttons
      document.getElementById("downloadCSV").disabled = false;
      document.getElementById("downloadExcel").disabled = false;

      this.updateChart(historicalData);
      fetchButton.textContent = "Fetch History Data";
      fetchButton.disabled = false;
    } catch (error) {
      console.error("Error fetching history:", error);
      fetchButton.textContent = "Error - Try Again";
      fetchButton.disabled = false;
    }
  }

  parseRawData(rawData) {
    const result = {
      time: null,
      tideHeight: null,
    };

    // Extract time
    const timeMatch = rawData.match(
      /TIME:(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2})/
    );
    if (timeMatch) {
      const [day, month, year, time] = timeMatch[1]
        .match(/(\d{2})\/(\d{2})\/(\d{4}) (.+)/)
        .slice(1);
      result.time = new Date(`${year}-${month}-${day}T${time}Z`);
    }

    // Extract tide height
    const tideMatch = rawData.match(/TIDE HEIGHT: ([\+\-]\d+\.\d+)/);
    if (tideMatch) {
      result.tideHeight = parseFloat(tideMatch[1]);
    }

    return result;
  }

  downloadCSV() {
    if (!this.historicalData.length) return;

    const csvContent = [
      ["Timestamp (UTC)", "Tide Height (m)"],
      ...this.historicalData.map((record) => [
        new Date(record.timestamp).toISOString(),
        record.tideHeight.toFixed(3),
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const fileName = `sensor_${this.currentSensor.id}_tide_data_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", fileName);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  async downloadExcel() {
    if (!this.historicalData.length) return;

    const workbook = new ExcelJS.Workbook();

    // Add single worksheet for both data and chart
    const worksheet = workbook.addWorksheet("Tide Data");

    // Set up columns
    worksheet.columns = [
      { header: "Date", key: "date", width: 12 },
      { header: "Time", key: "time", width: 10 },
      { header: "Tide Height (m)", key: "tideHeight", width: 15 },
      { header: "", width: 2 }, // Spacer column
      { header: "", width: 15 }, // Start of chart area
      { header: "", width: 15 },
      { header: "", width: 15 },
    ];

    // Add data rows
    this.historicalData.forEach((record) => {
      const date = new Date(record.timestamp);
      worksheet.addRow({
        date: date.toLocaleDateString(),
        time: date.toLocaleTimeString(),
        tideHeight: record.tideHeight,
      });
    });

    // Style the header row
    worksheet.getRow(1).font = { bold: true };

    // Create a temporary canvas for the chart
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 400;
    const ctx = canvas.getContext("2d");

    // Create chart using Chart.js
    const chart = new Chart(ctx, {
      type: "line",
      data: {
        labels: this.historicalData.map((record) =>
          new Date(record.timestamp).toLocaleTimeString()
        ),
        datasets: [
          {
            label: "Tide Height (m)",
            data: this.historicalData.map((record) => record.tideHeight),
            borderColor: "#3b82f6",
            borderWidth: 2,
            tension: 0.4,
            fill: false,
          },
        ],
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        scales: {
          x: {
            type: "category",
            title: {
              display: true,
              text: "Time",
            },
            ticks: {
              maxRotation: 45,
              minRotation: 45,
            },
          },
          y: {
            title: {
              display: true,
              text: "Tide Height (m)",
            },
            beginAtZero: true,
          },
        },
        plugins: {
          title: {
            display: true,
            text: "Tide Height Over Time",
            font: {
              size: 16,
            },
          },
        },
      },
    });

    // Wait for chart animation to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Convert canvas to base64 image
    const imageData = canvas.toDataURL("image/png").split(",")[1];

    // Add the image to the worksheet
    const imageId = workbook.addImage({
      base64: imageData,
      extension: "png",
    });

    // Add the image to the worksheet, starting from column E (5th column)
    worksheet.addImage(imageId, {
      tl: { col: 4, row: 1 },
      ext: { width: 600, height: 300 },
    });

    // Add borders to data section
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        if (colNumber <= 3) {
          // Only for data columns
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
        }
      });
    });

    // Generate buffer and download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    // Create download link
    const link = document.createElement("a");
    link.href = window.URL.createObjectURL(blob);
    link.download = `sensor_${this.currentSensor.id}_tide_data_${new Date()
      .toISOString()
      .slice(0, 10)}.xlsx`;
    link.click();

    // Cleanup
    window.URL.revokeObjectURL(link.href);
    chart.destroy();
    canvas.remove();
  }

  updateChart(data) {
    if (this.chart) {
      this.chart.data.datasets[0].data = data.map((point) => ({
        x: point.timestamp,
        y: point.tideHeight,
      }));
      this.chart.update();
    }
  }

  setupHistoryEventListeners() {
    const fetchButton = document.getElementById("fetchHistory");
    if (fetchButton) {
      fetchButton.addEventListener("click", () =>
        this.fetchHistorySensorData()
      );
    }
  }
}

// Export as singleton
const detailOverlay = new DetailOverlay();
