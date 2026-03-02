import { describe, expect, it, vi } from 'vitest';
import { generateAdrId, generateEdgeId, generateNodeId, generateTaskId } from '../id-generator';

describe('id-generator', () => {
  it('generates IDs with expected prefixes and 8-char suffix', () => {
    const randomSpy = vi.spyOn(crypto, 'randomUUID').mockReturnValue('12345678-90ab-cdef-1234-567890abcdef');

    expect(generateTaskId()).toBe('task-12345678');
    expect(generateNodeId()).toBe('node-12345678');
    expect(generateEdgeId()).toBe('edge-12345678');
    expect(generateAdrId()).toBe('adr-12345678');

    expect(randomSpy).toHaveBeenCalledTimes(4);
    randomSpy.mockRestore();
  });
});

