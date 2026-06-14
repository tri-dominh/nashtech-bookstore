import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import * as argon2 from 'argon2';
import * as https from 'https';
import * as http from 'http';
import * as path from 'path';
import slugify from 'slugify';

// Load .env when running directly (Prisma CLI does this automatically via `prisma db seed`)
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
} catch {}

const prisma = new PrismaClient();
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
const BUCKET = process.env.SUPABASE_BUCKET || 'images';

const DEFAULT_IMAGE =
  'https://firebasestorage.googleapis.com/v0/b/bookstore-70c15.appspot.com/o/storage%2Fdefault-user.jpeg?alt=media';

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeSlug(name: string): string {
  return slugify(name, { lower: true, locale: 'vi' });
}

function downloadBuffer(url: string, redirectsLeft = 5): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout: 20_000 }, (res) => {
      const loc = res.headers.location;
      if ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) && loc && redirectsLeft > 0) {
        res.resume();
        resolve(downloadBuffer(loc, redirectsLeft - 1));
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode} at ${url}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(Buffer.from(c)));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout: ${url}`)); });
  });
}

async function uploadToSupabase(buf: Buffer, folder: string, filename: string): Promise<string> {
  const safe = filename.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9.\-_]/g, '');
  const filePath = `${folder}/${Date.now()}-${safe}`;
  const { error } = await supabase.storage.from(BUCKET).upload(filePath, buf, {
    contentType: 'image/jpeg',
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(filePath).data.publicUrl;
}

async function fetchAndUpload(url: string, folder: string, filename: string): Promise<string> {
  try {
    const buf = await downloadBuffer(url);
    if (buf.length < 2_000) throw new Error('Image too small (placeholder)');
    return await uploadToSupabase(buf, folder, filename);
  } catch (e) {
    console.warn(`    ⚠  Could not fetch ${url}: ${(e as Error).message}`);
    return DEFAULT_IMAGE;
  }
}

// ─── Cleanup ───────────────────────────────────────────────────────────────

async function clearBucket() {
  console.log('\n🗑  Clearing Supabase bucket...');
  for (const folder of ['book', 'author', 'user']) {
    const { data, error } = await supabase.storage.from(BUCKET).list(folder, { limit: 1_000 });
    if (error || !data?.length) continue;
    const paths = data.map((f) => `${folder}/${f.name}`);
    const { error: rmErr } = await supabase.storage.from(BUCKET).remove(paths);
    if (rmErr) console.warn(`    ⚠  Could not remove files in ${folder}/: ${rmErr.message}`);
    else console.log(`    removed ${paths.length} files from ${folder}/`);
  }
}

async function cleanDatabase() {
  console.log('🗑  Cleaning database (correct FK order)...');
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.ratingReview.deleteMany();
  await prisma.bookAuthor.deleteMany();
  await prisma.bookCategory.deleteMany();
  await prisma.book.deleteMany();
  await prisma.author.deleteMany();
  await prisma.category.deleteMany();
  await prisma.promotionList.deleteMany();
  await prisma.user.deleteMany();
  await prisma.about.deleteMany();
  console.log('    done');
}

// ─── Seed data ─────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Fiction',
  'Technology',
  'Business & Finance',
  'Self-Help',
  'Science',
  'History',
  'Biography',
  'Mystery & Thriller',
];

const PROMOTIONS = [
  { name: 'Summer Sale', discountPercentage: 20 },
  { name: 'Staff Picks', discountPercentage: 15 },
];

const AUTHORS = [
  {
    name: 'James Clear',
    avatarImg: 11,
    bio: 'Author of the #1 New York Times bestseller Atomic Habits. His work has appeared in the New York Times, Entrepreneur, Time, and on CBS This Morning.',
  },
  {
    name: 'Cal Newport',
    avatarImg: 12,
    bio: 'Computer science professor at Georgetown University and bestselling author who explores the intersections of technology, work, and meaning.',
  },
  {
    name: 'George Orwell',
    avatarImg: 13,
    bio: 'English novelist, essayist, journalist and critic whose work is characterised by lucid prose, social criticism, and opposition to totalitarianism.',
  },
  {
    name: 'Yuval Noah Harari',
    avatarImg: 14,
    bio: 'Israeli historian and professor at the Hebrew University of Jerusalem. Author of the international bestsellers Sapiens, Homo Deus, and 21 Lessons for the 21st Century.',
  },
  {
    name: 'Robert C. Martin',
    avatarImg: 15,
    bio: '"Uncle Bob" is a software engineer, instructor and co-author of the Agile Manifesto. He has written landmark books including Clean Code, The Clean Coder, and Clean Architecture.',
  },
  {
    name: 'Daniel Kahneman',
    avatarImg: 16,
    bio: 'Nobel Prize-winning psychologist and economist, and author of the international bestseller Thinking, Fast and Slow.',
  },
  {
    name: 'Malcolm Gladwell',
    avatarImg: 17,
    bio: 'Staff writer for The New Yorker and author of six New York Times bestsellers including The Tipping Point, Blink, and Outliers.',
  },
  {
    name: 'Walter Isaacson',
    avatarImg: 18,
    bio: 'CEO of the Aspen Institute and former managing editor of Time. Author of biographies of Albert Einstein, Benjamin Franklin, Steve Jobs, and Leonardo da Vinci.',
  },
  {
    name: 'Stephen Hawking',
    avatarImg: 19,
    bio: 'Theoretical physicist, cosmologist, and author. Director of Research at the Centre for Theoretical Cosmology at the University of Cambridge. Wrote A Brief History of Time.',
  },
  {
    name: 'J.K. Rowling',
    avatarImg: 20,
    bio: 'British author and philanthropist best known for writing the seven-volume Harry Potter series, one of the best-selling book series in history.',
  },
];

type BookSeed = {
  name: string;
  description: string;
  price: number;
  isbn: string;
  authors: string[];
  categories: string[];
  promotion?: string;
};

const BOOKS: BookSeed[] = [
  {
    name: 'Atomic Habits',
    description:
      "No matter your goals, Atomic Habits offers a proven framework for improving every day. James Clear, one of the world's leading experts on habit formation, reveals practical strategies that will teach you exactly how to form good habits, break bad ones, and master the tiny behaviors that lead to remarkable results. If you're having trouble changing your habits, the problem isn't you. The problem is your system.",
    price: 27.99,
    isbn: '9780735211292',
    authors: ['James Clear'],
    categories: ['Self-Help'],
    promotion: 'Summer Sale',
  },
  {
    name: 'Deep Work',
    description:
      'Deep work is the ability to focus without distraction on a cognitively demanding task. Cal Newport argues that this skill is becoming increasingly rare at exactly the same time it is becoming increasingly valuable in our economy. As a result, the few who cultivate this skill, and then make it the core of their working life, will thrive.',
    price: 24.99,
    isbn: '9781455586691',
    authors: ['Cal Newport'],
    categories: ['Technology', 'Self-Help'],
  },
  {
    name: 'A World Without Email',
    description:
      "Cal Newport's bold vision for liberating our workplaces from the tyranny of the inbox. Newport argues that email and other always-on communication tools have accidentally traded long-term flourishing for short-term convenience, and he offers a better path forward using the same principles that have made other fields of business more effective.",
    price: 22.99,
    isbn: '9780525536550',
    authors: ['Cal Newport'],
    categories: ['Business & Finance', 'Technology'],
  },
  {
    name: '1984',
    description:
      "Among the seminal texts of the 20th century, Nineteen Eighty-Four is a rare work that grows more haunting as its futuristic purgatory becomes more real. Published in 1949, the book offers political satirist George Orwell's nightmare vision of a totalitarian, bureaucratic world where Big Brother watches your every move.",
    price: 14.99,
    isbn: '9780451524935',
    authors: ['George Orwell'],
    categories: ['Fiction'],
    promotion: 'Staff Picks',
  },
  {
    name: 'Animal Farm',
    description:
      'A farm is taken over by its overworked, mistreated animals. With flaming idealism and stirring slogans, they set out to create a paradise of progress, justice, and equality. Thus the stage is set for one of the most telling satiric fables ever penned—a razor-edged fairy tale for grown-ups that records the evolution from revolution against tyranny to a totalitarianism just as terrible.',
    price: 12.99,
    isbn: '9780451526342',
    authors: ['George Orwell'],
    categories: ['Fiction'],
  },
  {
    name: 'Sapiens: A Brief History of Humankind',
    description:
      "From a renowned historian comes a groundbreaking narrative of humanity's creation and evolution. 100,000 years ago, at least six different species of humans inhabited Earth. Yet today there is only one—homo sapiens. How did our species succeed in the battle for dominance? Why did our foraging ancestors come together to create cities and kingdoms?",
    price: 28.99,
    isbn: '9780062316097',
    authors: ['Yuval Noah Harari'],
    categories: ['History', 'Science'],
    promotion: 'Staff Picks',
  },
  {
    name: 'Homo Deus: A Brief History of Tomorrow',
    description:
      'Yuval Noah Harari envisions a near future in which mind and intelligence will be decoupled from consciousness, and perhaps from life itself. Homo Deus explores the projects, dreams, and nightmares that will shape the twenty-first century—from overcoming death to creating artificial life.',
    price: 26.99,
    isbn: '9780062464316',
    authors: ['Yuval Noah Harari'],
    categories: ['History', 'Science'],
  },
  {
    name: '21 Lessons for the 21st Century',
    description:
      "In Sapiens, Yuval Noah Harari explored humankind's past. In Homo Deus, he examined our distant future. Now, in 21 Lessons for the 21st Century, he asks: What is happening right now? How do we protect ourselves from nuclear war, ecological cataclysms, and the rise of artificial intelligence?",
    price: 24.99,
    isbn: '9780525512172',
    authors: ['Yuval Noah Harari'],
    categories: ['Self-Help', 'History'],
  },
  {
    name: 'Clean Code',
    description:
      "Even bad code can function. But if code isn't clean, it can bring a development organization to its knees. Every year, countless hours and significant resources are lost because of poorly written code. But it doesn't have to be that way. Robert C. Martin presents a revolutionary paradigm with Clean Code: A Handbook of Agile Software Craftsmanship.",
    price: 49.99,
    isbn: '9780132350884',
    authors: ['Robert C. Martin'],
    categories: ['Technology'],
    promotion: 'Summer Sale',
  },
  {
    name: 'The Clean Coder',
    description:
      'In The Clean Coder, legendary software expert Robert C. Martin introduces the disciplines, techniques, tools, and practices of true software craftsmanship. This book is packed with practical advice–about estimating, coding, refactoring, and testing–and more about the real challenges of being a professional software developer.',
    price: 44.99,
    isbn: '9780137081073',
    authors: ['Robert C. Martin'],
    categories: ['Technology'],
  },
  {
    name: 'Clean Architecture',
    description:
      'Building on the success of best-sellers Clean Code and The Clean Coder, legendary software craftsman Robert C. Martin reveals the best way to create software structures that endure. This book addresses the principles and patterns that make clean architecture and design possible.',
    price: 47.99,
    isbn: '9780134494166',
    authors: ['Robert C. Martin'],
    categories: ['Technology'],
  },
  {
    name: 'Thinking, Fast and Slow',
    description:
      'In the highly anticipated Thinking, Fast and Slow, Daniel Kahneman takes us on a groundbreaking tour of the mind and explains the two systems that drive the way we think. System 1 is fast, intuitive, and emotional; System 2 is slower, more deliberative, and more logical. The impact of overconfidence on corporate strategies, the difficulties of predicting what will make us happy in the future—Kahneman reveals where we can and cannot trust our intuitions.',
    price: 29.99,
    isbn: '9780374533557',
    authors: ['Daniel Kahneman'],
    categories: ['Self-Help', 'Science'],
    promotion: 'Staff Picks',
  },
  {
    name: 'Outliers: The Story of Success',
    description:
      'Malcolm Gladwell takes us on an intellectual journey through the world of "outliers"—the best and the brightest, the most famous and the most successful. He asks the question: what makes high-achievers different? His answer is that we pay too much attention to what successful people are like, and too little attention to where they are from: that is, their culture, their family, their generation, and the idiosyncratic experiences of their upbringing.',
    price: 18.99,
    isbn: '9780316017930',
    authors: ['Malcolm Gladwell'],
    categories: ['Self-Help'],
  },
  {
    name: 'Blink: The Power of Thinking Without Thinking',
    description:
      "Blink is a book about how we think without thinking, about choices that seem to be made in an instant—in the blink of an eye—that actually aren't as simple as they seem. Why are some people brilliant decision makers, while others are consistently inept? Why do some people follow their instincts and win, while others end up stumbling into error?",
    price: 17.99,
    isbn: '9780316010665',
    authors: ['Malcolm Gladwell'],
    categories: ['Self-Help', 'Science'],
    promotion: 'Summer Sale',
  },
  {
    name: 'The Tipping Point',
    description:
      'The tipping point is that magic moment when an idea, trend, or social behavior crosses a threshold, tips, and spreads like wildfire. Just as a single sick person can start an epidemic of the flu, so too can a small but precisely targeted push cause a fashion trend, the popularity of a new product, or a drop in the crime rate.',
    price: 17.99,
    isbn: '9780316346627',
    authors: ['Malcolm Gladwell'],
    categories: ['Business & Finance'],
  },
  {
    name: 'Steve Jobs',
    description:
      'Based on more than forty interviews with Jobs conducted over two years—as well as interviews with more than a hundred family members, friends, adversaries, competitors, and colleagues—Walter Isaacson has written a riveting story of the roller-coaster life and searingly intense personality of a creative entrepreneur whose passion for perfection and ferocious drive revolutionized six industries: personal computers, animated movies, music, phones, tablet computing, and digital publishing.',
    price: 35.99,
    isbn: '9781451648539',
    authors: ['Walter Isaacson'],
    categories: ['Biography'],
    promotion: 'Staff Picks',
  },
  {
    name: 'Leonardo da Vinci',
    description:
      "Based on thousands of pages from Leonardo's astonishing notebooks and new discoveries about his life and work, Walter Isaacson weaves a narrative that connects his art to his science. He shows how Leonardo's genius was based on skills we can improve in ourselves, such as passionate curiosity, careful observation, and an imagination so playful it flirted with fantasy.",
    price: 32.99,
    isbn: '9781501139154',
    authors: ['Walter Isaacson'],
    categories: ['Biography', 'History'],
  },
  {
    name: 'The Innovators',
    description:
      "Walter Isaacson's New York Times bestselling account of the people who created the computer and the internet. It tells the story of the creative partnerships that helped launch the digital revolution—from a remarkable collection of thinkers, engineers, and entrepreneurs who built our digital age.",
    price: 30.99,
    isbn: '9781476708706',
    authors: ['Walter Isaacson'],
    categories: ['Biography', 'Technology'],
  },
  {
    name: 'A Brief History of Time',
    description:
      "In the years since its publication in 1988, Stephen Hawking's A Brief History of Time has established itself as a landmark volume in scientific writing. It has become an international publishing phenomenon, translated into forty languages and selling over nine million copies worldwide. It addresses the most profound questions about the nature and origins of the universe.",
    price: 22.99,
    isbn: '9780553380163',
    authors: ['Stephen Hawking'],
    categories: ['Science'],
  },
  {
    name: "Harry Potter and the Sorcerer's Stone",
    description:
      "Harry Potter has never even heard of Hogwarts when the letters start dropping on the doormat at number four, Privet Drive. Addressed in green ink on yellowish parchment with a purple seal, they are swiftly confiscated by his grisly aunt and uncle. Then, on Harry's eleventh birthday, a great beetle-eyed giant of a man called Rubeus Hagrid bursts in with some astonishing news: Harry Potter is a wizard.",
    price: 19.99,
    isbn: '9780439708180',
    authors: ['J.K. Rowling'],
    categories: ['Fiction'],
    promotion: 'Summer Sale',
  },
];

const CUSTOMERS = [
  { name: 'John Doe', email: 'john.doe@example.com', avatarImg: 21, address: '123 Main St, New York, NY 10001', phone: '+1-555-0101' },
  { name: 'Jane Smith', email: 'jane.smith@example.com', avatarImg: 22, address: '456 Oak Ave, Los Angeles, CA 90001', phone: '+1-555-0102' },
  { name: 'Robert Johnson', email: 'robert.johnson@example.com', avatarImg: 23, address: '789 Pine Rd, Chicago, IL 60601', phone: '+1-555-0103' },
  { name: 'Emily Davis', email: 'emily.davis@example.com', avatarImg: 24, address: '321 Elm St, Houston, TX 77001', phone: '+1-555-0104' },
  { name: 'Michael Wilson', email: 'michael.wilson@example.com', avatarImg: 25, address: '654 Maple Dr, Phoenix, AZ 85001', phone: '+1-555-0105' },
];

const REVIEWS = [
  { book: 'Atomic Habits', user: 'John Doe', star: 5, title: 'Life-changing book!', content: "This book completely transformed my approach to building habits. The 1% better every day concept is so practical and actionable. I've been applying the techniques for 3 months and the results are incredible. Highly recommended to anyone who wants to improve!" },
  { book: 'Atomic Habits', user: 'Jane Smith', star: 5, title: 'Must read for everyone', content: "James Clear breaks down the science of habits in such an easy-to-understand way. I've already applied several techniques and am seeing real results in my daily routine. The concept of identity-based habits was an eye-opener." },
  { book: 'Atomic Habits', user: 'Robert Johnson', star: 4, title: 'Great practical advice', content: 'Very well written and full of practical advice. Some concepts felt repetitive toward the end, but overall an excellent book on habit formation. The habit stacking technique alone was worth the price.' },
  { book: 'Clean Code', user: 'Michael Wilson', star: 5, title: 'Essential for every developer', content: "Every software developer should read this book. Uncle Bob's principles have made me a significantly better programmer. The code examples are excellent and the explanations are clear. This should be required reading in every CS program." },
  { book: 'Clean Code', user: 'John Doe', star: 4, title: 'Solid fundamentals', content: 'Great book on software craftsmanship. Some examples are a bit dated but the principles are timeless. Changed how I write and review code. The chapter on functions alone is worth the price of admission.' },
  { book: 'Steve Jobs', user: 'Emily Davis', star: 5, title: 'Fascinating biography', content: "An incredibly detailed and honest account of Steve Jobs' life. Isaacson doesn't shy away from Jobs' difficult personality while still showing his undeniable genius. Both inspiring and cautionary at the same time." },
  { book: 'Steve Jobs', user: 'Jane Smith', star: 4, title: 'Inspiring and illuminating', content: "A comprehensive look at one of technology's most complex figures. The book is long but every chapter reveals something new and fascinating. The behind-the-scenes stories about Apple products are incredible." },
  { book: "Harry Potter and the Sorcerer's Stone", user: 'Emily Davis', star: 5, title: 'Magical and timeless', content: "Even as an adult, re-reading this book brings pure joy. Rowling created an absolutely magical world that has stood the test of time. The characters feel like old friends and the story is perfectly paced from start to finish." },
  { book: "Harry Potter and the Sorcerer's Stone", user: 'Robert Johnson', star: 5, title: 'A true classic', content: "The book that got me into reading as a child. Perfect pacing, wonderful characters, and an enchanting world that feels completely real. A must-read for all ages. The magic system is clever and consistent." },
  { book: 'Sapiens: A Brief History of Humankind', user: 'Michael Wilson', star: 5, title: 'Mind-expanding perspective', content: "Harari offers a breathtaking view of human history that genuinely changed how I see the world. Occasionally controversial in its theories but always thought-provoking. The chapter on the Cognitive Revolution was jaw-dropping." },
  { book: 'Sapiens: A Brief History of Humankind', user: 'John Doe', star: 4, title: 'Brilliant but dense', content: "Fascinating overview of human history from a highly unusual perspective. Some theories are speculative but the overall narrative is compelling and well-supported. Required patience in places but always rewarding." },
  { book: 'Thinking, Fast and Slow', user: 'Jane Smith', star: 5, title: 'Fundamentally changed how I think', content: "Kahneman's explanations of cognitive biases and heuristics are both accessible and profound. This book should be required reading for anyone who makes important decisions. I reference it constantly in my work." },
  { book: '1984', user: 'Robert Johnson', star: 5, title: 'More relevant than ever', content: "Orwell's vision of a surveillance state feels uncomfortably prescient in the modern era. A masterpiece of dystopian fiction that remains powerful decades after publication. The language of Newspeak is brilliantly conceived." },
  { book: 'A Brief History of Time', user: 'Emily Davis', star: 4, title: 'Complex ideas made accessible', content: "Hawking has an incredible ability to explain complex physics concepts in ways that non-scientists can grasp. A few sections require re-reading but the overall journey through cosmology is fascinating and worthwhile." },
];

const ORDER_CONFIGS = [
  {
    customer: 'John Doe',
    status: 'completed' as const,
    payment: 'cod' as const,
    items: [
      { book: 'Atomic Habits', qty: 2 },
      { book: 'Deep Work', qty: 1 },
    ],
  },
  {
    customer: 'Jane Smith',
    status: 'delivering' as const,
    payment: 'momo' as const,
    items: [
      { book: 'Steve Jobs', qty: 1 },
      { book: "Harry Potter and the Sorcerer's Stone", qty: 1 },
    ],
  },
  {
    customer: 'Robert Johnson',
    status: 'confirmed' as const,
    payment: 'vn_pay' as const,
    items: [
      { book: 'Clean Code', qty: 1 },
      { book: 'Clean Architecture', qty: 1 },
    ],
  },
  {
    customer: 'Emily Davis',
    status: 'pending' as const,
    payment: 'cod' as const,
    items: [
      { book: 'Sapiens: A Brief History of Humankind', qty: 1 },
      { book: 'Homo Deus: A Brief History of Tomorrow', qty: 1 },
    ],
  },
  {
    customer: 'Michael Wilson',
    status: 'completed' as const,
    payment: 'zalo_pay' as const,
    items: [
      { book: '1984', qty: 2 },
      { book: 'Animal Farm', qty: 1 },
      { book: 'Outliers: The Story of Success', qty: 1 },
    ],
  },
  {
    customer: 'John Doe',
    status: 'cancelled' as const,
    payment: 'momo' as const,
    items: [
      { book: 'Blink: The Power of Thinking Without Thinking', qty: 1 },
    ],
  },
];

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 NashTech Bookstore — Seed Script');
  console.log('====================================');

  await clearBucket();
  await cleanDatabase();

  // Admin user
  console.log('\n👤 Creating admin user...');
  const adminHash = await argon2.hash('Admin@123456');
  const adminAvatar = await fetchAndUpload('https://i.pravatar.cc/300?img=50', 'user', 'admin-avatar.jpg');
  await prisma.user.create({
    data: {
      email: 'admin@bookstore.com',
      password: adminHash,
      name: 'Admin',
      image: adminAvatar,
      role: 'admin',
      address: 'NashTech HQ, Ho Chi Minh City, Vietnam',
      phone: '+84-28-3456-7890',
    },
  });
  console.log('    ✓ admin@bookstore.com / Admin@123456');

  // Customer users
  console.log('\n👥 Creating customer accounts...');
  const customerHash = await argon2.hash('Customer@123456');
  const userMap: Record<string, { id: string; address: string; phone: string }> = {};
  for (const c of CUSTOMERS) {
    const avatar = await fetchAndUpload(
      `https://i.pravatar.cc/300?img=${c.avatarImg}`,
      'user',
      `${c.name.toLowerCase().replace(/\s+/g, '-')}.jpg`,
    );
    const user = await prisma.user.create({
      data: {
        email: c.email,
        password: customerHash,
        name: c.name,
        image: avatar,
        role: 'user',
        address: c.address,
        phone: c.phone,
      },
    });
    userMap[c.name] = { id: user.id, address: c.address, phone: c.phone };
    console.log(`    ✓ ${c.email}`);
  }

  // Categories
  console.log('\n📂 Creating categories...');
  const categoryMap: Record<string, number> = {};
  for (const name of CATEGORIES) {
    const cat = await prisma.category.create({
      data: { name, slug: makeSlug(name) },
    });
    categoryMap[name] = cat.id;
    console.log(`    ✓ ${name}`);
  }

  // Promotions
  console.log('\n🎉 Creating promotion lists...');
  const promoMap: Record<string, { id: number; discountPercentage: number }> = {};
  for (const p of PROMOTIONS) {
    const promo = await prisma.promotionList.create({
      data: { name: p.name, slug: makeSlug(p.name), discountPercentage: p.discountPercentage },
    });
    promoMap[p.name] = { id: promo.id, discountPercentage: p.discountPercentage };
    console.log(`    ✓ ${p.name} (${p.discountPercentage}% off)`);
  }

  // Authors
  console.log('\n✍️  Creating authors...');
  const authorMap: Record<string, number> = {};
  for (const a of AUTHORS) {
    const avatar = await fetchAndUpload(
      `https://i.pravatar.cc/300?img=${a.avatarImg}`,
      'author',
      `${a.name.toLowerCase().replace(/\s+/g, '-')}.jpg`,
    );
    const created = await prisma.author.create({
      data: { name: a.name, image: avatar },
    });
    await prisma.author.update({
      where: { id: created.id },
      data: { slug: `${makeSlug(a.name)}_${created.id}` },
    });
    authorMap[a.name] = created.id;
    console.log(`    ✓ ${a.name}`);
  }

  // Books
  console.log('\n📖 Creating books...');
  const bookMap: Record<string, { id: number; price: number; finalPrice: number }> = {};
  for (const b of BOOKS) {
    const promo = b.promotion ? promoMap[b.promotion] : null;
    const discount = promo?.discountPercentage ?? 0;
    const finalPrice = parseFloat((b.price * (1 - discount / 100)).toFixed(2));
    const discountDate = promo ? new Date(Date.now() + 60 * 24 * 60 * 60 * 1_000) : null;

    const cover = await fetchAndUpload(
      `https://covers.openlibrary.org/b/isbn/${b.isbn}-L.jpg`,
      'book',
      `${b.isbn}.jpg`,
    );

    const book = await prisma.book.create({
      data: {
        name: b.name,
        description: b.description,
        image: cover,
        price: b.price,
        finalPrice,
        discountPercentage: discount,
        discountDate,
        promotionListId: promo?.id ?? null,
      },
    });

    await prisma.book.update({
      where: { id: book.id },
      data: { slug: `${makeSlug(b.name)}_${book.id}` },
    });

    bookMap[b.name] = { id: book.id, price: b.price, finalPrice };

    for (const authorName of b.authors) {
      const authorId = authorMap[authorName];
      if (authorId) await prisma.bookAuthor.create({ data: { bookId: book.id, authorId } });
    }
    for (const catName of b.categories) {
      const categoryId = categoryMap[catName];
      if (categoryId) await prisma.bookCategory.create({ data: { bookId: book.id, categoryId } });
    }

    const discountInfo = discount > 0 ? ` → $${finalPrice} (${discount}% off)` : '';
    console.log(`    ✓ ${b.name}  $${b.price}${discountInfo}`);
  }

  // Reviews
  console.log('\n⭐ Creating reviews...');
  for (const r of REVIEWS) {
    const book = bookMap[r.book];
    const user = userMap[r.user];
    if (!book || !user) { console.warn(`    ⚠  Skipping review — book/user not found: ${r.book} / ${r.user}`); continue; }
    await prisma.ratingReview.create({
      data: { bookId: book.id, userId: user.id, star: r.star, title: r.title, content: r.content },
    });
    console.log(`    ✓ ${r.star}★ on "${r.book}" by ${r.user}`);
  }

  // Recompute avgStars + totalReviews from the actual seeded reviews
  console.log('\n🔢 Computing avgStars / totalReviews from seeded reviews...');
  const reviewAggs = await prisma.ratingReview.groupBy({
    by: ['bookId'],
    _avg: { star: true },
    _count: { id: true },
  });
  for (const agg of reviewAggs) {
    await prisma.book.update({
      where: { id: agg.bookId },
      data: {
        avgStars: parseFloat((agg._avg.star ?? 0).toFixed(2)),
        totalReviews: agg._count.id,
      },
    });
  }
  console.log(`    updated ${reviewAggs.length} book(s)`);

  // Orders
  console.log('\n🛒 Creating orders...');
  for (const cfg of ORDER_CONFIGS) {
    const customer = userMap[cfg.customer];
    if (!customer) continue;

    const items = cfg.items
      .map((i) => {
        const book = bookMap[i.book];
        if (!book) return null;
        return {
          bookId: book.id,
          quantity: i.qty,
          price: book.price,
          finalPrice: book.finalPrice,
          totalPrice: parseFloat((book.finalPrice * i.qty).toFixed(2)),
        };
      })
      .filter(Boolean) as { bookId: number; quantity: number; price: number; finalPrice: number; totalPrice: number }[];

    const total = parseFloat(items.reduce((s, i) => s + i.totalPrice, 0).toFixed(2));

    await prisma.order.create({
      data: {
        userId: customer.id,
        status: cfg.status,
        totalPrice: total,
        fullName: cfg.customer,
        shippingAddress: customer.address,
        phone: customer.phone,
        paymentMethod: cfg.payment,
        items: { create: items },
      },
    });
    console.log(`    ✓ ${cfg.customer}  ${cfg.status}  $${total}  (${cfg.payment})`);
  }

  // Recompute soldQuantity from seeded completed orders
  console.log('\n📦 Computing soldQuantity from completed orders...');
  const soldMap: Record<number, number> = {};
  for (const cfg of ORDER_CONFIGS) {
    if (cfg.status !== 'completed') continue;
    for (const item of cfg.items) {
      const book = bookMap[item.book];
      if (book) soldMap[book.id] = (soldMap[book.id] ?? 0) + item.qty;
    }
  }
  for (const [bookId, qty] of Object.entries(soldMap)) {
    await prisma.book.update({ where: { id: Number(bookId) }, data: { soldQuantity: qty } });
  }
  console.log(`    updated ${Object.keys(soldMap).length} book(s)`);

  // About page
  console.log('\n📄 Creating About page content...');
  await prisma.about.create({
    data: {
      content: `<h1>About NashTech Bookstore</h1>
<p>Welcome to NashTech Bookstore — your premier destination for books that inspire, educate, and entertain. Founded with a passion for reading and a commitment to bringing the best literature to our customers, we offer a carefully curated selection of titles spanning fiction, technology, business, self-help, science, history, biography, and more.</p>

<h2>Our Mission</h2>
<p>We believe that books have the power to change lives. Our mission is to make the world's best knowledge and stories accessible to every reader, delivered with exceptional service and care.</p>

<h2>Why Choose Us?</h2>
<ul>
  <li><strong>Curated Selection</strong> — Every book in our catalog is hand-picked by our team of passionate readers.</li>
  <li><strong>Competitive Prices</strong> — We work hard to offer the best prices, with regular promotions and discounts.</li>
  <li><strong>Fast Delivery</strong> — Your books arrive quickly and safely, no matter where you are.</li>
  <li><strong>Expert Recommendations</strong> — Our staff are avid readers who love sharing their favourite reads.</li>
</ul>

<h2>Contact Us</h2>
<p>Have a question or need help? Reach out to our friendly support team at <a href="mailto:support@nashtechbookstore.com">support@nashtechbookstore.com</a> or visit us at NashTech HQ, Ho Chi Minh City, Vietnam.</p>`,
    },
  });
  console.log('    ✓ About content created');

  // Summary
  console.log('\n✅ Seeding complete!');
  console.log('');
  console.log('┌─────────────────────────────────────────┐');
  console.log('│           Seed Summary                  │');
  console.log('├─────────────────────────────────────────┤');
  console.log('│  Admin      admin@bookstore.com         │');
  console.log('│  Password   Admin@123456                │');
  console.log('├─────────────────────────────────────────┤');
  console.log('│  Customers  [name]@example.com          │');
  console.log('│  Password   Customer@123456             │');
  console.log('├─────────────────────────────────────────┤');
  console.log(`│  Categories  ${CATEGORIES.length.toString().padEnd(28)}│`);
  console.log(`│  Promotions  ${PROMOTIONS.length.toString().padEnd(28)}│`);
  console.log(`│  Authors     ${AUTHORS.length.toString().padEnd(28)}│`);
  console.log(`│  Books       ${BOOKS.length.toString().padEnd(28)}│`);
  console.log(`│  Reviews     ${REVIEWS.length.toString().padEnd(28)}│`);
  console.log(`│  Orders      ${ORDER_CONFIGS.length.toString().padEnd(28)}│`);
  console.log('└─────────────────────────────────────────┘');
}

main()
  .catch((e) => { console.error('\n❌ Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
