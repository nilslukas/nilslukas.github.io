(() => {
  'use strict';

  const controls = document.querySelector('.controls');
  if (!controls) return;

  const edgeWidth = 12;
  const travelGrace = 18;
  const style = document.createElement('style');
  style.dataset.controlsSafety = '1';
  style.textContent = `
    .controls{pointer-events:none}
    .controls[data-controls-visible="1"],.controls:focus-within{opacity:1;pointer-events:auto}
  `;
  document.head.appendChild(style);

  const show = () => controls.setAttribute('data-controls-visible', '1');
  const hide = () => {
    if (!controls.matches(':focus-within')) controls.removeAttribute('data-controls-visible');
  };
  const inside = (x, y, rect, padding = 0) =>
    x >= rect.left - padding && x <= rect.right + padding &&
    y >= rect.top - padding && y <= rect.bottom + padding;
  const inActivationStrip = (x, y, rect) =>
    x >= innerWidth - edgeWidth &&
    y >= rect.top - travelGrace && y <= rect.bottom + travelGrace;

  const updateForPointer = (event) => {
    const rect = controls.getBoundingClientRect();
    const activated = inActivationStrip(event.clientX, event.clientY, rect);
    const travelling = controls.hasAttribute('data-controls-visible') &&
      inside(event.clientX, event.clientY, rect, travelGrace);
    if (activated || travelling) show();
    else hide();
  };

  addEventListener('pointermove', updateForPointer, { passive: true });
  addEventListener('pointerdown', updateForPointer, { capture: true, passive: true });
  addEventListener('blur', hide);
  controls.addEventListener('focusin', show);
  controls.addEventListener('focusout', () => requestAnimationFrame(hide));
})();
