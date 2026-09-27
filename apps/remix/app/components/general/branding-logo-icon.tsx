import type { SVGAttributes } from 'react';

export type LogoProps = SVGAttributes<SVGSVGElement>;

/**
 * The Hill mark on its own, for spaces too narrow for the wordmark. Same
 * source and `currentColor` rule as `BrandingLogo`.
 */
export const BrandingLogoIcon = ({ ...props }: LogoProps) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 3 200 200" role="img" aria-label="Hill Sign" {...props}>
      <path fill="currentColor" d="M190 3H200V191C200 197.627 194.627 203 188 203H0V193C140 189 186 143 190 3Z" />
    </svg>
  );
};
