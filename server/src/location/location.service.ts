import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LocationDto } from './dto/location.dto';

@Injectable()
export class LocationService {
  constructor(private prisma: PrismaService) {}

  async findAll(): Promise<{ data: LocationDto[] }> {
    const provinces = await this.prisma.location.findMany({
      where: { parentId: null },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        value: true,
        sortOrder: true,
        children: {
          select: {
            id: true,
            name: true,
            value: true,
            sortOrder: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    return {
      data: provinces.map((p) => ({
        id: p.id,
        name: p.name,
        value: p.value,
        sortOrder: p.sortOrder,
        ward: p.children.map((c) => ({
          id: c.id,
          name: c.name,
          value: c.value,
          sortOrder: c.sortOrder,
          ward: undefined,
        })),
      })),
    };
  }
}
