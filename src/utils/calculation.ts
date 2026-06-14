export function calculateDiscountedPrice(
  price: number,
  discountPercentage: number,
) {
  return Math.round((price - (price * discountPercentage) / 100) * 100) / 100;
}
