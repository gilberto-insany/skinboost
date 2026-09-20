/** One disposable clock for visible, motion-enabled decorative interactions. */
export function createVisibleClock(
  element,
  onTick,
  { canRun = () => true, onMotionChange = () => {} } = {},
) {
  const events = new AbortController();
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let visible = false,
    frame = 0,
    previous = 0;
  const allowed = () =>
    visible && !document.hidden && !motion.matches && canRun();
  function tick(now) {
    frame = 0;
    if (!allowed()) return;
    onTick(now - previous);
    previous = now;
    frame = requestAnimationFrame(tick);
  }
  function sync() {
    cancelAnimationFrame(frame);
    frame = 0;
    if (allowed()) {
      previous = performance.now();
      frame = requestAnimationFrame(tick);
    }
  }
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    sync();
  });
  observer.observe(element);
  document.addEventListener("visibilitychange", sync, {
    signal: events.signal,
  });
  motion.addEventListener(
    "change",
    () => {
      onMotionChange(motion.matches);
      sync();
    },
    { signal: events.signal },
  );
  onMotionChange(motion.matches);
  return {
    sync,
    destroy() {
      events.abort();
      observer.disconnect();
      cancelAnimationFrame(frame);
    },
  };
}
