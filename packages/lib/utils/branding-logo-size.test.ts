import { describe, expect, it } from 'vitest';

import { getBrandingLogoBox, getBrandingLogoDimensions } from './branding-logo-size';

const logo = (width: number, height: number) => ({ width, height });

describe('getBrandingLogoDimensions', () => {
  it('reads the dimensions recorded in a reference', () => {
    const reference = JSON.stringify({ type: 'S3_PATH', data: 'key', width: 512, height: 174 });

    expect(getBrandingLogoDimensions(reference)).toEqual({ width: 512, height: 174 });
  });

  it('returns null for a reference stored before dimensions were recorded', () => {
    expect(getBrandingLogoDimensions(JSON.stringify({ type: 'S3_PATH', data: 'key' }))).toBeNull();
  });

  it('returns null for empty, malformed or nonsensical references', () => {
    expect(getBrandingLogoDimensions('')).toBeNull();
    expect(getBrandingLogoDimensions(null)).toBeNull();
    expect(getBrandingLogoDimensions('not json')).toBeNull();
    expect(getBrandingLogoDimensions(JSON.stringify({ width: 0, height: 10 }))).toBeNull();
    expect(getBrandingLogoDimensions(JSON.stringify({ width: '512', height: 174 }))).toBeNull();
  });
});

describe('getBrandingLogoBox', () => {
  it('sizes by area, so the Hill lockup is neither huge nor tiny', () => {
    expect(getBrandingLogoBox('email', logo(512, 174))).toEqual({ width: 86, height: 29 });
    expect(getBrandingLogoBox('signer-header', logo(512, 174))).toEqual({ width: 59, height: 20 });
    expect(getBrandingLogoBox('signing-page', logo(512, 174))).toEqual({ width: 94, height: 32 });
  });

  it('caps a square mark at the surface height', () => {
    expect(getBrandingLogoBox('email', logo(400, 400))).toEqual({ width: 48, height: 48 });
    expect(getBrandingLogoBox('signer-header', logo(400, 400))).toEqual({ width: 24, height: 24 });
  });

  it('caps a tall logo at the surface height', () => {
    expect(getBrandingLogoBox('email', logo(300, 500))).toEqual({ width: 29, height: 48 });
  });

  it('holds a long wordmark at the legibility floor', () => {
    expect(getBrandingLogoBox('email', logo(512, 64))).toEqual({ width: 160, height: 20 });
    expect(getBrandingLogoBox('signer-header', logo(512, 64))).toEqual({ width: 128, height: 16 });
  });

  it('skips the floor when it would push an extreme wordmark past the width cap', () => {
    expect(getBrandingLogoBox('signer-header', logo(512, 32))).toEqual({ width: 139, height: 9 });
    expect(getBrandingLogoBox('signer-header', logo(1024, 32))).toEqual({ width: 140, height: 4 });
  });

  it('falls back to a typical lockup ratio when dimensions are unknown', () => {
    expect(getBrandingLogoBox('email', null)).toEqual({ width: 87, height: 29 });
  });
});
