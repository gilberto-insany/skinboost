/** One disposable clock for visible, motion-enabled decorative interactions. */
export function createVisibleClock(
  element,
  onTick,
  { canRun = () => true, onMotionChange = () => {}, interval = 0 } = {},
) {
  const events = new AbortController();
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let visible = false,
    disposed = false,
    frame = 0,
    previous = 0;
  const allowed = () =>
    !disposed && visible && !document.hidden && !motion.matches && canRun();
  const schedule = () =>
    interval
      ? setTimeout(() => tick(performance.now()), interval)
      : requestAnimationFrame(tick);
  const cancel = () =>
    interval ? clearTimeout(frame) : cancelAnimationFrame(frame);
  function tick(now) {
    frame = 0;
    if (!allowed()) return;
    onTick(now - previous);
    previous = now;
    if (allowed()) frame = schedule();
  }
  function sync() {
    cancel();
    frame = 0;
    if (allowed()) {
      previous = performance.now();
      frame = schedule();
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
      disposed = true;
      events.abort();
      observer.disconnect();
      cancel();
    },
  };
}
