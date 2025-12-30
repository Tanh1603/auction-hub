import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ContractAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const contractId = request.params.id;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    if (!contractId) {
      // For list endpoints, allow all authenticated users (filtering happens in service)
      return true;
    }

    // Fetch the contract with relations
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      select: {
        propertyOwnerUserId: true,
        buyerUserId: true,
        createdBy: true,
      },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    const userId = user.sub;
    const userRole = user.role;

    // Allow admins and super_admins to bypass ownership checks
    if (userRole === 'admin' || userRole === 'super_admin') {
      return true;
    }

    const hasAccess =
      contract.propertyOwnerUserId === userId ||
      contract.buyerUserId === userId ||
      contract.createdBy === userId;

    if (!hasAccess) {
      throw new ForbiddenException(
        'You do not have permission to access this contract'
      );
    }

    return true;
  }
}
