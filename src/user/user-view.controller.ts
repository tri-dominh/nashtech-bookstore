import {
  Controller,
  Get,
  Param,
  Query,
  Render,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthExceptionFilter } from 'src/auth/filters';
import { AuthenticatedGuard } from 'src/auth/guard';
import { DEFAULT_PAGE_SIZE } from 'src/constants/app';
import { formatCurrency, toDateTime } from 'src/utils';
import { capitalizeString } from 'src/utils/string';
import { UserPageOptionsDto } from './dto';
import { UserService } from './user.service';

@Controller('/customers')
@UseFilters(AuthExceptionFilter)
export class UserViewController {
  constructor(private readonly userService: UserService) {}

  @UseGuards(AuthenticatedGuard)
  @Get()
  @Render('users/list')
  async getUsersPage(@Query() dto: UserPageOptionsDto) {
    dto.page = dto.page || 1;
    dto.take = dto.take || DEFAULT_PAGE_SIZE;
    dto.role = UserRole.user;

    const res = await this.userService.getUsers(dto);

    const result = {
      ...res,
      data: res.data.map((user) => {
        return {
          ...user,
          createdAt: toDateTime(user.createdAt),
          updatedAt: toDateTime(user.updatedAt),
          role: capitalizeString(user.role),
        };
      }),
    };

    return {
      ...result,
      currentPage: dto.page,
    };
  }

  @UseGuards(AuthenticatedGuard)
  @Get(':id')
  @Render('users/detail')
  async getUserDetailPage(@Param('id') id: string) {
    const user = await this.userService.getUserById(id);

    return {
      ...user,
      createdAt: toDateTime(user.createdAt),
      updatedAt: toDateTime(user.updatedAt),
      orders: user.orders.map((order) => {
        return {
          ...order,
          createdAt: toDateTime(order.createdAt),
          updatedAt: toDateTime(order.updatedAt),
          totalPrice: formatCurrency(order.totalPrice),
        };
      }),
      ratingReviews: user.ratingReviews.map((ratingReview) => {
        return {
          ...ratingReview,
          createdAt: toDateTime(ratingReview.createdAt),
          updatedAt: toDateTime(ratingReview.updatedAt),
        };
      }),
    };
  }
}
