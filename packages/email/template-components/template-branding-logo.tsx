import { getBrandingLogoBox } from '@documenso/lib/utils/branding-logo-size';

import { Img, Link } from '../components';
import { useBranding } from '../providers/branding';
import { getEmailAssetUrl } from '../utils/asset-url';
import { getSafeBrandingUrl } from '../utils/branding-url';

export type TemplateBrandingLogoProps = {
  assetBaseUrl: string;
  /** Spacing around the logo. The logo sizes itself; never pass a height here. */
  className?: string;
};

/** `static/logo.png` is 374×55; this is it at the 24px it has always rendered at. */
const DOCUMENSO_LOGO_BOX = { width: 163, height: 24 };

/**
 * Renders the email logo.
 *
 * - When custom branding is enabled with a logo, the branding logo is shown,
 *   sized by its shape through `getBrandingLogoBox('email', …)`.
 *   If a safe (http/https) Brand Website is configured, the logo links to it.
 * - Otherwise the Documenso logo is shown.
 *
 * Sizes are integer `width`/`height` attributes plus inline px styles. A class
 * or a rem height is dropped by enough mail clients that the image then shows
 * at its natural size (up to 512px), which is how a logo filled the card.
 */
export const TemplateBrandingLogo = ({ assetBaseUrl, className = 'mb-4' }: TemplateBrandingLogoProps) => {
  const branding = useBranding();

  const hasCustomBrandingLogo = branding.brandingEnabled && Boolean(branding.brandingLogo);

  if (!hasCustomBrandingLogo) {
    const documensoLogoUrl = getEmailAssetUrl(assetBaseUrl, 'static/logo.png');

    return (
      <Img
        src={documensoLogoUrl}
        alt="Documenso Logo"
        width={DOCUMENSO_LOGO_BOX.width}
        height={DOCUMENSO_LOGO_BOX.height}
        style={toPixelStyle(DOCUMENSO_LOGO_BOX)}
        className={className}
      />
    );
  }

  const box = getBrandingLogoBox('email', branding.brandingLogoDimensions ?? null);

  // Mail clients apply their own dark-mode transforms and we cannot detect them
  // server-side, so the custom logo sits on a fixed white plate. Inline styles
  // because email clients ignore stylesheets.
  const brandingLogo = (
    <span
      className={className}
      style={{ display: 'inline-block', backgroundColor: '#ffffff', padding: '8px 12px', borderRadius: '6px' }}
    >
      <Img
        src={branding.brandingLogo}
        alt="Branding Logo"
        width={box.width}
        height={box.height}
        style={toPixelStyle(box)}
      />
    </span>
  );

  const safeBrandingUrl = getSafeBrandingUrl(branding.brandingUrl);

  if (!safeBrandingUrl) {
    return brandingLogo;
  }

  return (
    <Link href={safeBrandingUrl} target="_blank">
      {brandingLogo}
    </Link>
  );
};

const toPixelStyle = ({ width, height }: { width: number; height: number }) => ({
  width: `${width}px`,
  height: `${height}px`,
});

export default TemplateBrandingLogo;
