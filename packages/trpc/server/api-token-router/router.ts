import { router } from '../trpc';
import { createApiTokenRoute } from './create-api-token';
import { deleteApiTokenRoute } from './delete-api-token';
import { getApiTokensRoute } from './get-api-tokens';
import { createInstanceApiTokenRoute } from './instance/create-instance-api-token';
import { deleteInstanceApiTokenRoute } from './instance/delete-instance-api-token';
import { findInstanceApiTokensRoute } from './instance/find-instance-api-tokens';
import { createOrganisationApiTokenRoute } from './organisation/create-organisation-api-token';
import { deleteOrganisationApiTokenRoute } from './organisation/delete-organisation-api-token';
import { findOrganisationApiTokensRoute } from './organisation/find-organisation-api-tokens';

export const apiTokenRouter = router({
  create: createApiTokenRoute,
  getMany: getApiTokensRoute,
  delete: deleteApiTokenRoute,
  organisation: {
    create: createOrganisationApiTokenRoute,
    find: findOrganisationApiTokensRoute,
    delete: deleteOrganisationApiTokenRoute,
  },
  instance: {
    create: createInstanceApiTokenRoute,
    find: findInstanceApiTokensRoute,
    delete: deleteInstanceApiTokenRoute,
  },
});
