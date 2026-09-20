import { Img, Link } from '../components';
import { useBranding } from '../providers/branding';
import { getEmailAssetUrl } from '../utils/asset-url';
import { getSafeBrandingUrl } from '../utils/branding-url';

export type TemplateBrandingLogoProps = {
  assetBaseUrl: string;
  className?: string;
};

/**
 * Renders the email logo.
 *
 * - When custom branding is enabled with a logo, the branding logo is shown.
 *   If a safe (http/https) Brand Website is configured, the logo links to it.
 * - Otherwise the Documenso logo is shown.
 */
export const TemplateBrandingLogo = ({ assetBaseUrl, className = 'mb-4 h-6' }: TemplateBrandingLogoProps) => {
  const branding = useBranding();

  const hasCustomBrandingLogo = branding.brandingEnabled && Boolean(branding.brandingLogo);

  if (!hasCustomBrandingLogo) {
    const documensoLogoUrl = getEmailAssetUrl(assetBaseUrl, 'static/logo.png');

    return <Img src={documensoLogoUrl} alt="Documenso Logo" className={className} />;
  }

  // Mail clients apply their own dark-mode transforms and we cannot detect them
  // server-side, so the custom logo sits on a fixed white plate. Inline styles
  // because email clients ignore stylesheets.
  const brandingLogo = (
    <span style={{ display: 'inline-block', backgroundColor: '#ffffff', padding: '8px 12px', borderRadius: '6px' }}>
      <Img src={branding.brandingLogo} alt="Branding Logo" className={className} />
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

export default TemplateBrandingLogo;
