import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseFilePipeBuilder,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Render,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthExceptionFilter } from 'src/auth/filters';
import { AuthenticatedGuard } from 'src/auth/guard';
import { AuthorService } from 'src/author/author.service';
import { CategoryService } from 'src/category/category.service';
import { DEFAULT_BOOK_PAGE_SIZE } from 'src/constants/app';
import { FILE_TYPES_REGEX } from 'src/constants/image';
import { PromotionListService } from 'src/promotion-list/promotion-list.service';
import { RatingReviewsPageOptionsDto } from 'src/rating-review/dto';
import { formatCurrency, toDateTime } from 'src/utils';
import { BookService } from './book.service';
import {
  AddAuthorsToBookDto,
  AddCategoriesToBookDto,
  AddPromoListToBookDto,
  BooksPageOptionsDto,
  CreateBookDto,
  UpdateBookDto,
} from './dto';

@Controller('/books')
@UseFilters(AuthExceptionFilter)
export class BookViewController {
  constructor(
    private readonly bookService: BookService,
    private readonly categoryService: CategoryService,
    private readonly authorService: AuthorService,
    private readonly promotionListService: PromotionListService,
  ) {}

  @UseGuards(AuthenticatedGuard)
  @Post()
  @UseInterceptors(FileInterceptor('image'))
  async createBook(
    @Body() dto: CreateBookDto,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: FILE_TYPES_REGEX,
        })
        .build({
          fileIsRequired: false,
        }),
    )
    image?: Express.Multer.File,
  ) {
    return await this.bookService.createBook(dto, image);
  }

  @UseGuards(AuthenticatedGuard)
  @Get()
  @Render('books/list')
  async getBooksPage(@Query() dto: BooksPageOptionsDto) {
    dto.page = dto.page || 1;
    dto.take = dto.take || DEFAULT_BOOK_PAGE_SIZE;

    const res = await this.bookService.getBooks(dto);

    const categories = await this.categoryService.getAllCategories();
    const authors = await this.authorService.getAllAuthors();

    const result = {
      ...res,
      data: res.data.map((book) => {
        return {
          ...book,
          createdAt: toDateTime(book.createdAt),
          updatedAt: toDateTime(book.updatedAt),
          price: formatCurrency(book.price),
          finalPrice: formatCurrency(book.finalPrice),
        };
      }),
      categories,
      authors,
    };

    return {
      ...result,
      currentPage: dto.page,
    };
  }

  @UseGuards(AuthenticatedGuard)
  @Get(':id')
  @Render('books/detail')
  async getBookDetailPage(
    @Param('id', ParseIntPipe) id: number,
    @Query() reviewsDto: RatingReviewsPageOptionsDto,
  ) {
    reviewsDto.page = reviewsDto.page || 1;
    reviewsDto.take = reviewsDto.take || DEFAULT_BOOK_PAGE_SIZE;

    const book = await this.bookService.getBookById(id, reviewsDto);

    let promos = [];
    if (!book.promotionListId) {
      promos = (await this.promotionListService.getAllPromotionLists()).map(
        (promo) => ({
          id: promo.id,
          name: promo.name + ' - ' + promo.discountPercentage + '%',
        }),
      );
    }

    const authorsNotInBook = await this.authorService.getAuthorsNotInBook(id);

    const categoriesNotInBook =
      await this.categoryService.getCategoriesNotInBook(id);

    return {
      ...book,
      createdAt: toDateTime(book.createdAt),
      updatedAt: toDateTime(book.updatedAt),
      price: formatCurrency(book.price),
      finalPrice: formatCurrency(book.finalPrice),
      discountDate: toDateTime(book.discountDate),
      ratingReviews: {
        ...book.ratingReviews,
        data: book.ratingReviews.data.map((ratingReview) => {
          return {
            ...ratingReview,
            createdAt: toDateTime(ratingReview.createdAt),
          };
        }),
        currentPage: reviewsDto.page || 1,
      },
      promos,
      authorsNotInBook,
      categoriesNotInBook,
    };
  }

  @UseGuards(AuthenticatedGuard)
  @Get(':id/edit')
  @Render('books/edit')
  async getEditBookDetailPage(@Param('id', ParseIntPipe) id: number) {
    return await this.bookService.getBookByIdForAdmin(id);
  }

  @UseGuards(AuthenticatedGuard)
  @Patch(':id')
  @UseInterceptors(FileInterceptor('image'))
  async updateBook(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBookDto,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: FILE_TYPES_REGEX,
        })
        .build({
          fileIsRequired: false,
        }),
    )
    image?: Express.Multer.File,
  ) {
    return await this.bookService.updateBook(id, dto, image);
  }

  @UseGuards(AuthenticatedGuard)
  @Delete(':id')
  async deleteBook(@Param('id', ParseIntPipe) id: number) {
    return await this.bookService.deleteBook(id);
  }

  @UseGuards(AuthenticatedGuard)
  @Post(':id/authors')
  async addAuthorsToBook(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddAuthorsToBookDto,
  ) {
    return await this.bookService.addAuthorsToBook(id, dto);
  }

  @UseGuards(AuthenticatedGuard)
  @Post(':id/categories')
  async addCategoriesToBook(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddCategoriesToBookDto,
  ) {
    return await this.bookService.addCategoriesToBook(id, dto);
  }

  @UseGuards(AuthenticatedGuard)
  @Post(':id/promotion-lists')
  async addPromoListToBook(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddPromoListToBookDto,
  ) {
    return await this.bookService.addPromoListToBook(id, dto);
  }
}
