import type { MindmapStyleRole } from '../../../../src/shared/types';

export const M13_COLOR_PRESETS = [
  '#1F6FEB',
  '#0F766E',
  '#2E7D32',
  '#C2410C',
  '#B45309',
  '#9D174D',
  '#6D28D9',
  '#4B5563',
] as const;

export interface MindmapStyleToken {
  borderRadius: number;
  paddingX: number;
  paddingY: number;
  borderWidth: number;
  fontWeight: 600 | 700 | 800;
}

export const MINDMAP_STYLE_TOKENS: Record<MindmapStyleRole, MindmapStyleToken> = {
  standard: {
    borderRadius: 16,
    paddingX: 16,
    paddingY: 8,
    borderWidth: 2,
    fontWeight: 700,
  },
  top: {
    borderRadius: 999,
    paddingX: 20,
    paddingY: 10,
    borderWidth: 2,
    fontWeight: 800,
  },
  helper: {
    borderRadius: 8,
    paddingX: 12,
    paddingY: 6,
    borderWidth: 1,
    fontWeight: 600,
  },
};
