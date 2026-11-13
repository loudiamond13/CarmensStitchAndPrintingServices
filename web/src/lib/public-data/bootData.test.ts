// The boot block reader (D-42): parses `#csps-boot` once, and never throws on a missing or damaged block.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { demoSite, putBootBlock, resetPublicData } from '@/test/publicFixtures';
import { readBootData } from './bootData';

afterEach(() => {
  resetPublicData();
});

describe('readBootData', () => {
  it('returns the part of the block named by the key', () => {
    putBootBlock(demoSite);

    expect(readBootData('site')).toEqual(demoSite);
  });

  it('reads the document only once, so a later change to the block is not seen', () => {
    putBootBlock(demoSite);
    const lookup = vi.spyOn(document, 'getElementById');

    expect(readBootData('site')).toEqual(demoSite);
    document.getElementById('csps-boot')?.remove();
    lookup.mockClear();

    expect(readBootData('site')).toEqual(demoSite);
    expect(lookup).not.toHaveBeenCalled();
  });

  it('reads the document only once when there is no block or a damaged one', () => {
    const lookup = vi.spyOn(document, 'getElementById');

    expect(readBootData('site')).toBeUndefined();
    expect(readBootData('home')).toBeUndefined();
    expect(lookup).toHaveBeenCalledTimes(1);

    resetPublicData();
    const block = document.createElement('script');
    block.type = 'application/json';
    block.id = 'csps-boot';
    block.textContent = '{"site": {';
    document.head.append(block);
    lookup.mockClear();

    expect(readBootData('site')).toBeUndefined();
    expect(readBootData('home')).toBeUndefined();
    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it('returns undefined when the page has no block', () => {
    expect(readBootData('site')).toBeUndefined();
  });

  it('returns undefined when the block is not valid JSON', () => {
    const block = document.createElement('script');
    block.type = 'application/json';
    block.id = 'csps-boot';
    block.textContent = '{"site": {';
    document.head.append(block);

    expect(readBootData('site')).toBeUndefined();
  });

  it('returns undefined when the block holds no such part, or is not an object', () => {
    const block = document.createElement('script');
    block.type = 'application/json';
    block.id = 'csps-boot';
    block.textContent = '{"home":{}}';
    document.head.append(block);

    expect(readBootData('site')).toBeUndefined();
    resetPublicData();
    block.textContent = '[1,2]';
    document.head.append(block);
    expect(readBootData('site')).toBeUndefined();
  });
});
