class SensorDetail extends BaseDetail {
  constructor() {
    super("sensor");
    this.historicalData = [];
    this.currentSensor = null;
    this.chart = null;
  }

  showSensorDetails(sensor) {
    this.currentSensor = sensor;
    this.setTitle(`Sensor Details - ${sensor.id}`);
    const content = this.modal.querySelector(".detail-content");
    const parsedData = this.parseRawData(sensor.raw_data);
    const tideHeight =
      parsedData.tideHeight !== null ? parsedData.tideHeight : "N/A";

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
          <span class="detail-value">${this.formatDate(
            sensor.last_update
          )}</span>
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
          <input type="datetime-local" class="date-input" id="startDate">
          <input type="datetime-local" class="date-input" id="endDate">
        </div>
        <button class="fetch-button" id="fetchHistory">
          Fetch History Data
        </button>
        <div class="chart-wrapper">
          <canvas id="tideChart"></canvas>
        </div>
        <div class="download-buttons">
          <button class="download-button csv" id="downloadCSV" disabled>
            <i class="bi bi-file-earmark-text"></i>
            Download CSV
          </button>
          <button class="download-button excel" id="downloadExcel" disabled>
            <i class="bi bi-file-earmark-spreadsheet"></i>
            Download Excel
          </button>
        </div>
      </div>
    `;

    this.setupChartAndControls(parsedData);
    this.show(); // Remove toggleButton reference
  }

  setupChartAndControls(initialData) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 1);

    document.getElementById("startDate").value = startDate
      .toISOString()
      .slice(0, 16);
    document.getElementById("endDate").value = endDate
      .toISOString()
      .slice(0, 16);

    if (initialData.tideHeight !== null) {
      this.initChart([
        {
          timestamp:
            initialData.time || new Date(this.currentSensor.last_update),
          tideHeight: initialData.tideHeight,
        },
      ]);
    }

    document
      .getElementById("fetchHistory")
      .addEventListener("click", () => this.fetchHistorySensorData());
    document
      .getElementById("downloadCSV")
      .addEventListener("click", () => this.downloadCSV());
    document
      .getElementById("downloadExcel")
      .addEventListener("click", () => this.downloadExcel());
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
            backgroundColor: "rgba(59, 130, 246, 0.1)",
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: "#3b82f6",
            pointHoverBorderColor: "white",
            pointHoverBorderWidth: 2,
            tension: 0.4,
            fill: true,
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
                return new Date(items[0].parsed.x).toLocaleString();
              },
              label: function (context) {
                return `Tide Height: ${context.parsed.y.toFixed(3)} m`;
              },
            },
          },
          legend: {
            display: false,
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
        },
      },
    });
  }

  async fetchHistorySensorData() {
    if (!this.currentSensor) return;

    const startInput = document.getElementById("startDate").value;
    const endInput = document.getElementById("endDate").value;
    const fetchButton = document.getElementById("fetchHistory");

    try {
      fetchButton.disabled = true;
      fetchButton.textContent = "Fetching...";

      // Format datetime to include seconds and timezone
      const formatDateTime = (dateStr) => {
        const date = new Date(dateStr);
        return date.toISOString().slice(0, 19) + "Z"; // Format: "2025-02-19T14:32:00Z"
      };

      const formattedStartTime = formatDateTime(startInput);
      const formattedEndTime = formatDateTime(endInput);

      const url = `/api/sensors/history/stream?sensor_id=${this.currentSensor.id}&start_time=${formattedStartTime}&end_time=${formattedEndTime}`;
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch sensor history");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let historicalData = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");

        for (let i = 0; i < lines.length - 1; i++) {
          if (lines[i].trim() === "") continue;

          const record = JSON.parse(lines[i]);
          const parsedData = this.parseRawData(record.raw_data);

          if (parsedData.tideHeight !== null && parsedData.time) {
            historicalData.push({
              timestamp: parsedData.time,
              tideHeight: parsedData.tideHeight,
            });
          }
        }

        buffer = lines[lines.length - 1];

        if (historicalData.length % 100 === 0) {
          this.updateChart(historicalData);
        }
      }

      this.historicalData = historicalData;
      this.updateChart(historicalData);

      // Enable download buttons
      document.getElementById("downloadCSV").disabled = false;
      document.getElementById("downloadExcel").disabled = false;

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

    const timeMatch = rawData.match(
      /TIME:(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2})/
    );
    if (timeMatch) {
      const [day, month, year, time] = timeMatch[1]
        .match(/(\d{2})\/(\d{2})\/(\d{4}) (.+)/)
        .slice(1);
      result.time = new Date(`${year}-${month}-${day}T${time}Z`);
    }

    const tideMatch = rawData.match(/TIDE HEIGHT: ([\+\-]\d+\.\d+)/);
    if (tideMatch) {
      result.tideHeight = parseFloat(tideMatch[1]);
    }

    return result;
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

  downloadCSV() {
    if (!this.historicalData.length) return;

    const csvContent = [
      ["Timestamp (UTC)", "Tide Height (m)"],
      ...this.historicalData.map((record) => [
        record.timestamp.toISOString(),
        record.tideHeight.toFixed(3),
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const fileName = `sensor_${this.currentSensor.id}_tide_data_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    this.downloadFile(blob, fileName);
  }

  async downloadExcel() {
    if (!this.historicalData.length) return;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Tide Data");

    worksheet.columns = [
      { header: "Timestamp (UTC)", key: "timestamp", width: 20 },
      { header: "Tide Height (m)", key: "tideHeight", width: 15 },
    ];

    this.historicalData.forEach((record) => {
      worksheet.addRow({
        timestamp: record.timestamp.toISOString(),
        tideHeight: record.tideHeight,
      });
    });

    worksheet.getRow(1).font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const fileName = `sensor_${this.currentSensor.id}_tide_data_${new Date()
      .toISOString()
      .slice(0, 10)}.xlsx`;
    this.downloadFile(blob, fileName);
  }

  downloadFile(blob, fileName) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }
}

// Create global instance
const sensorDetail = new SensorDetail();
