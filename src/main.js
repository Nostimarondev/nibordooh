import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { initTopography } from './Topography.js';
import { initPfpMaker } from './pfpMaker.js';
import { initBlinkingDots } from './blinkingDots.js';
import { DriftWall } from './driftWall.js';
import { DomeGallery } from './domeGallery.js';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

// ─── Lenis Smooth Scroll ──────────────────────────────────────────────────────
const lenis = new Lenis({
  duration: 1.2,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothWheel: true,
});

lenis.on('scroll', ScrollTrigger.update);

gsap.ticker.add((time) => {
  lenis.raf(time * 1000);
});
gsap.ticker.lagSmoothing(0);

// ─── Live GME Price (DexScreener API) ────────────────────────────────────────
const PRICE_REFRESH_MS = 30_000;

async function fetchGMEPrice() {
  try {
    const res = await fetch(
      'https://api.dexscreener.com/latest/dex/search?q=GME',
      { headers: { Accept: 'application/json' } }
    );
    if (!res.ok) return null;
    const data = await res.json();

    if (!data.pairs || data.pairs.length === 0) return null;

    // Filter to pairs where the base token is GME, pick highest liquidity
    const gmePairs = data.pairs
      .filter(p => p.baseToken?.symbol?.toUpperCase() === 'GME')
      .sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));

    if (gmePairs.length === 0) return null;

    const priceUsd = parseFloat(gmePairs[0].priceUsd);
    if (isNaN(priceUsd)) return null;

    // Format: show more decimals for sub-cent prices
    return priceUsd < 0.01
      ? `$${priceUsd.toFixed(6)}`
      : priceUsd < 1
      ? `$${priceUsd.toFixed(4)}`
      : `$${priceUsd.toFixed(2)}`;
  } catch {
    return null;
  }
}

function initPriceFeed() {
  const priceEl = document.getElementById('gme-price');
  const dotEl   = document.getElementById('price-dot');
  if (!priceEl) return;

  const updatePrice = async () => {
    const price = await fetchGMEPrice();
    if (price) {
      // Pulse dot on successful update
      if (dotEl) {
        gsap.fromTo(dotEl, { scale: 1.8, opacity: 0.5 }, { scale: 1, opacity: 1, duration: 0.4, ease: 'power2.out' });
      }
      // Cross-fade text update
      gsap.to(priceEl, {
        opacity: 0, duration: 0.15, onComplete: () => {
          priceEl.textContent = price;
          gsap.to(priceEl, { opacity: 1, duration: 0.3 });
        }
      });
    } else if (priceEl.textContent === '...') {
      priceEl.textContent = '--';
    }
  };

  updatePrice();
  setInterval(updatePrice, PRICE_REFRESH_MS);
}

// ─── Hamburger Menu ───────────────────────────────────────────────────────────
function initHamburger() {
  const btn         = document.getElementById('hamburger-btn');
  const closeBtn    = document.getElementById('mobile-menu-close');
  const menu        = document.getElementById('mobile-menu');
  const mobileLinks = menu ? menu.querySelectorAll('.mobile-nav-link') : [];

  if (!btn || !menu) return;

  let isOpen = false;

  const openMenu = () => {
    isOpen = true;
    btn.classList.add('is-open');
    btn.setAttribute('aria-expanded', 'true');
    menu.classList.add('is-open');
    menu.setAttribute('aria-hidden', 'false');
    lenis.stop();
  };

  const closeMenu = () => {
    isOpen = false;
    btn.classList.remove('is-open');
    btn.setAttribute('aria-expanded', 'false');
    menu.classList.remove('is-open');
    menu.setAttribute('aria-hidden', 'true');
    lenis.start();
  };

  btn.addEventListener('click', () => isOpen ? closeMenu() : openMenu());

  // Close button inside the overlay
  if (closeBtn) closeBtn.addEventListener('click', closeMenu);

  // Close when a mobile link is clicked and scroll via Lenis
  mobileLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      closeMenu();
      const targetId = link.getAttribute('href');
      const targetEl = document.querySelector(targetId);
      if (targetEl) {
        setTimeout(() => {
          lenis.scrollTo(targetEl, {
            offset: -80,
            duration: 1.2,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
          });
        }, 350); // Wait for menu close animation
      }
    });
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) closeMenu();
  });
}

// ─── Active Nav Link Tracking ─────────────────────────────────────────────────
function initActiveNav() {
  const sections    = document.querySelectorAll('section[id]');
  const navLinks    = document.querySelectorAll('.nav-link');
  const mobileLinks = document.querySelectorAll('.mobile-nav-link');

  if (sections.length === 0) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const href = `#${entry.target.id}`;

        navLinks.forEach(link => {
          link.classList.toggle('active', link.getAttribute('href') === href);
        });
        mobileLinks.forEach(link => {
          link.classList.toggle('active', link.getAttribute('href') === href);
        });
      });
    },
    { rootMargin: '-40% 0px -55% 0px' }
  );

  sections.forEach(s => observer.observe(s));
}

// ─── DOMContentLoaded ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // Init live price feed
  initPriceFeed();

  // Init hamburger menu
  initHamburger();

  // Init active nav tracking
  initActiveNav();

  // Smooth Scroll for desktop Nav Links using Lenis
  document.querySelectorAll('a.nav-link[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const targetId = this.getAttribute('href');
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        lenis.scrollTo(targetElement, {
          offset: -80,
          duration: 1.2,
          easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t))
        });
      }
    });
  });

  // Initialize Topography background
  initTopography('topography-bg', {
    lowColor: '#84CC16',
    midColor: '#1c2d01',
    highColor: '#FFFFFF',
    speed: 0.2,
    morphAmount: 3.0,
    morphSpeed: 0.05,
    bands: 1.5,
    thickness: 0.01,
    scale: 2.0,
    pixelSize: 1.0,
    glow: 0.5,
    colorMode: 'elevation',
    contrast: 3.0,
    brightness: 1.0,
    fillBands: false,
    opacity: 1.0,
    grain: true,
    grainIntensity: 0.05,
    mouseInteraction: true,
    mouseRadius: 0.3,
    mouseStrength: 0.4
  });

  // Initialize PFP Maker
  initPfpMaker();

  // Initialize Blinking Dots background for Lore section
  initBlinkingDots('lore-dots-canvas');

  // Lore text reveal animation
  const loreItems = document.querySelectorAll('.lore-text-item');
  const loreSideImages = document.querySelectorAll('.lore-side-img');

  loreItems.forEach((item, index) => {
    // Text fade in
    gsap.to(item, {
      scrollTrigger: {
        trigger: item,
        start: 'top 65%',
        end: 'top 45%',
        scrub: true,
        onEnter: () => {
          loreSideImages.forEach(img => img.classList.remove('active'));
          if (loreSideImages[index]) loreSideImages[index].classList.add('active');
        },
        onLeaveBack: () => {
          loreSideImages.forEach(img => img.classList.remove('active'));
          const prevIndex = index > 0 ? index - 1 : 0;
          if (loreSideImages[prevIndex]) loreSideImages[prevIndex].classList.add('active');
        }
      },
      opacity: 1,
    });

    // Text fade out
    gsap.to(item, {
      scrollTrigger: {
        trigger: item,
        start: 'bottom 45%',
        end: 'bottom 25%',
        scrub: true,
      },
      opacity: 0.15,
    });
  });

  // Initialize DriftWall background for PFP Maker section
  const wallItems = [
    { image: '/img/1.png', title: 'Tile 1' },
    { image: '/img/2.png', title: 'Tile 2' },
    { image: '/img/3.png', title: 'Tile 3' },
    { image: '/img/4.png', title: 'Tile 4' },
    { image: '/img/5.png', title: 'Tile 5' },
    { image: '/img/6.png', title: 'Tile 6' },
    { image: '/img/7.png', title: 'Tile 7' },
  ];

  new DriftWall('drift-wall-bg', {
    items: wallItems,
    columns: 5,
    tileWidth: 200,
    tileHeight: 132,
    gap: 18,
    tilt: 16,
    turn: -14,
    perspective: 1200,
    depth: 120,
    speed: 42,
    direction: "up",
    variance: 0.45,
    parallax: 0.6,
    lift: 64,
    fade: 0.6,
    dim: 0.55,
    overlayColor: "#050505",
    radius: 14,
    roll: 0,
    pauseOnHover: false,
    grayscale: false
  });

  // PFP Maker Entrance
  gsap.from('.pfp-container', {
    scrollTrigger: {
      trigger: '.pfp-section',
      start: 'top 75%',
    },
    y: 50,
    opacity: 0,
    duration: 1,
    ease: 'power3.out'
  });

  // Initialize Dome Gallery
  const galleryImages = [
    '/img/1.png', '/img/2.png', '/img/3.png', '/img/4.png',
    '/img/5.png', '/img/6.png', '/img/7.png', '/img/8.png',
    '/img/lore1.png', '/img/lore2.png', '/img/lore3.png'
  ];
  
  new DomeGallery('#dome-gallery-container', {
    images: galleryImages,
    segments: 34,
    dragDampening: 2,
    fit: 0.9,
    minRadius: 650,
    maxVerticalRotationDeg: 3
  });

  // Hero entry animations (mascot removed — animation cleaned up)
  const tl = gsap.timeline();

  tl.fromTo('.hero-bg',
      { scale: 1.15 },
      { scale: 1, duration: 25, ease: 'power1.out' },
      0
    )
    .fromTo('.navbar',
      { y: -30, opacity: 0 },
      { y: 0, opacity: 1, duration: 1, ease: 'power3.out' },
      0.5
    )
    .fromTo('.hero-title-slanted',
      { opacity: 0, scale: 0.8, x: -50, skewX: -12 },
      { opacity: 1, scale: 1, x: 0, skewX: -12, duration: 1, ease: 'back.out(1.5)' },
      0.8
    )
    .fromTo('.hero-subtitle',
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' },
      1.0
    )
    .fromTo('.action-buttons',
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 0.8, ease: 'back.out(1.2)' },
      1.2
    );

  // Premium Slider Logic
  const slides = document.querySelectorAll('.slider-slide');
  const prevBtn = document.querySelector('.prev-btn');
  const nextBtn = document.querySelector('.next-btn');
  let currentSlide = 0;
  let isAnimating = false;

  function goToSlide(index) {
    if (index === currentSlide || isAnimating) return;
    isAnimating = true;

    const outgoing = slides[currentSlide];
    const incoming = slides[index];

    // Animate out
    gsap.to(outgoing, {
      opacity: 0,
      scale: 0.95,
      y: -20,
      duration: 0.4,
      ease: 'power2.in',
      onComplete: () => {
        outgoing.classList.remove('active');
        incoming.classList.add('active');

        // Reset incoming initial state
        gsap.set(incoming, { opacity: 0, scale: 0.95, y: 20 });
        const floatPanels = incoming.querySelectorAll('.slide-floating-panel');
        gsap.set(floatPanels, { opacity: 0, y: 40, scale: 0.8 });

        // Animate incoming main panel
        gsap.to(incoming, {
          opacity: 1,
          scale: 1,
          y: 0,
          duration: 0.6,
          ease: 'power3.out'
        });

        // Spring-damped floating panels
        if (floatPanels.length > 0) {
          gsap.to(floatPanels, {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 1.2,
            stagger: 0.15,
            ease: 'elastic.out(1, 0.5)',
            delay: 0.1
          });
        }

        setTimeout(() => { isAnimating = false; }, 600);
      }
    });

    currentSlide = index;
  }

  // Initial entrance for first slide floating panels
  if(slides.length > 0) {
    const firstFloatPanels = slides[0].querySelectorAll('.slide-floating-panel');
    gsap.from(firstFloatPanels, {
      opacity: 0, y: 40, scale: 0.8,
      duration: 1.2, stagger: 0.15, ease: 'elastic.out(1, 0.5)',
      scrollTrigger: { trigger: '.how-section', start: 'top 60%' }
    });
  }

  if(nextBtn && prevBtn) {
    nextBtn.addEventListener('click', () => {
      let nextIndex = (currentSlide + 1) % slides.length;
      goToSlide(nextIndex);
    });

    prevBtn.addEventListener('click', () => {
      let prevIndex = (currentSlide - 1 + slides.length) % slides.length;
      goToSlide(prevIndex);
    });
  }

  // Editorial Headline Animation
  gsap.fromTo('.editorial-headline',
    { opacity: 0, x: -40 },
    {
      opacity: 1, x: 0, duration: 1.2, ease: 'power3.out',
      scrollTrigger: { trigger: '.how-section', start: 'top 70%' }
    }
  );
  gsap.fromTo('.editorial-desc',
    { opacity: 0, x: -20 },
    {
      opacity: 1, x: 0, duration: 1, ease: 'power2.out', delay: 0.3,
      scrollTrigger: { trigger: '.how-section', start: 'top 70%' }
    }
  );

  // Mousemove Parallax for Floating Panels & Main Panel
  const howSection = document.querySelector('.how-section');
  if(howSection) {
    howSection.addEventListener('mousemove', (e) => {
      const rect = howSection.getBoundingClientRect();
      const x = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2);
      const y = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2);

      const activeFloatPanels = document.querySelectorAll('.slider-slide.active .slide-floating-panel');
      const activeMainPanel = document.querySelector('.slider-slide.active .slide-main-panel');

      activeFloatPanels.forEach((panel, index) => {
        const depth = index === 0 ? 15 : -12;
        gsap.to(panel, {
          x: x * depth,
          y: y * depth,
          duration: 1.5,
          ease: 'power2.out',
          overwrite: 'auto'
        });
      });

      if (activeMainPanel) {
        gsap.to(activeMainPanel, {
          x: x * -8,
          y: y * -8,
          duration: 1.5,
          ease: 'power2.out',
          overwrite: 'auto'
        });
      }
    });

    howSection.addEventListener('mouseleave', () => {
      const allFloatPanels = document.querySelectorAll('.slide-floating-panel');
      const allMainPanels = document.querySelectorAll('.slide-main-panel');

      gsap.to([...allFloatPanels, ...allMainPanels], {
        x: 0,
        y: 0,
        duration: 1.5,
        ease: 'power2.out',
        overwrite: 'auto'
      });
    });
  }

  // Marquee infinite horizontal scrolling
  gsap.to('.marquee-track', {
    xPercent: -50,
    duration: 20,
    ease: "none",
    repeat: -1
  });
});
