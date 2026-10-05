import { ABCContext, layoutChart, parseGrid, parseIrealKey, scanGrid } from 'abcls-parser';
import { renderGridHtml, renderGridText } from './chord-grid-render';
const strip = (h: string) => h.replace(/<\/?(div|span)[^>]*>/g, '').replace(/<\/?sup>/g, '');
for (const grid of ['Ch7 ', 'C-7b5 ', 'Eh7 ', 'C-9b5 ']) {
  const ctx = new ABCContext();
  const l = layoutChart(parseGrid(scanGrid(grid, ctx), ctx));
  for (const level of [1, 2] as const) {
    const o = { mode: 'symbols' as const, key: parseIrealKey('C'), level };
    console.log(`${grid.trim().padEnd(8)} L${level} symbols  html=${JSON.stringify(strip(renderGridHtml(l, o)))}  text=${JSON.stringify(renderGridText(l, o))}`);
    const n = { mode: 'numbers' as const, key: parseIrealKey('C'), level };
    console.log(`${grid.trim().padEnd(8)} L${level} numbers  html=${JSON.stringify(strip(renderGridHtml(l, n)))}`);
  }
}
