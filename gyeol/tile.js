// Arrow tile: the same swallowtail arrow and 2 mm corner hole as the physical tile.
export const ARROW_PATH = 'M50 17.5 L77.5 42.5 L62.5 42.5 L62.5 82.5 L50 72.5 L37.5 82.5 L37.5 42.5 L22.5 42.5 Z';

export function arrowSVG(dir) {
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><g style="transform: rotate(${dir * 90}deg)">
    <circle class="tile-hole" cx="86" cy="14" r="5"/>
    <path class="tile-arrow" d="${ARROW_PATH}"/>
  </g></svg>`;
}
