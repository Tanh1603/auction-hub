import { PaginationQueryDto } from '../dto/pagination-query.dto';

export function getPaginationOptions(query: PaginationQueryDto) {
  const {
    page = 1,
    limit = 10,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = query;

  return {
    skip: (page - 1) * limit,
    take: limit,
    orderBy: { [sortBy]: sortOrder },
  };
}
