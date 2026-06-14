export enum Order {
  ASC = 'asc',
  DESC = 'desc',
}

export enum SortBy {
  ON_SALE = 'on_sale',
  POPULAR = 'popular',
  ASC_PRICE = 'price_asc',
  DESC_PRICE = 'price_desc',
}

export const sortMapping = {
  [SortBy.ON_SALE]: {
    discountPercentage: Order.DESC,
  },
  [SortBy.POPULAR]: { soldQuantity: Order.DESC },
  [SortBy.ASC_PRICE]: { finalPrice: Order.ASC },
  [SortBy.DESC_PRICE]: { finalPrice: Order.DESC },
};

export enum SpecialBook {
  ON_SALE = 'on_sale',
  RECOMMENDED = 'recommended',
  POPULAR = 'popular',
}

// PAGINATION
export const MAX_ITEMS_PER_PAGE = 20;
export const MAX_PAGINATION_PAGES = 5;
export const DEFAULT_PAGE_SIZE = 8;
export const DEFAULT_BOOK_PAGE_SIZE = 5;
export const DEFAULT_ORDER_PAGE_SIZE = 5;

// IMAGE
export const DEFAULT_IMAGE_URL =
  'https://firebasestorage.googleapis.com/v0/b/bookstore-70c15.appspot.com/o/storage%2Fdefault-user.jpeg?alt=media';

export const DEFAULT_BOOK_IMAGE_URL =
  'https://firebasestorage.googleapis.com/v0/b/bookstore-70c15.appspot.com/o/storage%2Fno-book.jpeg?alt=media';

// DATE, TIME, CURRENCY
export enum DateFormat {
  DATE = 'DD-MM-YYYY',
  DATE_TIME = 'DD-MM-YYYY HH:mm:ss',
  TIME_DATE = 'HH:mm:ss DD-MM-YYYY',
}

export const LOCALES_CURRENCY = 'en-US';
export const CURRENCY = 'USD';
