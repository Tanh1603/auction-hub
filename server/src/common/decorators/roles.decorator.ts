import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../../generated';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
