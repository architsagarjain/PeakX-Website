import { describe, expect, it } from 'vitest';
import { barHeights, halfArc, heatLevel, lastPoint, linePath, ringDash, share } from '../components/ui/geometry';

describe('chart geometry (redesign step 3)', () => {
  it('clamps shares and treats a missing target as zero', () => {
    expect(share(50, 100)).toBe(0.5);
    expect(share(150, 100)).toBe(1);
    expect(share(-5, 100)).toBe(0);
    expect(share(50, 0)).toBe(0);
    expect(share(null, 100)).toBe(0);
    expect(share(50, undefined)).toBe(0);
  });
  it('draws no line for fewer than two known values', () => {
    expect(linePath([], 100, 40)).toBe('');
    expect(linePath([5], 100, 40)).toBe('');
    expect(linePath([null, 5, undefined], 100, 40)).toBe('');
    expect(lastPoint([5], 100, 40)).toBeNull();
  });
  it('scales a line into the box, skipping gaps, highest value at the top', () => {
    const d = linePath([0, null, 10], 100, 40, 0);
    expect(d).toBe('M0 40 L100 0');
    expect(lastPoint([0, null, 10], 100, 40, 0)).toEqual({ x: 100, y: 0 });
  });
  it('keeps a flat series in the middle', () => {
    expect(linePath([3, 3, 3], 100, 40, 0)).toBe('M0 20 L50 20 L100 20');
  });
  it('sizes bars against the biggest, with a floor for tiny values and zero for none', () => {
    expect(barHeights([10, 5, 0, null, 0.1], 60)).toEqual([60, 30, 0, 0, 3]);
    expect(barHeights([0, 0], 60)).toEqual([0, 0]);
    expect(barHeights([], 60)).toEqual([]);
  });
  it('fills rings and gauges to the share, clamped', () => {
    const c = 2 * Math.PI * 10;
    expect(ringDash(0.5, 10)).toBe(`${Math.round(c * 5) / 10} ${Math.round(c * 5) / 10}`);
    expect(ringDash(2, 10).split(' ')[1]).toBe('0');
    expect(halfArc(0, 50, 50, 40)).toBe('');
    expect(halfArc(1, 50, 50, 40)).toBe('M10 50 A40 40 0 0 1 90 50');
    expect(halfArc(0.5, 50, 50, 40)).toBe('M10 50 A40 40 0 0 1 50 10');
  });
  it('shades heatmap cells in four steps, empty for nothing logged', () => {
    expect(heatLevel(0, 10)).toBe(0);
    expect(heatLevel(null, 10)).toBe(0);
    expect(heatLevel(5, 0)).toBe(0);
    expect(heatLevel(1, 10)).toBe(1);
    expect(heatLevel(5, 10)).toBe(2);
    expect(heatLevel(10, 10)).toBe(4);
  });
});
