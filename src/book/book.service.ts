import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import slugify from 'slugify';
import {
  DEFAULT_BOOK_IMAGE_URL,
  SpecialBook,
  sortMapping,
} from 'src/constants/app';
import { EUploadFolder } from 'src/constants/image';
import { PrismaService } from 'src/prisma/prisma.service';
import { RatingReviewsPageOptionsDto } from 'src/rating-review/dto';
import { deleteFilesFromFirebase } from 'src/services/files/delete';
import { uploadFilesFromFirebase } from 'src/services/files/upload';
import { calculateDiscountedPrice } from 'src/utils';
import {
  AddAuthorsToBookDto,
  AddCategoriesToBookDto,
  AddPromoListToBookDto,
  AddRatingReviewToBookDto,
  BooksPageOptionsDto,
  CreateBookInput,
  FindAllBooksInput,
  RatingReviewInBookPageOptionsDto,
  SpecialBooksPageOptionsDto,
  UpdateBookInput,
} from './dto';

@Injectable()
export class BookService {
  constructor(private readonly prismaService: PrismaService) {}

  async createBook(dto: CreateBookInput, image?: Express.Multer.File) {
    const hasCategory = dto.categoryIds && dto.categoryIds.length > 0;
    const hasAuthor = dto.authorIds && dto.authorIds.length > 0;

    let categoryIds = [];
    let authorIds = [];

    if (hasCategory) {
      categoryIds = dto.categoryIds.split(',').map(Number);

      // Remove duplicates
      categoryIds = [...new Set(categoryIds)];

      const categories = await this.prismaService.category.findMany({
        where: { id: { in: categoryIds } },
      });

      if (categories.length !== categoryIds.length) {
        throw new BadRequestException('Invalid category');
      }
    }

    if (hasAuthor) {
      authorIds = dto.authorIds.split(',').map(Number);

      // Remove duplicates
      authorIds = [...new Set(authorIds)];

      const authors = await this.prismaService.author.findMany({
        where: { id: { in: authorIds } },
      });

      if (authors.length !== authorIds.length) {
        throw new BadRequestException('Invalid author');
      }
    }

    const price = Number(dto.price);
    if (isNaN(price)) {
      throw new BadRequestException('Price must be a number!');
    }

    let imageUrls = [];

    try {
      if (image && image.buffer.byteLength > 0) {
        const uploadImagesData = await uploadFilesFromFirebase(
          [image],
          EUploadFolder.book,
        );

        if (!uploadImagesData.success) {
          throw new Error('Failed to upload images!');
        }

        imageUrls = uploadImagesData.urls;
      }

      const result = await this.prismaService.$transaction(async (tx) => {
        const newBook = await tx.book.create({
          data: {
            name: dto.name,
            description: dto.description,
            image: imageUrls.length ? imageUrls[0] : DEFAULT_BOOK_IMAGE_URL,
            price: price,
            finalPrice: price,
          },
        });

        if (hasCategory) {
          await tx.bookCategory.createMany({
            data: categoryIds.map((categoryId) => ({
              bookId: newBook.id,
              categoryId,
            })),
          });
        }

        if (hasAuthor) {
          await tx.bookAuthor.createMany({
            data: authorIds.map((authorId) => ({
              bookId: newBook.id,
              authorId,
            })),
          });
        }

        const slug = `${slugify(dto.name, { lower: true, locale: 'vi' })}_${newBook.id}`;

        const updatedBook = await tx.book.update({
          where: { id: newBook.id },
          data: { slug },
          include: {
            authors: {
              select: {
                author: true,
              },
            },
            categories: {
              select: {
                category: true,
              },
            },
          },
        });

        return updatedBook;
      });

      const categories = result.categories.map((item) => item.category);

      const authors = result.authors.map((item) => item.author);

      return {
        ...result,
        categories,
        authors,
      };
    } catch (error) {
      console.log('Error:', error.message);

      if (image && imageUrls.length) await deleteFilesFromFirebase(imageUrls);

      throw new BadRequestException({
        message: 'Failed to create book',
      });
    }
  }

  async getBooks(dto: FindAllBooksInput) {
    let categorySlugs: string[] = [];
    if (dto.categorySlugs) {
      categorySlugs = dto.categorySlugs.split(',');

      const categories = await this.prismaService.category.findMany({
        where: {
          slug: {
            in: categorySlugs,
          },
        },
      });

      if (categories.length !== categorySlugs.length) {
        throw new BadRequestException('Invalid category');
      }
    }

    let authorSlugs: string[] = [];
    if (dto.authorSlugs) {
      authorSlugs = dto.authorSlugs.split(',');

      const authors = await this.prismaService.author.findMany({
        where: {
          slug: {
            in: authorSlugs,
          },
        },
      });

      if (authors.length !== authorSlugs.length) {
        throw new BadRequestException('Invalid author');
      }
    }

    const sortOrder = sortMapping[dto.sort];

    const conditions = {
      where: {
        ...(dto.rating ? { avgStars: { gte: dto.rating } } : {}),
        ...(dto.search &&
          dto.search.length > 0 && {
            OR: [
              {
                name: {
                  contains: dto.search,
                  mode: 'insensitive' as const,
                },
              },
              {
                description: {
                  contains: dto.search,
                  mode: 'insensitive' as const,
                },
              },
              {
                authors: {
                  some: {
                    author: {
                      name: {
                        contains: dto.search,
                        mode: 'insensitive' as const,
                      },
                    },
                  },
                },
              },
              {
                categories: {
                  some: {
                    category: {
                      name: {
                        contains: dto.search,
                        mode: 'insensitive' as const,
                      },
                    },
                  },
                },
              },
            ],
          }),
        ...(categorySlugs.length > 0 && {
          categories: {
            some: {
              category: {
                slug: {
                  in: categorySlugs,
                },
              },
            },
          },
        }),
        ...(authorSlugs.length > 0 && {
          authors: {
            some: {
              author: {
                slug: {
                  in: authorSlugs,
                },
              },
            },
          },
        }),
      },
      orderBy: [...(sortOrder ? [sortOrder] : []), { createdAt: dto.order }],
    };

    const pageOption =
      dto.page && dto.take
        ? {
            skip: dto.skip,
            take: dto.take,
          }
        : undefined;

    const [books, totalCount] = await Promise.all([
      this.prismaService.book.findMany({
        ...conditions,
        ...pageOption,
        include: {
          promotionList: true,
          authors: {
            select: {
              author: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          categories: {
            select: {
              category: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
      this.prismaService.book.count({
        ...conditions,
      }),
    ]);

    return {
      data: books.map((book) => ({
        ...book,
        authors: book.authors.map((item) => item.author),
        categories: book.categories.map((item) => item.category),
      })),
      totalPages: dto.take ? Math.ceil(totalCount / dto.take) : 1,
      totalCount,
    };
  }

  async getSpecialBooks(dto: SpecialBooksPageOptionsDto) {
    let whereCondition;
    let orderByCondition;

    switch (dto.type) {
      case SpecialBook.ON_SALE:
        whereCondition = {
          promotionListId: {
            not: null,
          },
        };
        orderByCondition = {
          discountPercentage: 'desc',
        };
        break;
      case SpecialBook.RECOMMENDED:
        whereCondition = {
          avgStars: {
            gte: 4,
          },
        };
        orderByCondition = {
          avgStars: 'desc',
        };
        break;
      case SpecialBook.POPULAR:
        whereCondition = {
          soldQuantity: {
            gt: 0,
          },
        };
        orderByCondition = {
          soldQuantity: 'desc',
        };
        break;
      default:
        throw new BadRequestException('Invalid special book type');
    }

    const conditions = {
      where: whereCondition,
      orderBy: orderByCondition,
    };

    const pageOption =
      dto.page && dto.take
        ? {
            skip: dto.skip,
            take: dto.take,
          }
        : undefined;

    const [books, totalCount] = await Promise.all([
      this.prismaService.book.findMany({
        ...conditions,
        ...pageOption,
        include: {
          promotionList: true,
        },
      }),
      this.prismaService.book.count({
        ...conditions,
      }),
    ]);

    return {
      data: books,
      totalPages: dto.take ? Math.ceil(totalCount / dto.take) : 1,
      totalCount,
    };
  }

  async getNonPromotionalBooks() {
    return await this.prismaService.book.findMany({
      where: {
        promotionListId: null,
      },
    });
  }

  async getBookById(id: number, reviewsDto: RatingReviewsPageOptionsDto) {
    const book = await this.prismaService.book.findUnique({
      where: { id },
      include: {
        authors: {
          select: {
            author: true,
          },
        },
        categories: {
          select: {
            category: true,
          },
        },
        promotionList: true,
      },
    });

    if (!book) {
      throw new NotFoundException('Book not found');
    }

    const conditions = {
      where: {
        bookId: id,
      },
      orderBy: [
        {
          createdAt: reviewsDto.order,
        },
      ],
    };

    const pageOption =
      reviewsDto.page && reviewsDto.take
        ? {
            skip: reviewsDto.skip,
            take: reviewsDto.take,
          }
        : undefined;

    const [ratingReviews, totalCount] = await Promise.all([
      this.prismaService.ratingReview.findMany({
        ...conditions,
        ...pageOption,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      this.prismaService.ratingReview.count({
        ...conditions,
      }),
    ]);

    return {
      ...book,
      authors: book.authors.map((item) => item.author),
      categories: book.categories.map((item) => item.category),
      ratingReviews: {
        data: ratingReviews,
        totalPages: reviewsDto.take
          ? Math.ceil(totalCount / reviewsDto.take)
          : 1,
        totalCount,
      },
    };
  }

  async getBookByIdForAdmin(id: number) {
    return await this.prismaService.book.findUnique({
      where: { id },
    });
  }

  async getBookBySlug(slug: string) {
    const book = await this.prismaService.book.findUnique({
      where: { slug },
      include: {
        promotionList: true,
        authors: {
          select: {
            author: {
              select: {
                id: true,
                slug: true,
                name: true,
              },
            },
          },
        },
        categories: {
          select: {
            category: {
              select: {
                id: true,
                slug: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!book) {
      throw new BadRequestException('Book not found');
    }

    return {
      ...book,
      authors: book.authors.map((item) => item.author),
      categories: book.categories.map((item) => item.category),
    };
  }

  async updateBook(
    id: number,
    dto: UpdateBookInput,
    image?: Express.Multer.File,
  ) {
    const price = Number(dto.price);
    if (dto.price && isNaN(price)) {
      throw new BadRequestException('Price must be a number!');
    }

    const book = await this.prismaService.book.findUnique({
      where: { id },
      include: {
        promotionList: true,
      },
    });

    if (!book) {
      throw new BadRequestException('Book not found');
    }

    if (dto.name) {
      const bookExists = await this.prismaService.book.findFirst({
        where: {
          name: dto.name,
        },
      });

      if (bookExists && bookExists.id !== id) {
        throw new BadRequestException('Book already exists');
      }
    }

    let imageUrls = [];

    try {
      if (image && image.buffer.byteLength > 0) {
        const uploadImagesData = await uploadFilesFromFirebase(
          [image],
          EUploadFolder.book,
        );

        if (!uploadImagesData.success) {
          throw new Error('Failed to upload images!');
        }

        imageUrls = uploadImagesData.urls;
      }

      const result = await this.prismaService.$transaction(async (tx) => {
        let finalPrice;

        if (dto.price) {
          if (book.promotionListId) {
            finalPrice = calculateDiscountedPrice(
              price,
              book.promotionList.discountPercentage,
            );
          } else {
            finalPrice = price;
          }
        } else {
          finalPrice = book.finalPrice;
        }

        const updatedBook = await tx.book.update({
          where: { id },
          data: {
            name: dto.name,
            description: dto.description,
            image: imageUrls.length ? imageUrls[0] : book.image,
            price: dto?.price ? price : book.price,
            finalPrice,
            slug: dto?.name
              ? `${slugify(dto.name, { lower: true, locale: 'vi' })}_${id}`
              : book.slug,
          },
          include: {
            categories: {
              select: {
                category: true,
              },
            },
            authors: {
              select: {
                author: true,
              },
            },
          },
        });

        return updatedBook;
      });

      const categories = result.categories.map((item) => item.category);

      const authors = result.authors.map((item) => item.author);

      return {
        ...result,
        categories,
        authors,
      };
    } catch (error) {
      console.log('Error:', error.message);

      if (image && imageUrls.length) await deleteFilesFromFirebase(imageUrls);

      throw new BadRequestException({
        message: 'Failed to update book',
      });
    }
  }

  async deleteBook(id: number) {
    const book = await this.prismaService.book.findUnique({
      where: { id },
    });

    if (!book) {
      throw new BadRequestException('Book not found');
    }

    try {
      await this.prismaService.book.delete({
        where: { id },
      });

      return await this.prismaService.book.findMany();
    } catch (error) {
      console.log('Error:', error.message);
      throw new BadRequestException({
        message: 'Failed to delete book',
      });
    }
  }

  async createRatingReview(
    userId: string,
    slug: string,
    dto: AddRatingReviewToBookDto,
  ) {
    const book = await this.prismaService.book.findUnique({
      where: { slug },
    });

    if (!book) {
      throw new NotFoundException({
        message: 'Book not found',
      });
    }

    try {
      const result = await this.prismaService.$transaction(async (tx) => {
        const newTotalReviews = book.totalReviews + 1;
        const newAvgStars =
          (book.avgStars * book.totalReviews + dto.star) / newTotalReviews;

        await tx.book.update({
          where: { id: book.id },
          data: {
            avgStars: newAvgStars,
            totalReviews: newTotalReviews,
          },
        });

        const ratingReview = await tx.ratingReview.create({
          data: {
            userId,
            bookId: book.id,
            ...dto,
          },
          include: {
            book: true,
          },
        });

        return ratingReview;
      });

      return result;
    } catch (error) {
      console.log('Error:', error.message);
      throw new BadRequestException({
        message: 'Failed to add rating review',
      });
    }
  }

  async getRatingReviewsBySlug(
    slug: string,
    dto: RatingReviewInBookPageOptionsDto,
  ) {
    const book = await this.prismaService.book.findUnique({
      where: { slug },
    });

    if (!book) {
      throw new NotFoundException({
        message: 'Book not found',
      });
    }

    const conditions = {
      where: {
        bookId: book.id,
        ...(dto.star ? { star: dto.star } : {}),
      },
      orderBy: [
        {
          createdAt: dto.order,
        },
      ],
    };

    const pageOption =
      dto.page && dto.take
        ? {
            skip: dto.skip,
            take: dto.take,
          }
        : undefined;

    const [ratingReviews, totalCount] = await Promise.all([
      this.prismaService.ratingReview.findMany({
        ...conditions,
        ...pageOption,
        include: {
          user: {
            select: {
              name: true,
              email: true,
              image: true,
            },
          },
        },
      }),
      this.prismaService.ratingReview.count({
        ...conditions,
      }),
    ]);

    const ratingCount = await this.prismaService.ratingReview.groupBy({
      by: ['star'],
      where: {
        bookId: book.id,
      },
      _count: true,
    });

    const ratingCountMap = ratingCount.reduce((acc, curr) => {
      acc[curr.star] = curr._count;
      return acc;
    }, {});

    return {
      data: ratingReviews,
      totalPages: dto.take ? Math.ceil(totalCount / dto.take) : 1,
      totalCount,
      ratingCount: {
        oneStar: ratingCountMap[1] || 0,
        twoStar: ratingCountMap[2] || 0,
        threeStar: ratingCountMap[3] || 0,
        fourStar: ratingCountMap[4] || 0,
        fiveStar: ratingCountMap[5] || 0,
      },
    };
  }

  async getBooksByCategorySlug(slug: string, dto: BooksPageOptionsDto) {
    const category = await this.prismaService.category.findFirst({
      where: {
        slug,
      },
    });

    if (!category) {
      throw new NotFoundException({
        message: 'Category not found',
      });
    }

    const sortOrder = sortMapping[dto.sort];

    const conditions = {
      where: {
        categories: {
          some: {
            categoryId: category.id,
          },
        },
      },
      orderBy: [...(sortOrder ? [sortOrder] : []), { createdAt: dto.order }],
    };

    const pageOption =
      dto.page && dto.take
        ? {
            skip: dto.skip,
            take: dto.take,
          }
        : undefined;

    const [books, totalCount] = await Promise.all([
      this.prismaService.book.findMany({
        ...conditions,
        include: {
          promotionList: true,
          authors: {
            select: {
              author: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          categories: {
            select: {
              category: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        ...pageOption,
      }),
      this.prismaService.book.count({
        ...conditions,
      }),
    ]);

    return {
      ...category,
      books: {
        data: books.map((book) => ({
          ...book,
          authors: book.authors.map((item) => item.author),
          categories: book.categories.map((item) => item.category),
        })),
        totalPages: dto.take ? Math.ceil(totalCount / dto.take) : 1,
        totalCount,
      },
    };
  }

  async getBooksByAuthorSlug(slug: string, dto: BooksPageOptionsDto) {
    const author = await this.prismaService.author.findFirst({
      where: {
        slug,
      },
    });

    if (!author) {
      throw new NotFoundException({
        message: 'Author not found',
      });
    }

    const sortOrder = sortMapping[dto.sort];

    const conditions = {
      where: {
        authors: {
          some: {
            authorId: author.id,
          },
        },
      },
      orderBy: [...(sortOrder ? [sortOrder] : []), { createdAt: dto.order }],
    };

    const pageOption =
      dto.page && dto.take
        ? {
            skip: dto.skip,
            take: dto.take,
          }
        : undefined;

    const [books, totalCount] = await Promise.all([
      this.prismaService.book.findMany({
        ...conditions,
        include: {
          promotionList: true,
          authors: {
            select: {
              author: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          categories: {
            select: {
              category: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        ...pageOption,
      }),
      this.prismaService.book.count({
        ...conditions,
      }),
    ]);

    return {
      ...author,
      books: {
        data: books.map((book) => ({
          ...book,
          authors: book.authors.map((item) => item.author),
          categories: book.categories.map((item) => item.category),
        })),
        totalPages: dto.take ? Math.ceil(totalCount / dto.take) : 1,
        totalCount,
      },
    };
  }

  async getBooksByPromoListSlug(slug: string, dto: BooksPageOptionsDto) {
    const promotionList = await this.prismaService.promotionList.findUnique({
      where: {
        slug,
      },
    });

    if (!promotionList) {
      throw new NotFoundException({
        message: 'Promotion list not found',
      });
    }

    const conditions = {
      where: {
        promotionListId: promotionList.id,
      },
      orderBy: [
        {
          createdAt: dto.order,
        },
      ],
    };

    const pageOption =
      dto.page && dto.take
        ? {
            skip: dto.skip,
            take: dto.take,
          }
        : undefined;

    const [books, totalCount] = await Promise.all([
      this.prismaService.book.findMany({
        ...conditions,
        ...pageOption,
      }),
      this.prismaService.book.count({
        ...conditions,
      }),
    ]);

    return {
      data: books,
      totalPages: dto.take ? Math.ceil(totalCount / dto.take) : 1,
      totalCount,
    };
  }

  async addAuthorsToBook(id: number, dto: AddAuthorsToBookDto) {
    const book = await this.prismaService.book.findUnique({
      where: { id },
    });

    if (!book) {
      throw new BadRequestException('Book not found');
    }

    const authors = await this.prismaService.author.findMany({
      where: { id: { in: dto.authorIds } },
    });

    if (authors.length !== dto.authorIds.length) {
      throw new BadRequestException('Invalid author');
    }

    const bookAuthor = await this.prismaService.bookAuthor.findMany({
      where: {
        bookId: id,
        authorId: {
          in: dto.authorIds,
        },
      },
    });

    if (bookAuthor.length) {
      throw new BadRequestException({
        message: 'There are some authors already in the book',
      });
    }

    try {
      await this.prismaService.bookAuthor.createMany({
        data: dto.authorIds.map((authorId) => ({
          authorId,
          bookId: id,
        })),
      });

      return {
        message: 'Added authors to book successfully',
      };
    } catch (error) {
      console.log('Error:', error.message);
      throw new BadRequestException({
        message: 'Failed to add authors to book',
      });
    }
  }

  async addCategoriesToBook(bookId: number, dto: AddCategoriesToBookDto) {
    const book = await this.prismaService.book.findUnique({
      where: { id: bookId },
    });

    if (!book) {
      throw new BadRequestException('Book not found');
    }

    const categories = await this.prismaService.category.findMany({
      where: { id: { in: dto.categoryIds } },
    });

    if (categories.length !== dto.categoryIds.length) {
      throw new BadRequestException('Invalid category');
    }

    const bookCategory = await this.prismaService.bookCategory.findMany({
      where: {
        bookId,
        categoryId: {
          in: dto.categoryIds,
        },
      },
    });

    if (bookCategory.length) {
      throw new BadRequestException({
        message: 'There are some categories already in the book',
      });
    }

    try {
      await this.prismaService.bookCategory.createMany({
        data: dto.categoryIds.map((categoryId) => ({
          bookId,
          categoryId,
        })),
      });

      return {
        message: 'Added categories to book successfully',
      };
    } catch (error) {
      console.log('Error:', error.message);
      throw new BadRequestException({
        message: 'Failed to add categories to book',
      });
    }
  }

  async addPromoListToBook(id: number, dto: AddPromoListToBookDto) {
    const book = await this.prismaService.book.findUnique({
      where: {
        id,
      },
    });

    if (!book) {
      throw new NotFoundException({
        message: 'Book not found',
      });
    }

    const promotionList = await this.prismaService.promotionList.findUnique({
      where: {
        id: dto.promotionListId,
      },
    });

    if (!promotionList) {
      throw new NotFoundException({
        message: 'Promotion list not found',
      });
    }

    if (book.promotionListId) {
      throw new BadRequestException({
        message: 'Book already in promotion list',
      });
    }

    try {
      await this.prismaService.book.update({
        where: {
          id,
        },
        data: {
          promotionListId: promotionList.id,
          finalPrice: calculateDiscountedPrice(
            book.price,
            promotionList.discountPercentage,
          ),
          discountPercentage: promotionList.discountPercentage,
          discountDate: new Date(),
        },
      });

      return {
        message: 'Added promotion list to book successfully',
      };
    } catch (error) {
      console.log('Error:', error.message);
      throw new BadRequestException({
        message: 'Failed to add promotion list to book',
      });
    }
  }
}
