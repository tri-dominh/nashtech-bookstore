/**
 * Migration script: convert book prices from VND to USD.
 *
 * Run only on databases that still hold raw VND amounts (price > 100).
 * The current seeded database already has USD-scale prices, so this script
 * will detect that and skip without touching any data.
 *
 * Usage:
 *   npx ts-node -P tsconfig.json prisma/convert-to-usd.ts
 */

import { PrismaClient } from '@prisma/client';
import * as path from 'path';

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
} catch {}

const prisma = new PrismaClient();
const VND_TO_USD = 25_000;

async function main() {
  const books = await prisma.book.findMany({
    select: { id: true, name: true, price: true, finalPrice: true, discountPercentage: true },
  });

  if (books.length === 0) {
    console.log('No books found. Nothing to migrate.');
    return;
  }

  // Detect whether prices look like VND (average price > 100 implies VND scale).
  const avgPrice = books.reduce((sum, b) => sum + b.price, 0) / books.length;
  if (avgPrice <= 100) {
    console.log(
      `Average book price is $${avgPrice.toFixed(2)} — prices are already in USD scale. No migration needed.`,
    );
    return;
  }

  console.log(
    `Average book price is ${avgPrice.toFixed(0)} VND. Converting ${books.length} books to USD (÷ ${VND_TO_USD})...\n`,
  );

  let converted = 0;
  for (const book of books) {
    const newPrice = Math.round((book.price / VND_TO_USD) * 100) / 100;
    const newFinalPrice = Math.round((book.finalPrice / VND_TO_USD) * 100) / 100;

    await prisma.book.update({
      where: { id: book.id },
      data: { price: newPrice, finalPrice: newFinalPrice },
    });

    console.log(`  [${++converted}/${books.length}] ${book.name}: ${book.price} VND → $${newPrice}`);
  }

  // Also convert order item prices stored at checkout time.
  const orderItems = await prisma.orderItem.findMany({
    select: { orderId: true, bookId: true, price: true, finalPrice: true, totalPrice: true },
  });

  if (orderItems.length > 0) {
    console.log(`\nConverting ${orderItems.length} order item price records...`);
    for (const item of orderItems) {
      await prisma.orderItem.update({
        where: { orderId_bookId: { orderId: item.orderId, bookId: item.bookId } },
        data: {
          price: Math.round((item.price / VND_TO_USD) * 100) / 100,
          finalPrice: Math.round((item.finalPrice / VND_TO_USD) * 100) / 100,
          totalPrice: Math.round((item.totalPrice / VND_TO_USD) * 100) / 100,
        },
      });
    }
    console.log('  Done.');
  }

  // Convert order totals.
  const orders = await prisma.order.findMany({
    select: { id: true, totalPrice: true },
  });

  if (orders.length > 0) {
    console.log(`\nConverting ${orders.length} order total records...`);
    for (const order of orders) {
      await prisma.order.update({
        where: { id: order.id },
        data: { totalPrice: Math.round((order.totalPrice / VND_TO_USD) * 100) / 100 },
      });
    }
    console.log('  Done.');
  }

  console.log(`\n✅ Migration complete. ${converted} books converted from VND to USD.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
