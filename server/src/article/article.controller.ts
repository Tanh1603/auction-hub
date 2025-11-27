import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBadRequestResponse, ApiBody, ApiOkResponse } from '@nestjs/swagger';
import { ApiResponse, ApiResponseError } from '../common/dto/reponse.dto';
import { ArticleService } from './article.service';
import { ArticleDto } from './dto/article.dto';
import { CreateArticleDto } from './dto/create-article.dto';
import {
  UpdateArticleDto,
  UpdateArticleRelationsDto,
} from './dto/update-article.dto';
import { ArticleQueryDto } from './dto/article-query.dto';

@Controller('articles')
export class ArticleController {
  constructor(private readonly articleService: ArticleService) {}

  @Get()
  @ApiOkResponse({
    type: ApiResponse<ArticleDto[]>,
  })
  @ApiBadRequestResponse({
    description: 'Bad request',
    type: ApiResponseError,
  })
  findAll(@Query() query: ArticleQueryDto) {
    return this.articleService.findAll(query);
  }

  @Get(':id')
  @Get()
  @ApiOkResponse({
    type: ApiResponse<ArticleDto>,
  })
  @ApiBadRequestResponse({
    description: 'Bad request',
    type: ApiResponseError,
  })
  findOne(@Param('id') id: string) {
    return this.articleService.findOne(id);
  }

  @Post()
  @ApiOkResponse({
    type: ApiResponse<ArticleDto>,
  })
  @ApiBadRequestResponse({
    description: 'Bad request',
    type: ApiResponseError,
  })
  @ApiBody({
    type: CreateArticleDto,
  })
  create(@Body() createArticleDto: CreateArticleDto) {
    return this.articleService.create(createArticleDto);
  }

  @Put(':id')
  @ApiOkResponse({
    type: ApiResponse<ArticleDto>,
  })
  @ApiBadRequestResponse({
    description: 'Bad request',
    type: ApiResponseError,
  })
  @ApiBody({
    type: UpdateArticleDto,
  })
  update(@Param('id') id: string, @Body() updateArticleDto: UpdateArticleDto) {
    return this.articleService.update(id, updateArticleDto);
  }

  @Patch(':id/relations')
  @ApiOkResponse({
    type: ApiResponse<ArticleDto>,
  })
  @ApiBadRequestResponse({
    description: 'Bad request',
    type: ApiResponseError,
  })
  @ApiBody({
    type: UpdateArticleRelationsDto,
  })
  updateRelation(
    @Param('id') id: string,
    @Body() relation: UpdateArticleRelationsDto
  ) {
    return this.articleService.updateRelations(id, relation);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.articleService.remove(id);
  }
}
