import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { initTopography } from './Topography.js';
import { initPfpMaker } from './pfpMaker.js';
import { initBlinkingDots } from './blinkingDots.js';
import { DriftWall } from './driftWall.js';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

// Initialize Lenis for smooth scrolling
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

document.addEventListener('DOMContentLoaded', () => {
  
  // Smooth Scroll for Nav Links using Lenis
  document.querySelectorAll('a.nav-link[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const targetId = this.getAttribute('href');
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        lenis.scrollTo(targetElement, {
          offset: -80, // Offset for fixed header
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

  // Hero entry animations
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
    )
    .fromTo('.mascot-container', 
      { opacity: 0, scale: 0.9, filter: 'blur(10px)' }, 
      { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 1.2, ease: 'back.out(1.2)' }, 
      1.0
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
      
      // Animate floating panels
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

      // Animate main panel in reverse
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
