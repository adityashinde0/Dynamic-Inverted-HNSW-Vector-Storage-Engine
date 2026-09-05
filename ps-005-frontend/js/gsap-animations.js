/**
 * gsap-animations.js
 * -------------------------------------------------------------
 * Two deliberate motion moments only:
 *
 * 1. Load sequence: the title-block stamps in, then the hero
 *    diagram plate draws its frame on load (one orchestrated
 *    reveal, not per-element fades).
 *
 * 2. Scroll-driven progression through the write/read-path
 *    stage list in the architecture section — the numbered
 *    steps highlight in sequence as the section is in view,
 *    because the content genuinely is a sequence (WAL ->
 *    MemTable -> Segment -> Merge -> Query).
 *
 * No hover-triggered card fades, no per-card entrance stagger.
 * -------------------------------------------------------------
 */
export function runLoadSequence() {
  if (!window.gsap) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return;

  const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });

  tl.from('.hero__top .stamp div', {
    opacity: 0,
    duration: 0.5,
    stagger: 0.06,
  })
  .from('.hero__kicker', { opacity: 0, y: 6, duration: 0.4 }, '-=0.2')
  .from('h1.hero__title-line', { opacity: 0, y: 14, duration: 0.6 }, '-=0.2')
  .from('.hero__sub', { opacity: 0, y: 10, duration: 0.5 }, '-=0.35')
  .from('.hero__actions .btn', { opacity: 0, y: 8, duration: 0.4, stagger: 0.08 }, '-=0.25')
  .from('.pipeline-plate', { opacity: 0, duration: 0.6 }, '-=0.3');
}

export function runStageScroll() {
  if (!window.gsap || !window.ScrollTrigger) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stages = gsap.utils.toArray('.stage-item');
  if (!stages.length) return;

  if (reduceMotion) {
    stages.forEach(s => s.classList.add('is-active'));
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  stages.forEach((stage) => {
    ScrollTrigger.create({
      trigger: stage,
      start: 'top center',
      end: 'bottom center',
      onEnter: () => stage.classList.add('is-active'),
      onEnterBack: () => stage.classList.add('is-active'),
    });
  });
}
