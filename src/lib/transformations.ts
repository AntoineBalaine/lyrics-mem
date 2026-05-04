import { textVide } from 'text-vide';

export type Step = 1 | 2 | 3 | 4 | 5;

export const STEPS: readonly Step[] = [1, 2, 3, 4, 5] as const;

export const HTML_STEPS: ReadonlySet<Step> = new Set([2]);

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function step1Full(text: string): string {
  return text;
}

export function step2Bionic(text: string): string {
  return textVide(escapeHtml(text));
}

export function step3BionicStripped(text: string): string {
  return text
    .split('\n')
    .map((line) =>
      line
        .split(/(\s+)/)
        .map((token) => {
          if (token.length === 0 || /^\s+$/.test(token)) return token;
          const boldLen = bionicBoldLength(token);
          return token.slice(0, boldLen) + '_'.repeat(token.length - boldLen);
        })
        .join(''),
    )
    .join('\n');
}

export function step4FirstLetters(text: string): string {
  return text
    .split('\n')
    .map((line) =>
      line
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => w[0] ?? '')
        .join(' '),
    )
    .join('\n');
}

export function step5FirstLineLetters(text: string): string {
  return text
    .split('\n')
    .map((line) => line.trim()[0] ?? '')
    .join('\n');
}

export function applyStep(step: Step, text: string): string {
  switch (step) {
    case 1:
      return step1Full(text);
    case 2:
      return step2Bionic(text);
    case 3:
      return step3BionicStripped(text);
    case 4:
      return step4FirstLetters(text);
    case 5:
      return step5FirstLineLetters(text);
  }
}

function bionicBoldLength(word: string): number {
  const len = word.replace(/[^\p{L}\p{N}]/gu, '').length;
  if (len <= 0) return 0;
  if (len <= 3) return 1;
  return Math.ceil(len / 2);
}
