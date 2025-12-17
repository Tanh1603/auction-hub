import { ArticleType } from '../../../generated';

export class ArticleDto {
  id: string;
  title: string;
  description: string;
  author: string;
  content: string;
  image: unknown;
  type: ArticleType;
  createdAt: Date;
  relatedArticles: {
    id: string;
    title: string;
    description: string;
    author: string;
    image: unknown;
    type: ArticleType;
    createdAt: Date;
  }[];
}
