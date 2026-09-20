import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger);

/** Real landing motion, scoped and disposable for app or component preview. */
export function initMotion({ root = document } = {}) {
  const $ = (selector) => root.querySelector(selector);
  const scope = root === document ? document.body : root;
  const media = gsap.matchMedia(scope);
  const events = new AbortController();
  let disposed = false;
  let bottleCleanup;
  const refresh = () => {
    if (!disposed) ScrollTrigger.refresh();
  };
  media.add("(prefers-reduced-motion: no-preference)", () => {
    const film = $(".film-section");
    const toggle = $(".film-toggle");
    let filmTween;
    let pauseFilm;
    const video = film?.querySelector(".film-video");
    let progress = 0;
    let paused = false;
    // Coalesce scroll updates while the decoder finishes the previous seek.
    const seek = () => {
      if (
        paused ||
        !video ||
        video.readyState < 1 ||
        video.seeking ||
        !Number.isFinite(video.duration)
      )
        return;
      const time = progress * Math.max(0, video.duration - 0.05);
      if (Math.abs(video.currentTime - time) > 0.025) video.currentTime = time;
    };
    video?.addEventListener("loadedmetadata", seek);
    video?.addEventListener("seeked", seek);
    if (film) {
      filmTween = gsap.fromTo(
        film.querySelectorAll(".film-copy h2 span"),
        { opacity: 0.38 },
        {
          opacity: 1,
          stagger: 0.25,
          ease: "none",
          scrollTrigger: {
            trigger: film,
            start: "top top",
            end: "bottom bottom",
            scrub: true,
          },
        },
      );
      const syncFilm = (self) => {
        progress = self.progress;
        if (paused) return;
        const track = $(".film-track span");
        if (track) track.style.transform = `scaleX(${progress})`;
        const percent = Math.round(progress * 100);
        $(".film-track")?.setAttribute("aria-valuenow", String(percent));
        const value = $(".film-progress-value");
        if (value) value.textContent = `${percent}%`;
        seek();
      };
      ScrollTrigger.create({
        trigger: film,
        start: "top top",
        end: "bottom bottom",
        onUpdate: syncFilm,
        onRefresh: syncFilm,
      });
      pauseFilm = () => {
        paused = toggle.getAttribute("aria-pressed") !== "true";
        toggle.setAttribute("aria-pressed", String(paused));
        toggle.querySelector("span").textContent = paused
          ? "Retomar movimento"
          : "Pausar movimento";
        toggle.querySelector("i").className = paused
          ? "ph ph-play"
          : "ph ph-pause";
        if (paused) {
          filmTween.scrollTrigger.disable(false);
          video?.pause();
        } else {
          filmTween.scrollTrigger.enable();
          refresh();
          seek();
        }
      };
      toggle?.addEventListener("click", pauseFilm);
    }
    const tags = [...root.querySelectorAll(".context-tags span")].reverse();
    if (tags.length)
      gsap.from(tags, {
        y: -125,
        rotation: (index) => (index % 2 ? -14 : 14),
        opacity: 0,
        duration: 0.7,
        stagger: 0.16,
        ease: "bounce.out",
        scrollTrigger: {
          trigger: $(".context-tags"),
          start: "top 88%",
          toggleActions: "play none none reset",
        },
      });
    return () => {
      if (pauseFilm) toggle?.removeEventListener("click", pauseFilm);
      video?.removeEventListener("loadedmetadata", seek);
      video?.removeEventListener("seeked", seek);
      video?.pause();
    };
  });
  media.add("(prefers-reduced-motion: reduce)", () => {
    const toggle = $(".film-toggle");
    if (toggle) toggle.hidden = true;
    return () => {
      if (toggle) toggle.hidden = false;
    };
  });
  window.addEventListener("load", refresh, { signal: events.signal });
  document.fonts.ready.then(refresh);
  const bottleObserver = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      bottleObserver.disconnect();
      import("../bottle.js")
        .then((module) => {
          if (!disposed)
            return module.initBottle({ root, signal: events.signal });
        })
        .then((cleanup) => {
          bottleCleanup = cleanup;
          if (disposed) bottleCleanup?.();
        })
        .catch((error) => {
          if (disposed) return;
          console.warn("Could not initialize the product preview.", error);
          const fallback = $("#bottle-fallback");
          if (fallback) fallback.hidden = false;
        });
    },
    { rootMargin: "800px" },
  );
  const product = $("#produtos");
  if (product) bottleObserver.observe(product);
  function destroy() {
    if (disposed) return;
    disposed = true;
    events.abort();
    media.revert();
    bottleObserver.disconnect();
    bottleCleanup?.();
  }
  window.addEventListener(
    "pagehide",
    (event) => {
      if (!event.persisted) destroy();
    },
    { signal: events.signal },
  );
  return { destroy };
}
