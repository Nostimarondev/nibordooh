import './domeGallery.css';

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
const normalizeAngle = d => ((d % 360) + 360) % 360;
const wrapAngleSigned = deg => {
  const a = (((deg + 180) % 360) + 360) % 360;
  return a - 180;
};
const getDataNumber = (el, name, fallback) => {
  const attr = el.dataset[name] ?? el.getAttribute(`data-${name}`);
  const n = attr == null ? NaN : parseFloat(attr);
  return Number.isFinite(n) ? n : fallback;
};

function buildItems(pool, seg) {
  const xCols = Array.from({ length: seg }, (_, i) => -37 + i * 2);
  const evenYs = [-4, -2, 0, 2, 4];
  const oddYs = [-3, -1, 1, 3, 5];

  const coords = xCols.flatMap((x, c) => {
    const ys = c % 2 === 0 ? evenYs : oddYs;
    return ys.map(y => ({ x, y, sizeX: 2, sizeY: 2 }));
  });

  const totalSlots = coords.length;
  if (pool.length === 0) {
    return coords.map(c => ({ ...c, src: '', alt: '' }));
  }

  const normalizedImages = pool.map(image => {
    if (typeof image === 'string') {
      return { src: image, alt: '' };
    }
    return { src: image.src || '', alt: image.alt || '' };
  });

  const usedImages = Array.from({ length: totalSlots }, (_, i) => normalizedImages[i % normalizedImages.length]);

  for (let i = 1; i < usedImages.length; i++) {
    if (usedImages[i].src === usedImages[i - 1].src) {
      for (let j = i + 1; j < usedImages.length; j++) {
        if (usedImages[j].src !== usedImages[i].src) {
          const tmp = usedImages[i];
          usedImages[i] = usedImages[j];
          usedImages[j] = tmp;
          break;
        }
      }
    }
  }

  return coords.map((c, i) => ({
    ...c,
    src: usedImages[i].src,
    alt: usedImages[i].alt
  }));
}

function computeItemBaseRotation(offsetX, offsetY, sizeX, sizeY, segments) {
  const unit = 360 / segments / 2;
  const rotateY = unit * (offsetX + (sizeX - 1) / 2);
  const rotateX = unit * (offsetY - (sizeY - 1) / 2);
  return { rotateX, rotateY };
}

export class DomeGallery {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    if (!this.container) return;

    this.options = {
      images: [],
      fit: 0.9,
      fitBasis: 'auto',
      minRadius: 650,
      maxRadius: Infinity,
      padFactor: 0.25,
      maxVerticalRotationDeg: 3,
      dragSensitivity: 20,
      enlargeTransitionMs: 300,
      segments: 34,
      dragDampening: 2,
      ...options
    };

    this.state = {
      rotation: { x: 0, y: 0 },
      startRot: { x: 0, y: 0 },
      startPos: null,
      dragging: false,
      moved: false,
      opening: false,
      openStartedAt: 0,
      lastDragEndAt: 0,
      scrollLocked: false,
      lockedRadius: 650,
      velocity: { x: 0, y: 0 },
      lastTime: 0,
      lastPos: null
    };

    this.focusedEl = null;
    this.originalTilePosition = null;
    this.inertiaRAF = null;

    this.init();
  }

  init() {
    this.items = buildItems(this.options.images, this.options.segments);
    this.buildDOM();
    this.bindEvents();
    this.handleResize();
    this.ro = new ResizeObserver(() => this.handleResize());
    this.ro.observe(this.rootRef);
    
    // Auto-scroll animation initially
    this.startInertia(0.5, 0); 
  }

  buildDOM() {
    this.rootRef = document.createElement('div');
    this.rootRef.className = 'sphere-root';
    this.rootRef.style.setProperty('--segments-x', this.options.segments);
    this.rootRef.style.setProperty('--segments-y', this.options.segments);

    this.mainRef = document.createElement('main');
    this.mainRef.className = 'sphere-main';

    const stage = document.createElement('div');
    stage.className = 'stage';

    this.sphereRef = document.createElement('div');
    this.sphereRef.className = 'sphere';

    this.items.forEach((it, i) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'item';
      itemEl.dataset.src = it.src;
      itemEl.dataset.offsetX = it.x;
      itemEl.dataset.offsetY = it.y;
      itemEl.dataset.sizeX = it.sizeX;
      itemEl.dataset.sizeY = it.sizeY;
      
      itemEl.style.setProperty('--offset-x', it.x);
      itemEl.style.setProperty('--offset-y', it.y);
      itemEl.style.setProperty('--item-size-x', it.sizeX);
      itemEl.style.setProperty('--item-size-y', it.sizeY);

      const imgWrapper = document.createElement('div');
      imgWrapper.className = 'item__image';
      imgWrapper.role = 'button';
      imgWrapper.tabIndex = 0;
      imgWrapper.setAttribute('aria-label', it.alt || 'Open image');
      
      const img = document.createElement('img');
      img.src = it.src;
      img.draggable = false;
      img.alt = it.alt;

      imgWrapper.appendChild(img);
      itemEl.appendChild(imgWrapper);
      this.sphereRef.appendChild(itemEl);

      // Event listeners for tile
      imgWrapper.addEventListener('click', (e) => this.onTileClick(e));
      imgWrapper.addEventListener('pointerup', (e) => {
        if (e.pointerType === 'touch') this.onTileClick(e);
      });
    });

    stage.appendChild(this.sphereRef);
    this.mainRef.appendChild(stage);

    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    const overlayBlur = document.createElement('div');
    overlayBlur.className = 'overlay overlay--blur';
    const edgeTop = document.createElement('div');
    edgeTop.className = 'edge-fade edge-fade--top';
    const edgeBottom = document.createElement('div');
    edgeBottom.className = 'edge-fade edge-fade--bottom';

    this.mainRef.appendChild(overlay);
    this.mainRef.appendChild(overlayBlur);
    this.mainRef.appendChild(edgeTop);
    this.mainRef.appendChild(edgeBottom);

    this.viewerRef = document.createElement('div');
    this.viewerRef.className = 'viewer';
    
    this.scrimRef = document.createElement('div');
    this.scrimRef.className = 'scrim';
    this.scrimRef.addEventListener('click', () => this.closeItem());
    
    this.frameRef = document.createElement('div');
    this.frameRef.className = 'frame';

    this.viewerRef.appendChild(this.scrimRef);
    this.viewerRef.appendChild(this.frameRef);
    this.mainRef.appendChild(this.viewerRef);

    this.rootRef.appendChild(this.mainRef);
    this.container.appendChild(this.rootRef);
  }

  handleResize() {
    if (!this.rootRef) return;
    const rect = this.rootRef.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    const minDim = Math.min(w, h);
    const maxDim = Math.max(w, h);
    const aspect = w / h;

    let basis;
    switch (this.options.fitBasis) {
      case 'min': basis = minDim; break;
      case 'max': basis = maxDim; break;
      case 'width': basis = w; break;
      case 'height': basis = h; break;
      default: basis = aspect >= 1.3 ? w : minDim;
    }

    let radius = basis * this.options.fit;
    const heightGuard = h * 1.35;
    radius = Math.min(radius, heightGuard);
    radius = clamp(radius, this.options.minRadius, this.options.maxRadius);
    this.state.lockedRadius = Math.round(radius);

    const viewerPad = Math.max(8, Math.round(minDim * this.options.padFactor));
    this.rootRef.style.setProperty('--radius', `${this.state.lockedRadius}px`);
    this.rootRef.style.setProperty('--viewer-pad', `${viewerPad}px`);
    
    this.applyTransform(this.state.rotation.x, this.state.rotation.y);

    const enlargedOverlay = this.viewerRef.querySelector('.enlarge');
    if (enlargedOverlay && this.frameRef && this.mainRef) {
      const frameR = this.frameRef.getBoundingClientRect();
      const mainR = this.mainRef.getBoundingClientRect();
      enlargedOverlay.style.left = `${frameR.left - mainR.left}px`;
      enlargedOverlay.style.top = `${frameR.top - mainR.top}px`;
      enlargedOverlay.style.width = `${frameR.width}px`;
      enlargedOverlay.style.height = `${frameR.height}px`;
    }
  }

  applyTransform(xDeg, yDeg) {
    if (this.sphereRef) {
      this.sphereRef.style.transform = `translateZ(calc(var(--radius) * -1)) rotateX(${xDeg}deg) rotateY(${yDeg}deg)`;
    }
  }

  lockScroll() {
    if (this.state.scrollLocked) return;
    this.state.scrollLocked = true;
    document.body.classList.add('dg-scroll-lock');
  }

  unlockScroll() {
    if (!this.state.scrollLocked) return;
    if (this.rootRef.getAttribute('data-enlarging') === 'true') return;
    this.state.scrollLocked = false;
    document.body.classList.remove('dg-scroll-lock');
  }

  stopInertia() {
    if (this.inertiaRAF) {
      cancelAnimationFrame(this.inertiaRAF);
      this.inertiaRAF = null;
    }
  }

  startInertia(vx, vy) {
    const MAX_V = 1.4;
    let vX = clamp(vx, -MAX_V, MAX_V) * 80;
    let vY = clamp(vy, -MAX_V, MAX_V) * 80;
    let frames = 0;
    const d = clamp(this.options.dragDampening, 0, 1);
    const frictionMul = 0.94 + 0.055 * d;
    const stopThreshold = 0.015 - 0.01 * d;
    const maxFrames = Math.round(90 + 270 * d);

    const step = () => {
      vX *= frictionMul;
      vY *= frictionMul;
      if (Math.abs(vX) < stopThreshold && Math.abs(vY) < stopThreshold) {
        this.inertiaRAF = null;
        return;
      }
      if (++frames > maxFrames) {
        this.inertiaRAF = null;
        return;
      }
      const nextX = clamp(
        this.state.rotation.x - vY / 200,
        -this.options.maxVerticalRotationDeg,
        this.options.maxVerticalRotationDeg
      );
      const nextY = wrapAngleSigned(this.state.rotation.y + vX / 200);
      this.state.rotation = { x: nextX, y: nextY };
      this.applyTransform(nextX, nextY);
      this.inertiaRAF = requestAnimationFrame(step);
    };
    this.stopInertia();
    this.inertiaRAF = requestAnimationFrame(step);
  }

  bindEvents() {
    const onPointerDown = (e) => {
      if (this.focusedEl) return;
      this.stopInertia();
      this.state.dragging = true;
      this.state.moved = false;
      this.state.startRot = { ...this.state.rotation };
      this.state.startPos = { x: e.clientX, y: e.clientY };
      this.state.lastPos = { x: e.clientX, y: e.clientY };
      this.state.lastTime = performance.now();
      this.state.velocity = { x: 0, y: 0 };
    };

    const onPointerMove = (e) => {
      if (this.focusedEl || !this.state.dragging || !this.state.startPos) return;
      
      const dxTotal = e.clientX - this.state.startPos.x;
      const dyTotal = e.clientY - this.state.startPos.y;
      
      if (!this.state.moved) {
        const dist2 = dxTotal * dxTotal + dyTotal * dyTotal;
        if (dist2 > 16) this.state.moved = true;
      }

      const now = performance.now();
      const dt = now - this.state.lastTime;
      if (dt > 0) {
        this.state.velocity = {
          x: (e.clientX - this.state.lastPos.x) / dt,
          y: (e.clientY - this.state.lastPos.y) / dt
        };
      }
      this.state.lastPos = { x: e.clientX, y: e.clientY };
      this.state.lastTime = now;

      const nextX = clamp(
        this.state.startRot.x - dyTotal / this.options.dragSensitivity,
        -this.options.maxVerticalRotationDeg,
        this.options.maxVerticalRotationDeg
      );
      const nextY = wrapAngleSigned(this.state.startRot.y + dxTotal / this.options.dragSensitivity);
      
      if (this.state.rotation.x !== nextX || this.state.rotation.y !== nextY) {
        this.state.rotation = { x: nextX, y: nextY };
        this.applyTransform(nextX, nextY);
      }
    };

    const onPointerUp = (e) => {
      if (!this.state.dragging) return;
      this.state.dragging = false;
      
      let vx = clamp(this.state.velocity.x * 2, -1.2, 1.2);
      let vy = clamp(this.state.velocity.y * 2, -1.2, 1.2);
      
      if (Math.abs(vx) > 0.005 || Math.abs(vy) > 0.005) {
        this.startInertia(vx, vy);
      }
      
      if (this.state.moved) this.state.lastDragEndAt = performance.now();
      this.state.moved = false;
    };

    this.mainRef.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    
    // Handle Escape key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeItem();
    });
  }

  onTileClick(e) {
    if (this.state.dragging || this.state.moved) return;
    if (performance.now() - this.state.lastDragEndAt < 80) return;
    if (this.state.opening) return;
    
    const el = e.currentTarget;
    this.openItem(el);
  }

  openItem(el) {
    if (this.state.opening) return;
    this.state.opening = true;
    this.state.openStartedAt = performance.now();
    this.lockScroll();
    
    const parent = el.parentElement;
    this.focusedEl = el;
    el.setAttribute('data-focused', 'true');
    
    const offsetX = getDataNumber(parent, 'offsetX', 0);
    const offsetY = getDataNumber(parent, 'offsetY', 0);
    const sizeX = getDataNumber(parent, 'sizeX', 2);
    const sizeY = getDataNumber(parent, 'sizeY', 2);
    const parentRot = computeItemBaseRotation(offsetX, offsetY, sizeX, sizeY, this.options.segments);
    
    const parentY = normalizeAngle(parentRot.rotateY);
    const globalY = normalizeAngle(this.state.rotation.y);
    let rotY = -(parentY + globalY) % 360;
    if (rotY < -180) rotY += 360;
    const rotX = -parentRot.rotateX - this.state.rotation.x;
    
    parent.style.setProperty('--rot-y-delta', `${rotY}deg`);
    parent.style.setProperty('--rot-x-delta', `${rotX}deg`);
    
    const refDiv = document.createElement('div');
    refDiv.className = 'item__image item__image--reference';
    refDiv.style.opacity = '0';
    refDiv.style.transform = `rotateX(${-parentRot.rotateX}deg) rotateY(${-parentRot.rotateY}deg)`;
    parent.appendChild(refDiv);

    // Force layout
    void refDiv.offsetHeight;

    const tileR = refDiv.getBoundingClientRect();
    const mainR = this.mainRef.getBoundingClientRect();
    const frameR = this.frameRef.getBoundingClientRect();

    if (tileR.width <= 0 || tileR.height <= 0) {
      this.state.opening = false;
      this.focusedEl = null;
      parent.removeChild(refDiv);
      this.unlockScroll();
      return;
    }

    this.originalTilePosition = { left: tileR.left, top: tileR.top, width: tileR.width, height: tileR.height };
    el.style.visibility = 'hidden';
    el.style.zIndex = 0;
    
    const overlay = document.createElement('div');
    overlay.className = 'enlarge';
    overlay.style.position = 'absolute';
    overlay.style.left = (frameR.left - mainR.left) + 'px';
    overlay.style.top = (frameR.top - mainR.top) + 'px';
    overlay.style.width = frameR.width + 'px';
    overlay.style.height = frameR.height + 'px';
    overlay.style.opacity = '0';
    overlay.style.zIndex = '30';
    overlay.style.willChange = 'transform, opacity';
    overlay.style.transformOrigin = 'top left';
    overlay.style.transition = `transform ${this.options.enlargeTransitionMs}ms ease, opacity ${this.options.enlargeTransitionMs}ms ease`;
    
    const rawSrc = parent.dataset.src || el.querySelector('img')?.src || '';
    const img = document.createElement('img');
    img.src = rawSrc;
    overlay.appendChild(img);
    this.viewerRef.appendChild(overlay);
    
    const tx0 = tileR.left - frameR.left;
    const ty0 = tileR.top - frameR.top;
    const sx0 = tileR.width / frameR.width;
    const sy0 = tileR.height / frameR.height;
    
    const validSx0 = isFinite(sx0) && sx0 > 0 ? sx0 : 1;
    const validSy0 = isFinite(sy0) && sy0 > 0 ? sy0 : 1;
    
    overlay.style.transform = `translate(${tx0}px, ${ty0}px) scale(${validSx0}, ${validSy0})`;

    setTimeout(() => {
      if (!overlay.parentElement) return;
      overlay.style.opacity = '1';
      overlay.style.transform = 'translate(0px, 0px) scale(1, 1)';
      this.rootRef.setAttribute('data-enlarging', 'true');
    }, 16);
  }

  closeItem() {
    if (performance.now() - this.state.openStartedAt < 250) return;
    const el = this.focusedEl;
    if (!el) return;
    
    const parent = el.parentElement;
    const overlay = this.viewerRef.querySelector('.enlarge');
    if (!overlay) return;
    
    const refDiv = parent.querySelector('.item__image--reference');
    const originalPos = this.originalTilePosition;
    
    if (!originalPos) {
      overlay.remove();
      if (refDiv) refDiv.remove();
      parent.style.setProperty('--rot-y-delta', '0deg');
      parent.style.setProperty('--rot-x-delta', '0deg');
      el.style.visibility = '';
      el.style.zIndex = 0;
      this.focusedEl = null;
      this.rootRef.removeAttribute('data-enlarging');
      this.state.opening = false;
      this.unlockScroll();
      return;
    }
    
    const currentRect = overlay.getBoundingClientRect();
    const rootRect = this.rootRef.getBoundingClientRect();
    
    const originalPosRelativeToRoot = {
      left: originalPos.left - rootRect.left,
      top: originalPos.top - rootRect.top,
      width: originalPos.width,
      height: originalPos.height
    };
    
    const overlayRelativeToRoot = {
      left: currentRect.left - rootRect.left,
      top: currentRect.top - rootRect.top,
      width: currentRect.width,
      height: currentRect.height
    };
    
    const animatingOverlay = document.createElement('div');
    animatingOverlay.className = 'enlarge-closing';
    animatingOverlay.style.cssText = `position:absolute;left:${overlayRelativeToRoot.left}px;top:${overlayRelativeToRoot.top}px;width:${overlayRelativeToRoot.width}px;height:${overlayRelativeToRoot.height}px;z-index:9999;border-radius: var(--enlarge-radius, 32px);overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.35);transition:all ${this.options.enlargeTransitionMs}ms ease-out;pointer-events:none;margin:0;transform:none;`;
    
    const originalImg = overlay.querySelector('img');
    if (originalImg) {
      const img = originalImg.cloneNode();
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
      animatingOverlay.appendChild(img);
    }
    
    overlay.remove();
    this.rootRef.appendChild(animatingOverlay);
    
    // Force layout
    void animatingOverlay.getBoundingClientRect();
    
    requestAnimationFrame(() => {
      animatingOverlay.style.left = originalPosRelativeToRoot.left + 'px';
      animatingOverlay.style.top = originalPosRelativeToRoot.top + 'px';
      animatingOverlay.style.width = originalPosRelativeToRoot.width + 'px';
      animatingOverlay.style.height = originalPosRelativeToRoot.height + 'px';
      animatingOverlay.style.opacity = '0';
    });
    
    const cleanup = () => {
      animatingOverlay.remove();
      this.originalTilePosition = null;
      if (refDiv) refDiv.remove();
      parent.style.transition = 'none';
      el.style.transition = 'none';
      parent.style.setProperty('--rot-y-delta', '0deg');
      parent.style.setProperty('--rot-x-delta', '0deg');
      
      requestAnimationFrame(() => {
        el.style.visibility = '';
        el.style.opacity = '0';
        el.style.zIndex = 0;
        this.focusedEl = null;
        this.rootRef.removeAttribute('data-enlarging');
        
        requestAnimationFrame(() => {
          parent.style.transition = '';
          el.style.transition = 'opacity 300ms ease-out';
          
          requestAnimationFrame(() => {
            el.style.opacity = '1';
            
            setTimeout(() => {
              el.style.transition = '';
              el.style.opacity = '';
              el.removeAttribute('data-focused');
              this.state.opening = false;
              if (!this.state.dragging && this.rootRef.getAttribute('data-enlarging') !== 'true') {
                document.body.classList.remove('dg-scroll-lock');
                this.state.scrollLocked = false;
              }
            }, 300);
          });
        });
      });
    };
    
    animatingOverlay.addEventListener('transitionend', cleanup, { once: true });
  }

  destroy() {
    this.stopInertia();
    if (this.ro) this.ro.disconnect();
    this.container.innerHTML = '';
  }
}
