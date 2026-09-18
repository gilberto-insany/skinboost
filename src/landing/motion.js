import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { $ } from "../ui/dom.js";
gsap.registerPlugin(ScrollTrigger);
export function initMotion() {
  const mm = gsap.matchMedia();
  mm.add("(prefers-reduced-motion: no-preference)", () => {
    gsap.fromTo(
      ".film-copy h2 span",
      { opacity: 0.38 },
      {
        opacity: 1,
        stagger: 0.25,
        ease: "none",
        scrollTrigger: {
          trigger: ".film-section",
          start: "top top",
          end: "bottom bottom",
          scrub: true,
        },
      },
    );
    ScrollTrigger.create({
      trigger: ".film-section",
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => {
        $(".film-track span").style.transform = `scaleX(${self.progress})`;
      },
    });
    const tags = gsap.utils.toArray(".context-tags span").reverse();
    gsap.from(tags, {
      y: -125,
      rotation: (index) => (index % 2 ? -14 : 14),
      opacity: 0,
      duration: 0.7,
      stagger: 0.16,
      ease: "bounce.out",
      scrollTrigger: {
        trigger: ".context-tags",
        start: "top 88%",
        toggleActions: "play none none reset",
      },
    });
  });
  window.addEventListener("load", () => ScrollTrigger.refresh());
  document.fonts.ready.then(() => ScrollTrigger.refresh());
  const bottleObserver = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        import("../bottle.js")
          .then((m) => m.initBottle())
          .catch((error) => {
            console.warn("Could not initialize the product preview.", error);
            $("#bottle-fallback").hidden = false;
          });
        bottleObserver.disconnect();
      }
    },
    { rootMargin: "800px" },
  );
  bottleObserver.observe($("#produtos"));

  window.addEventListener("pagehide", (event) => {
    if (!event.persisted) {
      mm.revert();
      bottleObserver.disconnect();
    }
  });
}
