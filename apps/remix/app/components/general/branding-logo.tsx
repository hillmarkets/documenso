import type { SVGAttributes } from 'react';

export type LogoProps = SVGAttributes<SVGSVGElement>;

/**
 * The Hill wordmark (mark plus "Hill"), from hill.com's brand assets
 * (hillmarkets/hill apps/marketing-site/public/site-assets/brand). Drawn in
 * `currentColor`, so it follows the text colour and needs no dark variant.
 */
export const BrandingLogo = ({ ...props }: LogoProps) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 601 204" role="img" aria-label="Hill Sign" {...props}>
      <g fill="currentColor">
        <path d="M449 59.2906H479V204H449V59.2906Z" />
        <path d="M510 3.01478H540V204H510V3.01478Z" />
        <path d="M571 3.01478H601V204H571V3.01478Z" />
        <path d="M260 3.01478H290V87.4287H388V3.01478H418V204H388V113.557H290V204H260V3.01478Z" />
        <path d="M481 17.0837C481 26.5188 473.389 34.1675 464 34.1675C454.611 34.1675 447 26.5188 447 17.0837C447 7.64865 454.611 0 464 0C473.389 0 481 7.64865 481 17.0837Z" />
        <path d="M190 3H200V191C200 197.627 194.627 203 188 203H0V193C140 189 186 143 190 3Z" />
      </g>
    </svg>
  );
};
