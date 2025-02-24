class BaseDetail {
  static sharedToggleButton = null;
  static currentType = null;
  static instances = {};

  constructor(type) {
    if (this.constructor === BaseDetail) {
      throw new Error("Abstract class 'BaseDetail' cannot be instantiated");
    }
    this.type = type;
    this.createModal();
    this.setupEventListeners();
    this.setupOrUpdateToggleButton();
    
    // Store instance reference
    BaseDetail.instances[type] = this;
  }

  createModal() {
    this.modal = document.createElement("div");
    this.modal.className = `detail-modal ${this.type}-modal`;
    this.modal.style.cssText = `
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
    `;

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

  setupOrUpdateToggleButton() {
    if (!BaseDetail.sharedToggleButton) {
      BaseDetail.sharedToggleButton = document.createElement("button");
      BaseDetail.sharedToggleButton.style.cssText = `
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
      `;
      document.body.appendChild(BaseDetail.sharedToggleButton);

      // Add click event listener to the shared button
      BaseDetail.sharedToggleButton.addEventListener("click", () => {
        if (BaseDetail.currentType) {
          const instance = BaseDetail.instances[BaseDetail.currentType];
          if (instance) {
            if (instance.modal.classList.contains("show")) {
              instance.hide();
            } else {
              instance.show();
            }
          }
        }
      });
    }
  }

  updateToggleButtonText(isHidden = false) {
    if (!BaseDetail.sharedToggleButton) return;

    const button = BaseDetail.sharedToggleButton;
    button.className = `toggle-button ${this.type}-toggle`;
    button.innerHTML = `
      <i class="bi bi-${isHidden ? 'eye' : 'eye-slash'}"></i>
      <span>${isHidden ? 'Show' : 'Hide'} ${this.type === 'vessel' ? 'Vessel' : 'Sensor'} Details</span>
    `;
    button.style.display = 'flex';
  }

  setupEventListeners() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.addEventHandlers());
    } else {
      this.addEventHandlers();
    }
  }

  addEventHandlers() {
    const closeButton = this.modal?.querySelector(".close-button");
    if (closeButton) {
      closeButton.addEventListener("click", () => this.hide());
    }
  }

  show() {
    // Hide any other visible modals first
    document.querySelectorAll('.detail-modal.show').forEach(modal => {
      if (modal !== this.modal) {
        modal.classList.remove('show');
        modal.style.top = '-100%';
        modal.style.opacity = '0';
      }
    });

    this.modal.classList.add("show");
    this.modal.style.top = '10px';
    this.modal.style.opacity = '1';
    
    // Update current type and button text
    BaseDetail.currentType = this.type;
    this.updateToggleButtonText(false);
  }

  hide() {
    this.modal.classList.remove("show");
    this.modal.style.top = '-100%';
    this.modal.style.opacity = '0';
    this.updateToggleButtonText(true);
  }

  formatDate(date) {
    return new Date(date).toLocaleString();
  }

  setTitle(title) {
    const titleSpan = this.modal.querySelector(".detail-title span");
    if (titleSpan) {
      titleSpan.textContent = title;
    }
  }
}