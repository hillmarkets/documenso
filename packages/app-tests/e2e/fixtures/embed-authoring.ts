import { prisma } from '@documenso/prisma';

/**
 * Turn on the `embedAuthoring` claim flag for a team's organisation. Minting an
 * embedding presign token always requires it, and no real organisation has it, so
 * tests that exercise embedded authoring grant it to their seeded organisation.
 */
export const grantEmbedAuthoring = async (teamId: number) => {
  const team = await prisma.team.findUniqueOrThrow({
    where: { id: teamId },
    include: { organisation: { include: { organisationClaim: true } } },
  });

  const claim = team.organisation.organisationClaim;

  await prisma.organisationClaim.update({
    where: { id: claim.id },
    data: { flags: { ...(claim.flags as Record<string, unknown>), embedAuthoring: true } },
  });
};
