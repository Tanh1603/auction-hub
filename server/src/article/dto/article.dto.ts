import { ArticleType } from '../../../generated';

export class ArticleDto {
  id: string;
  title: string;
  author: string;
  content: string;
  image: unknown;
  type: ArticleType;
  createdAt: Date;
  relatedArticles: ArticleDto[];
}
