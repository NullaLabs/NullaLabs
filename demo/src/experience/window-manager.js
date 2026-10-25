/**
 * NULLA WINDOW MANAGER // 4-CORNER RESIZABLE, DRAGGABLE & CRYSTAL DOCK SYSTEM
 *
 * Architecture:
 * - 4-corner transformation (nw, ne, sw, se) + 4-edge resizing with bounds clamping
 * - Drag-to-move from anywhere inside the window except interactive controls
 * - Dynamic bottom 3D crystal dock tabs for minimized windows
 * - Distinct vibrant sci-fi color palette per window
 * - Full restore, maximize, and z-index elevation management
 *
 * Author: Steve Blackbeard / NullaLabs
 */

(function (global) {
  'use strict';

  // Distinct Color Palette & Metadata for all Windows
  const WINDOW_CONFIGS = {
    'segre-modal': {
      id: 'segre-modal',
      name: 'Carta de Núclidos (Segrè)',
      shortTitle: 'SEGRÈ',
      icon: '⚛️',
      color: '#00F0FF',
      colorGlow: 'rgba(0, 240, 255, 0.45)',
      colorBorder: 'rgba(0, 240, 255, 0.75)',
      minWidth: 420,
      minHeight: 320,
      triggerIds: ['btn-segre-chart', 'btn-inspect-in-segre'],
      closeBtnId: 'btn-close-segre'
    },
    'ftir-modal': {
      id: 'ftir-modal',
      name: 'Espectrometría FTIR',
      shortTitle: 'FT-IR',
      icon: '〰️',
      color: '#BF00FF',
      colorGlow: 'rgba(191, 0, 255, 0.45)',
      colorBorder: 'rgba(191, 0, 255, 0.75)',
      minWidth: 420,
      minHeight: 320,
      triggerIds: ['btn-ftir'],
      closeBtnId: 'btn-close-ftir'
    },
    'homo-lumo-modal': {
      id: 'homo-lumo-modal',
      name: 'Orbitales HOMO / LUMO',
      shortTitle: 'HOMO-LUMO',
      icon: '⚡',
      color: '#FFD700',
      colorGlow: 'rgba(255, 215, 0, 0.45)',
      colorBorder: 'rgba(255, 215, 0, 0.75)',
      minWidth: 420,
      minHeight: 320,
      triggerIds: ['btn-homo-lumo'],
      closeBtnId: 'btn-close-homo-lumo'
    },
    'mep-modal': {
      id: 'mep-modal',
      name: 'Potencial MEP (ESP)',
      shortTitle: 'MEP',
      icon: '🌐',
      color: '#00B4D8',
      colorGlow: 'rgba(0, 180, 216, 0.45)',
      colorBorder: 'rgba(0, 180, 216, 0.75)',
      minWidth: 420,
      minHeight: 320,
      triggerIds: ['btn-mep'],
      closeBtnId: 'btn-close-mep'
    },
    'spectroscopy-modal': {
      id: 'spectroscopy-modal',
      name: 'Espectroscopía Cuántica',
      shortTitle: 'ESPECTROSCOPÍA',
      icon: '🔬',
      color: '#00FF88',
      colorGlow: 'rgba(0, 255, 136, 0.45)',
      colorBorder: 'rgba(0, 255, 136, 0.75)',
      minWidth: 420,
      minHeight: 320,
      triggerIds: ['btn-spectroscopy'],
      closeBtnId: 'btn-close-spectroscopy'
    },
    'vsepr-modal': {
      id: 'vsepr-modal',
      name: 'Geometría VSEPR 3D',
      shortTitle: 'VSEPR',
      icon: '📐',
      color: '#FF007F',
      colorGlow: 'rgba(255, 0, 127, 0.45)',
      colorBorder: 'rgba(255, 0, 127, 0.75)',
      minWidth: 420,
      minHeight: 320,
      triggerIds: ['btn-vsepr'],
      closeBtnId: 'btn-close-vsepr'
    },
    'suggestion-modal': {
      id: 'suggestion-modal',
      name: 'Sugerencias de Síntesis',
      shortTitle: 'SUGERENCIAS',
      icon: '💡',
      color: '#FF6B35',
      colorGlow: 'rgba(255, 107, 53, 0.45)',
      colorBorder: 'rgba(255, 107, 53, 0.75)',
      minWidth: 280,
      minHeight: 200,
      triggerIds: ['btn-suggest'],
      closeBtnId: 'btn-close-suggest'
    },
    'docs-modal': {
      id: 'docs-modal',
      name: 'NullaDocs IUPAC 3D',
      shortTitle: 'NULLADOCS',
      icon: '📖',
      color: '#4361EE',
      colorGlow: 'rgba(67, 97, 238, 0.45)',
      colorBorder: 'rgba(67, 97, 238, 0.75)',
      minWidth: 360,
      minHeight: 260,
      triggerIds: ['btn-docs'],
      closeBtnId: 'btn-close-docs'
    },
    'quiz-modal': {
      id: 'quiz-modal',
      name: 'Chemical Quiz Educativo',
      shortTitle: 'QUIZ',
      icon: '🎓',
      color: '#CCFF00',
      colorGlow: 'rgba(204, 255, 0, 0.45)',
      colorBorder: 'rgba(204, 255, 0, 0.75)',
      minWidth: 320,
      minHeight: 240,
      triggerIds: ['btn-quiz'],
      closeBtnId: 'btn-close-quiz'
    }
  };

  class WindowManager {
    constructor() {
      this.windows = new Map();
      this.minimizedWindows = new Set();
      this.dockElement = null;
      this.baseZIndex = 200;
      this.highestZIndex = 200;
      this.activeDrag = null;
      this.activeResize = null;
      this.initialized = false;
    }

    init() {
      if (this.initialized) return;
      this.ensureDock();
      this.registerAllWindows();
      this.bindGlobalEvents();
      this.initialized = true;
    }

    ensureDock() {
      let dock = document.getElementById('nulla-minimized-dock');
      if (!dock) {
        dock = document.createElement('div');
        dock.id = 'nulla-minimized-dock';
        dock.className = 'nulla-minimized-dock';
        dock.setAttribute('aria-label', 'Ventanas minimizadas');
        dock.setAttribute('role', 'region');
        document.body.appendChild(dock);
      }
      this.dockElement = dock;
    }

    registerAllWindows() {
      for (const [id, config] of Object.entries(WINDOW_CONFIGS)) {
        const modal = document.getElementById(id);
        if (!modal) continue;
        this.setupWindow(modal, config);
      }
    }

    setupWindow(modal, config) {
      if (this.windows.has(modal.id)) return;

      const state = {
        id: modal.id,
        modal,
        config,
        isMinimized: false,
        isMaximized: false,
        savedBounds: null,
        preMaxBounds: null
      };

      this.windows.set(modal.id, state);

      // Apply distinct color properties as CSS variables
      modal.style.setProperty('--win-accent', config.color);
      modal.style.setProperty('--win-glow', config.colorGlow);
      modal.style.setProperty('--win-border', config.colorBorder);
      modal.style.borderColor = config.colorBorder;
      modal.classList.add('nulla-window-managed');

      // Scrolling moves into an inner body so corner handles stay pinned to the frame
      this.wrapBody(modal);

      // Inject 4 corner transformation handles + 4 edges
      this.injectResizeHandles(modal, config);

      // Setup window controls (minimize, maximize, close)
      this.setupHeaderControls(modal, state);

      // Setup dragging anywhere except buttons
      this.setupDraggable(modal, state);

      // Intercept triggers
      if (config.triggerIds) {
        for (const triggerId of config.triggerIds) {
          const trigger = document.getElementById(triggerId);
          if (trigger) {
            trigger.addEventListener('click', () => {
              if (state.isMinimized) {
                this.restoreWindow(modal.id);
              }
            });
          }
        }
      }
    }

    wrapBody(modal) {
      if (modal.querySelector(':scope > .nulla-win-body')) return;
      const body = document.createElement('div');
      body.className = 'nulla-win-body';
      while (modal.firstChild) body.appendChild(modal.firstChild);
      modal.appendChild(body);
      // Preserve the authored max-height on the scrolling body (minus vertical padding)
      const cs = window.getComputedStyle(modal);
      if (modal.style.maxHeight && modal.style.maxHeight !== 'none') {
        const pad = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0) + 2;
        body.style.maxHeight = `calc(${modal.style.maxHeight} - ${pad}px)`;
      }
    }

    injectResizeHandles(modal, config) {
      if (modal.querySelector('.nulla-win-handle')) return;

      const handles = ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'];
      for (const handle of handles) {
        const el = document.createElement('div');
        el.className = `nulla-win-handle nulla-win-handle-${handle}`;
        el.dataset.handle = handle;
        el.title = 'Arrastrar esquina para transformar tamaño';
        el.addEventListener('pointerdown', (e) => this.startResize(e, modal, handle));
        modal.appendChild(el);
      }
    }

    setupHeaderControls(modal, state) {
      const closeBtn = document.getElementById(state.config.closeBtnId);
      if (!closeBtn) return;

      // Check if controls container already exists
      let controls = modal.querySelector('.nulla-win-controls');
      if (controls) return;

      controls = document.createElement('div');
      controls.className = 'nulla-win-controls';

      // Minimize button
      const minBtn = document.createElement('button');
      minBtn.type = 'button';
      minBtn.className = 'nulla-win-btn nulla-win-btn-min';
      minBtn.title = 'Minimizar a pestaña inferior';
      minBtn.setAttribute('aria-label', `Minimizar ${state.config.name}`);
      minBtn.textContent = '─';
      minBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.minimizeWindow(state.id);
      });

      // Maximize / restore button
      const maxBtn = document.createElement('button');
      maxBtn.type = 'button';
      maxBtn.className = 'nulla-win-btn nulla-win-btn-max';
      maxBtn.title = 'Maximizar / Restaurar tamaño';
      maxBtn.setAttribute('aria-label', `Maximizar ${state.config.name}`);
      maxBtn.textContent = '□';
      maxBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleMaximize(state.id);
      });

      // Insert controls where close button was
      closeBtn.parentNode.insertBefore(controls, closeBtn);
      controls.appendChild(minBtn);
      controls.appendChild(maxBtn);
      controls.appendChild(closeBtn);

      // Enhance close button style
      closeBtn.classList.add('nulla-win-btn', 'nulla-win-btn-close');

      // Intercept close button
      closeBtn.addEventListener('click', () => {
        if (state.isMinimized) {
          this.removeDockTab(state.id);
        }
        state.isMinimized = false;
        state.isMaximized = false;
        maxBtn.textContent = '□';
      });
    }

    setupDraggable(modal, state) {
      modal.addEventListener('pointerdown', (e) => {
        // Bring to front
        this.bringToFront(modal);

        // Check if interactive
        const interactive = e.target.closest(
          'button, input, select, textarea, canvas, a, .segre-filter-btn, .mol-chip, .fusion-slot, .nulla-win-handle, .nulla-win-btn, .color-swatch, [contenteditable="true"]'
        );
        if (interactive) return;

        // Check if a scrollbar of the inner body was clicked
        const body = modal.querySelector(':scope > .nulla-win-body');
        if (body && (body.scrollHeight > body.clientHeight || body.scrollWidth > body.clientWidth)) {
          const rect = body.getBoundingClientRect();
          if (e.clientX > rect.left + body.clientWidth || e.clientY > rect.top + body.clientHeight) return;
        }

        this.startDrag(e, modal, state);
      });
    }

    bringToFront(modal) {
      this.highestZIndex += 2;
      modal.style.zIndex = this.highestZIndex;
    }

    ensurePixelPosition(modal) {
      if (modal.dataset.nullaPixelized === '1') return;
      const style = window.getComputedStyle(modal);
      const anchoredByTransform = style.transform && style.transform !== 'none';
      const anchoredByEdges = modal.style.bottom || modal.style.right;
      if (anchoredByTransform || anchoredByEdges) {
        const rect = modal.getBoundingClientRect();
        modal.style.transform = 'none';
        modal.style.margin = '0';
        modal.style.bottom = 'auto';
        modal.style.right = 'auto';
        modal.dataset.nullaPixelized = '1';
        modal.style.left = `${Math.round(rect.left)}px`;
        modal.style.top = `${Math.round(rect.top)}px`;
        modal.style.width = `${Math.round(rect.width)}px`;
        modal.style.height = `${Math.round(rect.height)}px`;
        modal.style.maxHeight = 'none';
        modal.classList.add('is-sized');
      }
    }

    startDrag(e, modal, state) {
      if (state.isMaximized) return; // Cannot drag maximized window
      this.ensurePixelPosition(modal);

      const rect = modal.getBoundingClientRect();
      this.activeDrag = {
        modal,
        state,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
        pointerId: e.pointerId
      };

      try {
        modal.setPointerCapture(e.pointerId);
      } catch (_) {}

      document.body.classList.add('nulla-window-dragging');
      modal.classList.add('is-dragging');
    }

    onDragMove(e) {
      if (!this.activeDrag) return;
      const { modal, offsetX, offsetY } = this.activeDrag;

      let newLeft = e.clientX - offsetX;
      let newTop = e.clientY - offsetY;

      // Clamping within viewport
      const rect = modal.getBoundingClientRect();
      const minVisibleX = 80;
      const minVisibleY = 40;

      newLeft = Math.max(-rect.width + minVisibleX, Math.min(window.innerWidth - minVisibleX, newLeft));
      newTop = Math.max(0, Math.min(window.innerHeight - minVisibleY, newTop));

      modal.style.left = `${Math.round(newLeft)}px`;
      modal.style.top = `${Math.round(newTop)}px`;
    }

    onDragEnd(e) {
      if (!this.activeDrag) return;
      const { modal } = this.activeDrag;
      try {
        if (this.activeDrag.pointerId !== undefined) {
          modal.releasePointerCapture(this.activeDrag.pointerId);
        }
      } catch (_) {}

      document.body.classList.remove('nulla-window-dragging');
      modal.classList.remove('is-dragging');
      this.activeDrag = null;
    }

    startResize(e, modal, handle) {
      e.stopPropagation();
      e.preventDefault();

      const state = this.windows.get(modal.id);
      if (state && state.isMaximized) return;

      this.bringToFront(modal);
      this.ensurePixelPosition(modal);

      const rect = modal.getBoundingClientRect();
      this.activeResize = {
        modal,
        handle,
        state,
        startX: e.clientX,
        startY: e.clientY,
        startLeft: rect.left,
        startTop: rect.top,
        startWidth: rect.width,
        startHeight: rect.height,
        pointerId: e.pointerId
      };

      try {
        e.target.setPointerCapture(e.pointerId);
      } catch (_) {}

      document.body.classList.add('nulla-window-resizing');
      modal.classList.add('is-resizing');
      if (typeof window !== 'undefined' && window.NULLA_AUDIO) {
        window.NULLA_AUDIO.playCue('windowResize');
      }
    }

    onResizeMove(e) {
      if (!this.activeResize) return;
      const { modal, handle, state, startX, startY, startLeft, startTop, startWidth, startHeight } = this.activeResize;

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      const minW = state?.config?.minWidth || 320;
      const minH = state?.config?.minHeight || 220;
      const maxW = window.innerWidth - 20;
      const maxH = window.innerHeight - 20;

      let newWidth = startWidth;
      let newHeight = startHeight;
      let newLeft = startLeft;
      let newTop = startTop;

      // Handle corner and edge calculations
      if (handle.includes('e')) {
        newWidth = Math.max(minW, Math.min(maxW, startWidth + deltaX));
      }
      if (handle.includes('s')) {
        newHeight = Math.max(minH, Math.min(maxH, startHeight + deltaY));
      }
      if (handle.includes('w')) {
        const potentialWidth = startWidth - deltaX;
        if (potentialWidth >= minW && potentialWidth <= maxW) {
          newWidth = potentialWidth;
          newLeft = startLeft + deltaX;
        } else if (potentialWidth < minW) {
          newWidth = minW;
          newLeft = startLeft + (startWidth - minW);
        }
      }
      if (handle.includes('n')) {
        const potentialHeight = startHeight - deltaY;
        if (potentialHeight >= minH && potentialHeight <= maxH) {
          newHeight = potentialHeight;
          newTop = startTop + deltaY;
        } else if (potentialHeight < minH) {
          newHeight = minH;
          newTop = startTop + (startHeight - minH);
        }
      }

      modal.style.width = `${Math.round(newWidth)}px`;
      modal.style.height = `${Math.round(newHeight)}px`;
      modal.style.left = `${Math.round(newLeft)}px`;
      modal.style.top = `${Math.round(newTop)}px`;
    }

    onResizeEnd(e) {
      if (!this.activeResize) return;
      const { modal } = this.activeResize;
      document.body.classList.remove('nulla-window-resizing');
      modal.classList.remove('is-resizing');
      this.activeResize = null;
    }

    minimizeWindow(modalId) {
      const state = this.windows.get(modalId);
      if (!state || state.isMinimized) return;

      const { modal, config } = state;

      // Store bounds for restoration
      this.ensurePixelPosition(modal);
      const rect = modal.getBoundingClientRect();
      state.savedBounds = {
        left: modal.style.left,
        top: modal.style.top,
        width: modal.style.width,
        height: modal.style.height
      };

      // Hide window
      modal.style.display = 'none';
      state.isMinimized = true;
      this.minimizedWindows.add(modalId);

      // Create bottom dock tab
      this.createDockTab(state);
      this.updateDockVisibility();
      this.emit('nulla:window-minimized', modal);
      if (typeof window !== 'undefined' && window.NULLA_AUDIO) {
        window.NULLA_AUDIO.playCue('windowMinimize');
      }
    }

    emit(type, modal) {
      if (typeof document === 'undefined' || typeof CustomEvent === 'undefined') return;
      document.dispatchEvent(new CustomEvent(type, { detail: { id: modal.id, modal } }));
    }

    restoreWindow(modalId) {
      const state = this.windows.get(modalId);
      if (!state) return;

      const { modal } = state;
      const wasMinimized = state.isMinimized;

      // Restore display with smooth entrance
      modal.style.display = 'block';
      modal.classList.add('is-opening');
      setTimeout(() => modal.classList.remove('is-opening'), 300);
      state.isMinimized = false;
      this.minimizedWindows.delete(modalId);

      // Restore bounds
      if (state.savedBounds) {
        modal.style.left = state.savedBounds.left;
        modal.style.top = state.savedBounds.top;
        modal.style.width = state.savedBounds.width;
        modal.style.height = state.savedBounds.height;
      }

      this.bringToFront(modal);
      this.removeDockTab(modalId);
      this.updateDockVisibility();
      if (wasMinimized) {
        this.emit('nulla:window-restored', modal);
        if (typeof window !== 'undefined' && window.NULLA_AUDIO) {
          window.NULLA_AUDIO.playCue('windowRestore');
        }
      }
      // Trigger focus on first input or button
      const target = modal.querySelector('button, [href], select, input');
      if (target) target.focus({ preventScroll: true });
    }

    toggleMaximize(modalId) {
      const state = this.windows.get(modalId);
      if (!state) return;

      const { modal } = state;
      const maxBtn = modal.querySelector('.nulla-win-btn-max');

      if (!state.isMaximized) {
        if (typeof window !== 'undefined' && window.NULLA_AUDIO) {
          window.NULLA_AUDIO.playCue('windowMaximize');
        }
        // Store pre-maximized bounds
        this.ensurePixelPosition(modal);
        state.preMaxBounds = {
          left: modal.style.left,
          top: modal.style.top,
          width: modal.style.width,
          height: modal.style.height
        };

        // Maximize
        modal.style.left = '10px';
        modal.style.top = '10px';
        modal.style.width = 'calc(100vw - 20px)';
        modal.style.height = 'calc(100vh - 20px)';
        state.isMaximized = true;
        if (maxBtn) maxBtn.textContent = '❐';
      } else {
        // Restore
        if (state.preMaxBounds) {
          modal.style.left = state.preMaxBounds.left;
          modal.style.top = state.preMaxBounds.top;
          modal.style.width = state.preMaxBounds.width;
          modal.style.height = state.preMaxBounds.height;
        }
        state.isMaximized = false;
        if (maxBtn) maxBtn.textContent = '□';
      }
    }

    createDockTab(state) {
      const { id, config } = state;
      let tab = this.dockElement.querySelector(`[data-modal-id="${id}"]`);
      if (tab) return;

      tab = document.createElement('div');
      tab.className = 'nulla-dock-tab';
      tab.dataset.modalId = id;
      tab.style.setProperty('--tab-color', config.color);
      tab.style.setProperty('--tab-glow', config.colorGlow);
      tab.title = `Restaurar ${config.name}`;
      tab.setAttribute('role', 'button');
      tab.setAttribute('tabindex', '0');

      tab.innerHTML = `
        <span class="nulla-dock-led"></span>
        <span class="nulla-dock-icon">${config.icon}</span>
        <span class="nulla-dock-title">${config.shortTitle}</span>
        <button type="button" class="nulla-dock-close" title="Cerrar ventana" aria-label="Cerrar ${config.name}">✕</button>
      `;

      // Click tab to restore
      tab.addEventListener('click', (e) => {
        if (e.target.closest('.nulla-dock-close')) return;
        this.restoreWindow(id);
      });

      // Keydown Enter/Space to restore
      tab.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.restoreWindow(id);
        }
      });

      // Close button inside dock tab
      const closeBtn = tab.querySelector('.nulla-dock-close');
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeWindowFromDock(id);
      });

      this.dockElement.appendChild(tab);
    }

    removeDockTab(modalId) {
      const tab = this.dockElement?.querySelector(`[data-modal-id="${modalId}"]`);
      if (tab) tab.remove();
    }

    closeWindowFromDock(modalId) {
      const state = this.windows.get(modalId);
      if (!state) return;
      this.removeDockTab(modalId);
      state.isMinimized = false;
      state.isMaximized = false;
      this.minimizedWindows.delete(modalId);
      this.updateDockVisibility();
      // Route through the window's own close button so per-window teardown runs
      const closeBtn = document.getElementById(state.config.closeBtnId);
      if (closeBtn) closeBtn.click();
      else state.modal.style.display = 'none';
    }

    updateDockVisibility() {
      if (!this.dockElement) return;
      if (this.minimizedWindows.size > 0) {
        this.dockElement.classList.add('has-minimized');
      } else {
        this.dockElement.classList.remove('has-minimized');
      }
    }

    bindGlobalEvents() {
      window.addEventListener('pointermove', (e) => {
        if (this.activeDrag) this.onDragMove(e);
        if (this.activeResize) this.onResizeMove(e);
      });

      window.addEventListener('pointerup', (e) => {
        if (this.activeDrag) this.onDragEnd(e);
        if (this.activeResize) this.onResizeEnd(e);
      });

      window.addEventListener('pointercancel', (e) => {
        if (this.activeDrag) this.onDragEnd(e);
        if (this.activeResize) this.onResizeEnd(e);
      });

      // Keyboard Esc to close active or top window
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          // If dragging or resizing, cancel
          if (this.activeDrag) {
            this.onDragEnd(e);
            return;
          }
          if (this.activeResize) {
            this.onResizeEnd(e);
            return;
          }
        }
      });
    }

    getWindowConfig(id) {
      return WINDOW_CONFIGS[id] || null;
    }

    getAllConfigs() {
      return { ...WINDOW_CONFIGS };
    }
  }

  const manager = new WindowManager();

  // Auto-init on DOMContentLoaded or immediately if DOM is ready
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => manager.init());
    } else {
      manager.init();
    }
  }

  // Export on globalThis
  global.NULLA_WINDOW_MANAGER = manager;

})(typeof window !== 'undefined' ? window : globalThis);
