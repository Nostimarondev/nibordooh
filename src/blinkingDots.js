export function initBlinkingDots(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  // Config
  const DOT_COLOR = [204, 255, 0]; // Lime green
  const DOT_COUNT = 1580;
  const MAX_OPACITY = 0.25;  // Subtle - more transparent
  const MIN_OPACITY = 0.02;
  const BLINK_SPEED_MIN = 0.003;
  const BLINK_SPEED_MAX = 0.010;
  const MAX_DRIFT_SPEED = 0.18; // Very slow drift

  let dots = [];
  let width = 0;
  let height = 0;
  let animFrameId = null;

  const resize = () => {
    const rect = canvas.parentElement.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    canvas.width = width;
    canvas.height = height;
    buildDots();
  };

  const buildDots = () => {
    dots = [];
    for (let i = 0; i < DOT_COUNT; i++) {
      // z: 0 = very far (small, slow, dim), 1 = very close (large, fast, bright)
      const z = Math.random();

      // Speed inversely proportional to depth (far dots move slower)
      const speed = 0.02 + z * MAX_DRIFT_SPEED;

      // Random drift direction
      const angle = Math.random() * Math.PI * 2;

      // Blink phase offset so they don't all pulse together
      const phase = Math.random() * Math.PI * 2;
      const blinkSpeed = BLINK_SPEED_MIN + Math.random() * (BLINK_SPEED_MAX - BLINK_SPEED_MIN);

      // Radius based on depth (far = tiny, close = slightly bigger)
      const radius = 0.5 + z * 1.8;

      // Max opacity based on depth (far = more dim, close = slightly brighter)
      const maxOp = MIN_OPACITY + z * MAX_OPACITY;

      dots.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        z,
        radius,
        phase,
        blinkSpeed,
        maxOp,
        opacity: Math.random() * maxOp,
      });
    }
  };

  const draw = () => {
    ctx.clearRect(0, 0, width, height);

    for (const dot of dots) {
      // Drift position
      dot.x += dot.vx;
      dot.y += dot.vy;

      // Wrap around edges smoothly
      if (dot.x < -5) dot.x = width + 5;
      if (dot.x > width + 5) dot.x = -5;
      if (dot.y < -5) dot.y = height + 5;
      if (dot.y > height + 5) dot.y = -5;

      // Blink (sinusoidal)
      dot.phase += dot.blinkSpeed;
      dot.opacity = MIN_OPACITY + ((Math.sin(dot.phase) + 1) / 2) * (dot.maxOp - MIN_OPACITY);

      ctx.beginPath();
      ctx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${DOT_COLOR[0]}, ${DOT_COLOR[1]}, ${DOT_COLOR[2]}, ${dot.opacity})`;
      ctx.fill();
    }

    animFrameId = requestAnimationFrame(draw);
  };

  // Init
  resize();
  draw();

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas.parentElement);

  // Cleanup
  return () => {
    cancelAnimationFrame(animFrameId);
    resizeObserver.disconnect();
  };
}
