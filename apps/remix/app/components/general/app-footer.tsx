import { Trans } from '@lingui/react/macro';

export const SOURCE_CODE_URL = 'https://github.com/hillmarkets/documenso';

/**
 * The AGPL notice. Hill Sign is a modified Documenso served over a network, so
 * AGPL-3.0 section 13 requires offering its users the source; this line is that
 * offer, and credits Documenso's copyright. Keep it on every signed-in page.
 */
export const AppFooter = () => {
  return (
    <footer className="mx-auto w-full max-w-screen-xl px-4 pb-6 text-center text-muted-foreground text-xs md:px-8">
      <Trans>
        Hill Sign is based on Documenso, © Documenso, Inc., licensed under AGPL-3.0.{' '}
        <a href={SOURCE_CODE_URL} target="_blank" rel="noreferrer" className="underline hover:text-foreground">
          Source code
        </a>
      </Trans>
    </footer>
  );
};
