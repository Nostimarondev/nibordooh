// driftWall.js - Vanilla JS port of React Bits DriftWall

const columnFactor = (index, variance) => {
  const pseudo = ((index * 0.6180339887 + 0.35) % 1) * 2 - 1;
  return 1 + variance * pseudo;
};

export class DriftWall {
  constructor(containerId, options = {}) {
    this.container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    if (!this.container) return;

    // Default configuration mapped from React props
    this.config = {
      items: options.items || [],
      columns: options.columns ?? 5,
      tileWidth: options.tileWidth ?? 200,
      tileHeight: options.tileHeight ?? 132,
      gap: options.gap ?? 18,
      radius: options.radius ?? 14,
      tilt: options.tilt ?? 16,
      turn: options.turn ?? -14,
      roll: options.roll ?? 0,
      perspective: options.perspective ?? 1200,
      depth: options.depth ?? 120,
      speed: options.speed ?? 42,
      direction: options.direction ?? 'up',
      variance: options.variance ?? 0.45,
      parallax: options.parallax ?? 0.6,
      pauseOnHover: options.pauseOnHover ?? false,
      lift: options.lift ?? 64,
      fade: options.fade ?? 0.6,
      dim: options.dim ?? 0.55,
      grayscale: options.grayscale ?? false,
      overlayColor: options.overlayColor ?? '#060010',
    };

    // Internal state
    this.containerHeight = 600;
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.wallHovered = false;
    this.hoveredCol = -1;
    this.activeId = null;
    this.pointer = { x: 0, y: 0 };
    this.pointerDamped = { x: 0, y: 0 };
    this.lastTs = null;
    this.rafId = null;

    this.trackEls = [];
    this.offsets = [];
    this.velocities = [];
    this.baseVelocities = [];
    this.columnMeta = [];
    this.columnItems = [];

    this.init();
  }

  init() {
    this.setupCssVars();
    this.calculateColumns();
    this.buildDOM();
    this.bindEvents();
    
    // Start animation loop
    this.rafId = requestAnimationFrame((ts) => this.animate(ts));
  }

  setupCssVars() {
    const c = this.config;
    const style = this.container.style;
    style.setProperty('--dw-tile-w', `${c.tileWidth}px`);
    style.setProperty('--dw-tile-h', `${c.tileHeight}px`);
    style.setProperty('--dw-gap', `${c.gap}px`);
    style.setProperty('--dw-radius', `${c.radius}px`);
    style.setProperty('--dw-perspective', `${c.perspective}px`);
    style.setProperty('--dw-lift', `${c.lift}px`);
    style.setProperty('--dw-dim', c.dim);
    style.setProperty('--dw-gray', c.grayscale ? 1 : 0);
    style.setProperty('--dw-overlay', c.overlayColor);
    style.setProperty('--dw-edge', `${Math.max(0, (1 - c.fade) * 100)}%`);

    this.container.classList.add('drift-wall');
    if (this.reduced) this.container.classList.add('drift-wall--reduced');
  }

  calculateColumns() {
    const c = this.config;
    
    // Distribute items into columns (scattered/shuffled)
    // Each column gets a fully shuffled array of the items to avoid repetition
    const cols = Array.from({ length: c.columns }, () => {
      return [...c.items].sort(() => Math.random() - 0.5);
    });
    
    this.columnItems = cols;

    // Meta height calculations
    const rect = this.container.getBoundingClientRect();
    this.containerHeight = rect.height || 600;

    const unit = c.tileHeight + c.gap;
    this.columnMeta = this.columnItems.map(col => {
      const copyHeight = Math.max(unit, col.length * unit);
      const copies = Math.max(2, Math.ceil((this.containerHeight * 1.6) / copyHeight) + 1);
      return { copyHeight, copies };
    });

    // Calculate base velocities
    const dirSign = c.direction === 'up' ? 1 : -1;
    this.baseVelocities = this.columnItems.map((_, colIndex) => {
      const altSign = colIndex % 2 === 0 ? 1 : -1;
      return c.speed * columnFactor(colIndex, c.variance) * dirSign * altSign;
    });

    this.offsets = this.columnMeta.map((meta, colIndex) => meta.copyHeight * ((colIndex * 0.37) % 1));
    this.velocities = this.columnItems.map(() => 0);
  }

  buildDOM() {
    this.container.innerHTML = '';
    
    this.planeEl = document.createElement('div');
    this.planeEl.className = 'drift-wall__plane';
    this.applyPlaneTransform(0, 0);

    this.columnItems.forEach((col, cIdx) => {
      const meta = this.columnMeta[cIdx];
      const colEl = document.createElement('div');
      colEl.className = 'drift-wall__col';

      const trackEl = document.createElement('div');
      trackEl.className = 'drift-wall__track';
      this.trackEls[cIdx] = trackEl;

      for (let copy = 0; copy < meta.copies; copy++) {
        col.forEach((item, itemIdx) => {
          const id = `${cIdx}-${copy}-${itemIdx}`;
          const tile = this.createTile(item, id, cIdx);
          trackEl.appendChild(tile);
        });
      }

      colEl.appendChild(trackEl);
      this.planeEl.appendChild(colEl);
    });

    this.container.appendChild(this.planeEl);
  }

  createTile(item, id, colIndex) {
    const tileWrapper = document.createElement(item.href ? 'a' : 'div');
    tileWrapper.className = 'drift-wall__tile';
    tileWrapper.dataset.tileId = id;
    tileWrapper.dataset.col = colIndex;

    if (item.href) {
      tileWrapper.href = item.href;
      tileWrapper.target = '_blank';
      tileWrapper.rel = 'noreferrer noopener';
    } else {
      tileWrapper.tabIndex = 0;
      tileWrapper.role = 'button';
    }

    // Inner Elements
    const inner = document.createElement('span');
    inner.className = 'drift-wall__inner';

    const img = document.createElement('img');
    img.src = item.image;
    img.alt = item.title || '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.draggable = false;

    const overlay = document.createElement('span');
    overlay.className = 'drift-wall__overlay';
    overlay.setAttribute('aria-hidden', 'true');

    inner.appendChild(img);
    inner.appendChild(overlay);
    tileWrapper.appendChild(inner);

    // Hover Events
    tileWrapper.addEventListener('focus', () => this.activate(id, colIndex));
    tileWrapper.addEventListener('blur', () => this.release());

    return tileWrapper;
  }

  bindEvents() {
    this.container.addEventListener('pointermove', (e) => {
      const rect = this.container.getBoundingClientRect();
      if (this.config.parallax > 0 && !this.reduced) {
        this.pointer.x = (e.clientX - rect.left) / rect.width - 0.5;
        this.pointer.y = (e.clientY - rect.top) / rect.height - 0.5;
      }
      
      const tile = e.target.closest ? e.target.closest('[data-tile-id]') : null;
      if (!tile) return;
      
      const id = tile.dataset.tileId;
      if (id !== this.activeId) {
        this.activate(id, Number(tile.dataset.col));
        
        // Remove active class from old, add to new
        const activeEls = this.container.querySelectorAll('.is-active');
        activeEls.forEach(el => el.classList.remove('is-active'));
        tile.classList.add('is-active');
      }
    });

    this.container.addEventListener('pointerenter', () => {
      this.wallHovered = true;
    });

    this.container.addEventListener('pointerleave', () => {
      this.wallHovered = false;
      this.pointer = { x: 0, y: 0 };
      this.release();
      const activeEls = this.container.querySelectorAll('.is-active');
      activeEls.forEach(el => el.classList.remove('is-active'));
    });

    window.addEventListener('resize', () => {
      const rect = this.container.getBoundingClientRect();
      this.containerHeight = rect.height || 600;
      // We might need to rebuild columns here, but simple resize observer handles it in React.
      // For Vanilla JS, we'll let CSS handle the flex layout, the meta copy logic has plenty of buffer.
    });

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    mq.addEventListener('change', (e) => {
      this.reduced = e.matches;
      if (this.reduced) this.container.classList.add('drift-wall--reduced');
      else this.container.classList.remove('drift-wall--reduced');
    });
  }

  activate(id, colIndex) {
    this.activeId = id;
    this.hoveredCol = colIndex;
  }

  release() {
    this.activeId = null;
    this.hoveredCol = -1;
  }

  applyPlaneTransform(px, py) {
    if (!this.planeEl) return;
    const { tilt, turn, roll, depth } = this.config;
    this.planeEl.style.transform =
      `translate(-50%, -50%) scale(1.18) ` +
      `rotateX(${tilt + py}deg) rotateY(${turn + px}deg) rotateZ(${roll}deg) ` +
      `translateZ(${-depth}px)`;
  }

  animate(ts) {
    if (this.lastTs === null) this.lastTs = ts;
    const dt = Math.min(0.05, Math.max(0, ts - this.lastTs) / 1000);
    this.lastTs = ts;

    const maxTilt = this.config.parallax * 8;
    const targetX = this.pointer.x * maxTilt;
    const targetY = -this.pointer.y * maxTilt;
    const damp = 1 - Math.exp(-dt / 0.12);
    
    this.pointerDamped.x += (targetX - this.pointerDamped.x) * damp;
    this.pointerDamped.y += (targetY - this.pointerDamped.y) * damp;
    this.applyPlaneTransform(this.pointerDamped.x, this.pointerDamped.y);

    if (!this.reduced) {
      for (let c = 0; c < this.trackEls.length; c++) {
        const meta = this.columnMeta[c];
        if (!meta) continue;
        
        const paused = this.wallHovered && this.config.pauseOnHover;
        const factor = paused || this.hoveredCol === c ? 0 : 1;
        const target = this.baseVelocities[c] * factor;

        const ease = 1 - Math.exp(-dt / (target === 0 ? 0.16 : 0.28));
        this.velocities[c] += (target - this.velocities[c]) * ease;
        
        let next = (this.offsets[c] ?? 0) + this.velocities[c] * dt;
        next = ((next % meta.copyHeight) + meta.copyHeight) % meta.copyHeight;
        this.offsets[c] = next;

        const el = this.trackEls[c];
        if (el) el.style.transform = `translate3d(0, ${-next}px, 0)`;
      }
    } else {
      for (let c = 0; c < this.trackEls.length; c++) {
        const el = this.trackEls[c];
        const meta = this.columnMeta[c];
        if (el && meta) el.style.transform = `translate3d(0, ${-(this.offsets[c] ?? 0)}px, 0)`;
      }
    }

    this.rafId = requestAnimationFrame((t) => this.animate(t));
  }

  destroy() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.container.innerHTML = '';
  }
}
