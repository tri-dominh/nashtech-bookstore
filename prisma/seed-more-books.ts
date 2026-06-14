import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import * as https from 'https';
import * as http from 'http';
import * as path from 'path';
import slugify from 'slugify';

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

// ─── New authors to add ────────────────────────────────────────────────────

const NEW_AUTHORS = [
  { name: 'Harper Lee', avatarImg: 21 },
  { name: 'F. Scott Fitzgerald', avatarImg: 22 },
  { name: 'Paulo Coelho', avatarImg: 23 },
  { name: 'Suzanne Collins', avatarImg: 24 },
  { name: 'J.D. Salinger', avatarImg: 25 },
  { name: 'Jane Austen', avatarImg: 26 },
  { name: 'William Golding', avatarImg: 27 },
  { name: 'Khaled Hosseini', avatarImg: 28 },
  { name: 'George R.R. Martin', avatarImg: 29 },
  { name: 'Yann Martel', avatarImg: 30 },
  { name: 'Markus Zusak', avatarImg: 31 },
  { name: 'Frank Herbert', avatarImg: 32 },
  { name: 'Aldous Huxley', avatarImg: 33 },
  { name: 'Douglas Adams', avatarImg: 34 },
  { name: 'Ray Bradbury', avatarImg: 35 },
  { name: 'John Steinbeck', avatarImg: 36 },
  { name: 'Cormac McCarthy', avatarImg: 37 },
  { name: 'Gillian Flynn', avatarImg: 38 },
  { name: 'Stieg Larsson', avatarImg: 39 },
  { name: 'Paula Hawkins', avatarImg: 40 },
  { name: 'Liane Moriarty', avatarImg: 41 },
  { name: 'Alex Michaelides', avatarImg: 42 },
  { name: 'Delia Owens', avatarImg: 43 },
  { name: 'Agatha Christie', avatarImg: 44 },
  { name: 'Stephen King', avatarImg: 45 },
  { name: 'Dan Brown', avatarImg: 46 },
  { name: 'John Grisham', avatarImg: 47 },
  { name: 'Stephen R. Covey', avatarImg: 48 },
  { name: 'Dale Carnegie', avatarImg: 49 },
  { name: 'Viktor Frankl', avatarImg: 50 },
  { name: 'Mark Manson', avatarImg: 51 },
  { name: 'Eckhart Tolle', avatarImg: 52 },
  { name: 'Carol S. Dweck', avatarImg: 53 },
  { name: 'Angela Duckworth', avatarImg: 54 },
  { name: 'Brené Brown', avatarImg: 55 },
  { name: 'Marie Kondo', avatarImg: 56 },
  { name: 'Greg McKeown', avatarImg: 57 },
  { name: 'Hal Elrod', avatarImg: 58 },
  { name: 'David Goggins', avatarImg: 59 },
  { name: 'Bessel van der Kolk', avatarImg: 60 },
  { name: 'Jen Sincero', avatarImg: 61 },
  { name: 'Jim Collins', avatarImg: 62 },
  { name: 'Robert Kiyosaki', avatarImg: 63 },
  { name: 'Timothy Ferriss', avatarImg: 64 },
  { name: 'Simon Sinek', avatarImg: 65 },
  { name: 'Michael E. Gerber', avatarImg: 66 },
  { name: 'Ben Horowitz', avatarImg: 67 },
  { name: 'Peter Thiel', avatarImg: 68 },
  { name: 'Eric Ries', avatarImg: 69 },
  { name: 'Phil Knight', avatarImg: 70 },
  { name: 'Chris Voss', avatarImg: 1 },
  { name: 'Robert Cialdini', avatarImg: 2 },
  { name: 'Seth Godin', avatarImg: 3 },
  { name: 'Nir Eyal', avatarImg: 4 },
  { name: 'Thomas J. Stanley', avatarImg: 5 },
  { name: 'Dave Ramsey', avatarImg: 6 },
  { name: 'Napoleon Hill', avatarImg: 7 },
  { name: 'Morgan Housel', avatarImg: 8 },
  { name: 'Simon Sinek (Leaders)', avatarImg: 9 },
  { name: 'Richard Dawkins', avatarImg: 10 },
  { name: 'Carl Sagan', avatarImg: 11 },
  { name: 'Neil deGrasse Tyson', avatarImg: 12 },
  { name: 'Jared Diamond', avatarImg: 13 },
  { name: 'Bill Bryson', avatarImg: 14 },
  { name: 'Brian Greene', avatarImg: 15 },
  { name: 'Randall Munroe', avatarImg: 16 },
  { name: 'Siddhartha Mukherjee', avatarImg: 17 },
  { name: 'Richard Feynman', avatarImg: 18 },
  { name: 'Atul Gawande', avatarImg: 19 },
  { name: 'Laurie Garrett', avatarImg: 20 },
  { name: 'Anne Frank', avatarImg: 21 },
  { name: 'David McCullough', avatarImg: 22 },
  { name: 'Doris Kearns Goodwin', avatarImg: 23 },
  { name: 'Erik Larson', avatarImg: 24 },
  { name: 'Laura Hillenbrand', avatarImg: 25 },
  { name: 'S.C. Gwynne', avatarImg: 26 },
  { name: 'Dava Sobel', avatarImg: 27 },
  { name: 'David Grann', avatarImg: 28 },
  { name: 'Nelson Mandela', avatarImg: 29 },
  { name: 'Trevor Noah', avatarImg: 30 },
  { name: 'Michelle Obama', avatarImg: 31 },
  { name: 'Tara Westover', avatarImg: 32 },
  { name: 'Paul Kalanithi', avatarImg: 33 },
  { name: 'Maya Angelou', avatarImg: 34 },
  { name: 'Jeannette Walls', avatarImg: 35 },
  { name: 'Andre Agassi', avatarImg: 36 },
  { name: 'J.D. Vance', avatarImg: 37 },
  { name: 'Ron Chernow', avatarImg: 38 },
  { name: 'Martin Gilbert', avatarImg: 39 },
  { name: 'Jon Krakauer', avatarImg: 40 },
];

// ─── Books data ────────────────────────────────────────────────────────────

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
  // Fiction (18)
  {
    name: 'To Kill a Mockingbird',
    description: "The unforgettable novel of a childhood in a sleepy Southern town and the crisis of conscience that rocked it. 'To Kill a Mockingbird' became both an instant bestseller and a critical success when it was first published in 1960. It went on to win the Pulitzer Prize in 1961 and was later made into an Academy Award-winning film, also a classic.",
    price: 14.99, isbn: '9780061935466', authors: ['Harper Lee'], categories: ['Fiction'], promotion: 'Staff Picks',
  },
  {
    name: 'The Great Gatsby',
    description: "The story of the fabulously wealthy Jay Gatsby and his love for the beautiful Daisy Buchanan, of lavish parties on Long Island at a time when The New York Times noted 'gin was the national drink and sex the national obsession,' it is an exquisitely crafted tale of America in the 1920s.",
    price: 13.99, isbn: '9780743273565', authors: ['F. Scott Fitzgerald'], categories: ['Fiction'],
  },
  {
    name: 'The Alchemist',
    description: "Paulo Coelho's masterpiece tells the mystical story of Santiago, an Andalusian shepherd boy who yearns to travel in search of a worldly treasure. His quest will lead him to riches far different—and far more satisfying—than he ever imagined. Santiago's journey teaches us about the essential wisdom of listening to our hearts.",
    price: 16.99, isbn: '9780062315007', authors: ['Paulo Coelho'], categories: ['Fiction'], promotion: 'Summer Sale',
  },
  {
    name: 'The Hunger Games',
    description: "In the ruins of a place once known as North America lies the nation of Panem, a shining Capitol surrounded by twelve outlying districts. The Capitol is harsh and cruel and keeps the districts in line by forcing them all to send one boy and one girl between the ages of twelve and eighteen to participate in the annual Hunger Games, a fight to the death on live TV.",
    price: 17.99, isbn: '9780439023481', authors: ['Suzanne Collins'], categories: ['Fiction'],
  },
  {
    name: 'The Catcher in the Rye',
    description: "The novel details two days in the life of 16-year-old Holden Caulfield after he has been expelled from prep school. Confused and disillusioned, Holden searches for truth and rails against the 'phony' adult world. Since its original publication in 1951, this novel has been the center of controversy.",
    price: 13.99, isbn: '9780316769174', authors: ['J.D. Salinger'], categories: ['Fiction'],
  },
  {
    name: 'Pride and Prejudice',
    description: "Few have failed to be charmed by the witty and independent spirit of Elizabeth Bennet in Austen's beloved classic Pride and Prejudice. When Elizabeth Bennet first meets eligible bachelor Fitzwilliam Darcy, she thinks him arrogant and conceited; he is indifferent to her good looks and lively mind.",
    price: 12.99, isbn: '9780141439518', authors: ['Jane Austen'], categories: ['Fiction'], promotion: 'Staff Picks',
  },
  {
    name: 'Lord of the Flies',
    description: "A plane crashes on an uninhabited island and the only survivors, a group of schoolboys, assemble on the beach and wait to be rescued. By day they inhabit a land of bright fantastic birds and dark blue seas, but at night their dreams are haunted by the image of a terrifying beast. As the boys' delicate sense of order fades, so their childish dreams are transformed into something more primitive.",
    price: 13.99, isbn: '9780571191475', authors: ['William Golding'], categories: ['Fiction'],
  },
  {
    name: 'The Kite Runner',
    description: "The unforgettable, heartbreaking story of the unlikely friendship between a wealthy boy and the son of his father's servant, caught in the tragic sweep of history. The Kite Runner transports readers to Afghanistan at a uniquely pivotal time in its tumultuous recent past.",
    price: 16.99, isbn: '9781594631931', authors: ['Khaled Hosseini'], categories: ['Fiction'], promotion: 'Summer Sale',
  },
  {
    name: 'A Game of Thrones',
    description: "Long ago, in a time forgotten, a preternatural event threw the seasons out of balance. The cold is returning, and in the frozen wastes to the north of Winterfell, sinister and supernatural forces are massing beyond the kingdom's protective Wall. At the center of the conflict lie the Starks of Winterfell, a family as harsh and unyielding as the land they were born to.",
    price: 22.99, isbn: '9780553573404', authors: ['George R.R. Martin'], categories: ['Fiction'],
  },
  {
    name: 'Life of Pi',
    description: "The son of a zookeeper, Pi Patel has an encyclopedic knowledge of animal behavior and a fervent love of stories. When Pi is sixteen, his family emigrates from India to North America aboard a Japanese cargo ship, along with their zoo animals bound for new homes. The ship sinks. Pi finds himself alone in a lifeboat, his only companions a hyena, an orangutan, a wounded zebra, and Richard Parker, a 450-pound Bengal tiger.",
    price: 16.99, isbn: '9780156027328', authors: ['Yann Martel'], categories: ['Fiction'], promotion: 'Staff Picks',
  },
  {
    name: 'The Book Thief',
    description: "It is 1939. Nazi Germany. The country is holding its breath. Death has never been busier, and will become busier still. Liesel Meminger is a foster girl living outside of Munich, who scratches out a meager existence for herself by stealing when she encounters something she can't resist—books. With the help of her accordion-playing foster father, she learns to read and shares her stolen books with her neighbors during bombing raids.",
    price: 17.99, isbn: '9780375842207', authors: ['Markus Zusak'], categories: ['Fiction', 'History'], promotion: 'Summer Sale',
  },
  {
    name: 'Dune',
    description: "Set on the desert planet Arrakis, Dune is the story of the boy Paul Atreides, heir to a noble family tasked with ruling an inhospitable world where the only thing of value is the 'spice' melange, a drug capable of extending life and enhancing consciousness. Coveted across the known universe, melange is a prize worth killing for.",
    price: 19.99, isbn: '9780441013593', authors: ['Frank Herbert'], categories: ['Fiction'],
  },
  {
    name: 'Brave New World',
    description: "Aldous Huxley's profoundly important classic of world literature, Brave New World is a searching vision of an unequal, technologically-advanced future where humans are genetically bred, socially indoctrinated, and pharmaceutically anesthetized to passively uphold an authoritarian ruling order.",
    price: 14.99, isbn: '9780060850524', authors: ['Aldous Huxley'], categories: ['Fiction'],
  },
  {
    name: "The Hitchhiker's Guide to the Galaxy",
    description: "Seconds before the Earth is demolished to make way for a hyperspace bypass, Arthur Dent is plucked off the planet by his friend Ford Prefect, a researcher for the revised edition of The Hitchhiker's Guide to the Galaxy who, for the last fifteen years, has been posing as an out-of-work actor.",
    price: 13.99, isbn: '9780345391803', authors: ['Douglas Adams'], categories: ['Fiction'], promotion: 'Staff Picks',
  },
  {
    name: 'Fahrenheit 451',
    description: "Guy Montag is a fireman. His job is to burn books, which are forbidden, being the source of all discord and unhappiness. Even so, Montag is unhappy; there is discord in his marriage. Are books hidden in his house? The Mechanical Hound of the Fire Department, armed with a lethal hypodermic, escorted by helicopters, is ready to track down those dissidents who defy society to preserve and read books.",
    price: 13.99, isbn: '9781451673319', authors: ['Ray Bradbury'], categories: ['Fiction'],
  },
  {
    name: 'The Grapes of Wrath',
    description: "First published in 1939, Steinbeck's Pulitzer Prize-winning epic of the Great Depression chronicles the Dust Bowl migration of the 1930s and tells the story of one Oklahoma farm family, the Joads—driven from their homestead and forced to travel west to the promised land of California.",
    price: 15.99, isbn: '9780143039433', authors: ['John Steinbeck'], categories: ['Fiction', 'History'],
  },
  {
    name: 'The Road',
    description: "A searing, postapocalyptic novel destined to become Cormac McCarthy's masterpiece. A father and his son walk alone through burned America. Nothing moves in the ravaged landscape save the ash on the wind. It is cold enough to crack stones, and when the snow falls it is gray.",
    price: 14.99, isbn: '9780307387899', authors: ['Cormac McCarthy'], categories: ['Fiction'],
  },
  {
    name: 'East of Eden',
    description: "A masterpiece of Steinbeck, East of Eden is a sprawling family saga set in the Salinas Valley of California from the time of the Civil War to World War I. This novel interweaves the stories of two families, the Trasks and the Hamiltons, whose lives and fates are intertwined. It is Steinbeck's magnum opus.",
    price: 17.99, isbn: '9780142000656', authors: ['John Steinbeck'], categories: ['Fiction'], promotion: 'Summer Sale',
  },

  // Mystery & Thriller (12)
  {
    name: 'Gone Girl',
    description: "On a warm summer morning in North Carthage, Missouri, it is Nick and Amy Dunne's fifth wedding anniversary. Presents are being wrapped and reservations are being made when Nick's clever and beautiful wife disappears. Under mounting pressure from the police and the media—as well as Amy's fiercely doting parents—the town golden boy parades an endless series of lies, deceits, and inappropriate behavior.",
    price: 16.99, isbn: '9780307588364', authors: ['Gillian Flynn'], categories: ['Mystery & Thriller'], promotion: 'Staff Picks',
  },
  {
    name: 'The Girl with the Dragon Tattoo',
    description: "Harriet Vanger, a scion of one of Sweden's wealthiest families disappeared over forty years ago. All these years later, her aged uncle continues to seek the truth. He hires Mikael Blomkvist, a crusading journalist recently trapped by a libel conviction, to investigate. He is aided by the piercing Lisbeth Salander, a troubled, wise, and remarkably original character.",
    price: 17.99, isbn: '9780307454546', authors: ['Stieg Larsson'], categories: ['Mystery & Thriller'],
  },
  {
    name: 'The Girl on the Train',
    description: "Rachel takes the same commuter train every morning. Every day she rattles down the track, flashes past a stretch of cozy suburban homes, and stops at the signal that allows her to daily watch the same couple breakfasting on their deck. She's even started to feel like she knows them. \"Jess and Jason,\" she calls them. Their life—as she sees it—is perfect.",
    price: 16.99, isbn: '9781594634024', authors: ['Paula Hawkins'], categories: ['Mystery & Thriller'], promotion: 'Summer Sale',
  },
  {
    name: 'Big Little Lies',
    description: "Sometimes it's the little lies that turn out to be the most lethal. A murder... A school reunion... A picturesque seaside town... It's a story about very big lies and very little lies, about humiliation and secrets, about a kind of violence you might not even notice until it hits you with the force of a feather.",
    price: 16.99, isbn: '9780399587320', authors: ['Liane Moriarty'], categories: ['Mystery & Thriller'],
  },
  {
    name: 'The Silent Patient',
    description: "Alicia Berenson's life is seemingly perfect. A famous painter married to an in-demand fashion photographer, she lives in a grand house with big windows overlooking a park in one of London's most desirable areas. One evening her husband Gabriel returns home late from a fashion shoot, and Alicia shoots him five times in the face, and then never speaks another word.",
    price: 17.99, isbn: '9781250301697', authors: ['Alex Michaelides'], categories: ['Mystery & Thriller'], promotion: 'Staff Picks',
  },
  {
    name: 'Where the Crawdads Sing',
    description: "For years, rumors of the 'Marsh Girl' have haunted Barkley Cove, a quiet town on the North Carolina coast. So in late 1969, when handsome Chase Andrews is found dead, the locals immediately suspect Kya Clark, the so-called Marsh Girl. But Kya is not what they say.",
    price: 17.99, isbn: '9780735224292', authors: ['Delia Owens'], categories: ['Mystery & Thriller', 'Fiction'], promotion: 'Summer Sale',
  },
  {
    name: 'Murder on the Orient Express',
    description: "Just after midnight, a snowdrift stops the Orient Express in its tracks. The luxurious train is surprisingly full for the time of year, but by the morning it is one passenger fewer. An American tycoon lies dead in his compartment, stabbed a dozen times, his door locked from the inside. Isolated and with a killer in their midst, detective Hercule Poirot must identify the murderer.",
    price: 14.99, isbn: '9780062073501', authors: ['Agatha Christie'], categories: ['Mystery & Thriller'],
  },
  {
    name: 'The Shining',
    description: "Jack Torrance's new job at the Overlook Hotel is the perfect chance for a fresh start. As the off-season caretaker at the atmospheric old hotel, he'll have plenty of time to spend reconnecting with his family and working on his writing. But as the harsh winter weather sets in, the idyllic location feels ever more remote . . . and more sinister.",
    price: 16.99, isbn: '9780307743657', authors: ['Stephen King'], categories: ['Mystery & Thriller'], promotion: 'Staff Picks',
  },
  {
    name: 'It',
    description: "To the children, the town was their whole world. To the adults, knowing better, Derry, Maine was just their home town: familiar, well-ordered for the most part. A good place to live. It was the children who saw—and felt—what made Derry so horribly different. In the storm drains, in the sewers, IT lurked, taking on the shape of every nightmare.",
    price: 21.99, isbn: '9781501156700', authors: ['Stephen King'], categories: ['Mystery & Thriller'],
  },
  {
    name: 'Sharp Objects',
    description: "Fresh from a brief stay at a psych clinic, journalist Camille Preaker faces a troubling assignment: she must return to her tiny hometown to cover the murders of two preteen girls. For years, Camille has hardly spoken to her neurotic, hypochondriac mother or to the half-sister she barely knows: an eerie, beautiful thirteen-year-old.",
    price: 15.99, isbn: '9780307341556', authors: ['Gillian Flynn'], categories: ['Mystery & Thriller'],
  },
  {
    name: 'The Da Vinci Code',
    description: "While in Paris, Harvard symbologist Robert Langdon is awakened by a phone call in the dead of the night. The elderly curator of the Louvre has been murdered inside the museum, his body covered in baffling symbols. As Langdon and a gifted French cryptologist, Sophie Neveu, sort through the bizarre riddles, they are stunned to discover a trail of clues hidden in the works of Leonardo da Vinci.",
    price: 17.99, isbn: '9780307474278', authors: ['Dan Brown'], categories: ['Mystery & Thriller'], promotion: 'Summer Sale',
  },
  {
    name: 'The Pelican Brief',
    description: "Two Supreme Court justices have been assassinated. One lone, brilliant woman—Darby Shaw—has deduced the link. It was a political maneuver expected to succeed, but for the dogged tenacity of reporter Gray Grantham. Now Darby is being hunted by very powerful and dangerous people.",
    price: 15.99, isbn: '9780385339704', authors: ['John Grisham'], categories: ['Mystery & Thriller'],
  },

  // Self-Help (17)
  {
    name: 'The 7 Habits of Highly Effective People',
    description: "One of the most inspiring and impactful books ever written, The 7 Habits of Highly Effective People has captivated readers for 30 years. It has transformed the lives of Presidents and CEOs, educators and parents— in short, millions of people of all ages and occupations have benefited from Dr. Covey's 7 Habits book.",
    price: 18.99, isbn: '9781982137274', authors: ['Stephen R. Covey'], categories: ['Self-Help'], promotion: 'Staff Picks',
  },
  {
    name: 'How to Win Friends and Influence People',
    description: "For more than sixty years the rock-solid, time-tested advice in this book has carried thousands of now famous people up the ladder of success in their business and personal lives. Now this previously revised and updated bestseller is available in trade paperback for the first time to help you achieve your maximum potential throughout the next century.",
    price: 16.99, isbn: '9780671027032', authors: ['Dale Carnegie'], categories: ['Self-Help'],
  },
  {
    name: 'The Four Agreements',
    description: "In The Four Agreements, bestselling author don Miguel Ruiz reveals the source of self-limiting beliefs that rob us of joy and create needless suffering. Based on ancient Toltec wisdom, The Four Agreements offer a powerful code of conduct that can rapidly transform our lives to a new experience of freedom, true happiness, and love.",
    price: 14.99, isbn: '9781878424310', authors: ['Paulo Coelho'], categories: ['Self-Help'], promotion: 'Summer Sale',
  },
  {
    name: "Man's Search for Meaning",
    description: "A prominent Viennese psychiatrist before the war, Viktor Frankl was uniquely able to observe the way that he and other inmates coped with the experience of being in Auschwitz. He noticed that it was the men who comforted others and who gave away their last piece of bread who survived the longest.",
    price: 14.99, isbn: '9780807014271', authors: ['Viktor Frankl'], categories: ['Self-Help', 'Biography'],
  },
  {
    name: 'The Subtle Art of Not Giving a F*ck',
    description: "In this generation-defining self-help guide, a superstar blogger cuts through the crap to show us how to stop trying to be 'positive' all the time so that we can truly become better, happier people. For decades, we've been told that positive thinking is the key to a happy, rich life.",
    price: 17.99, isbn: '9780062457714', authors: ['Mark Manson'], categories: ['Self-Help'], promotion: 'Staff Picks',
  },
  {
    name: 'The Power of Now',
    description: "To make the journey into The Power of Now we will need to leave our analytical mind and its false created self, the ego, behind. Although the journey is challenging, Eckhart Tolle offers simple language and a question and answer format to guide us. A word of mouth phenomenon since its first publication, The Power of Now is one of those rare books with the power to create an experience in readers.",
    price: 15.99, isbn: '9781577314806', authors: ['Eckhart Tolle'], categories: ['Self-Help'],
  },
  {
    name: 'Mindset: The New Psychology of Success',
    description: "After decades of research, world-renowned Stanford University psychologist Carol S. Dweck, Ph.D., discovered a simple but groundbreaking idea: the power of mindset. In this brilliant book, she shows how success in school, work, sports, the arts, and almost every area of human endeavor can be dramatically influenced by how we think about our talents and abilities.",
    price: 16.99, isbn: '9780345472328', authors: ['Carol S. Dweck'], categories: ['Self-Help'], promotion: 'Summer Sale',
  },
  {
    name: 'Grit: The Power of Passion and Perseverance',
    description: "In this instant New York Times bestseller, pioneering psychologist Angela Duckworth shows anyone striving to succeed—be it parents, students, educators, athletes, or business people—that the secret to outstanding achievement is not talent but a special blend of passion and persistence she calls 'grit.'",
    price: 17.99, isbn: '9781501111105', authors: ['Angela Duckworth'], categories: ['Self-Help'],
  },
  {
    name: 'Daring Greatly',
    description: "In Daring Greatly, Dr. Brené Brown challenges everything we think we know about vulnerability. Based on twelve years of research, she argues that vulnerability is not weakness, but rather our clearest path to courage, engagement, and meaningful connection. The book that started a global conversation about the courage it takes to dare greatly.",
    price: 17.99, isbn: '9781592408412', authors: ['Brené Brown'], categories: ['Self-Help'], promotion: 'Staff Picks',
  },
  {
    name: 'The Life-Changing Magic of Tidying Up',
    description: "Despite constant efforts to declutter your home, do papers still accumulate like snowdrifts and clothes pile up like a tangled mess of noodles? Japanese cleaning consultant Marie Kondo takes tidying to a whole new level, promising that if you properly simplify and organize your home once, you'll never have to do it again.",
    price: 16.99, isbn: '9781607747307', authors: ['Marie Kondo'], categories: ['Self-Help'],
  },
  {
    name: 'Essentialism: The Disciplined Pursuit of Less',
    description: "Have you ever found yourself stretched too thin? Do you sometimes feel too busy but not productive? If you caught yourself answering yes to any of these, the way out is the way of the Essentialist. In Essentialism, Greg McKeown gives us a systematic discipline for discerning what is absolutely essential, then eliminating everything that is not.",
    price: 17.99, isbn: '9780804137386', authors: ['Greg McKeown'], categories: ['Self-Help'], promotion: 'Summer Sale',
  },
  {
    name: 'The Miracle Morning',
    description: "What if you could wake up tomorrow and any—or every area of your life was beginning to transform? What would you change? The Miracle Morning is about what Hal Elrod calls 'The Life S.A.V.E.R.S.'—six simple practices that will save you from a life of mediocrity and help you to create the life you've always wanted.",
    price: 15.99, isbn: '9780979019715', authors: ['Hal Elrod'], categories: ['Self-Help'],
  },
  {
    name: "Can't Hurt Me",
    description: "For David Goggins, childhood was a nightmare—poverty, prejudice, and physical abuse colored his days and haunted his nights. But through self-discipline, mental toughness, and hard work, Goggins transformed himself from a depressed, overweight young man with no future into a U.S. Armed Forces icon and one of the world's top endurance athletes.",
    price: 19.99, isbn: '9781544512907', authors: ['David Goggins'], categories: ['Self-Help'], promotion: 'Staff Picks',
  },
  {
    name: 'The Body Keeps the Score',
    description: "Trauma is a fact of life. Veterans and their families deal with the painful aftermath of combat; one in five Americans has been molested; one in four grew up with alcoholics; one in three couples have engaged in physical violence. Dr. Bessel van der Kolk has spent over three decades working with survivors.",
    price: 18.99, isbn: '9780143127741', authors: ['Bessel van der Kolk'], categories: ['Self-Help'],
  },
  {
    name: 'You Are a Badass',
    description: "You Are a Badass is the self-help book for people who desperately want to improve their lives but don't want to be busted doing it. In this refreshingly entertaining how-to guide, bestselling author and world-traveling success coach Jen Sincero helps you identify and change the self-sabotaging beliefs and behaviors that stop you from getting what you want.",
    price: 16.99, isbn: '9780762447695', authors: ['Jen Sincero'], categories: ['Self-Help'], promotion: 'Summer Sale',
  },
  {
    name: 'The Gifts of Imperfection',
    description: "In The Gifts of Imperfection, Brené Brown, a leading expert on shame, authenticity, and belonging, shares what she's learned from a decade of research on the power of Wholehearted living—a way of engaging with our lives from a place of worthiness.",
    price: 16.99, isbn: '9781592858491', authors: ['Brené Brown'], categories: ['Self-Help'],
  },
  {
    name: 'Ikigai: The Japanese Secret to a Long and Happy Life',
    description: "The people of Japan believe that everyone has an ikigai—a reason for living. And according to the residents of the Japanese village with the world's longest-living people, finding it is the key to a happier and longer life. Having a strong sense of ikigai—where what you love, what you're good at, what you can get paid for, and what the world needs all overlap—means that each day is infused with meaning.",
    price: 14.99, isbn: '9780143130727', authors: ['Eckhart Tolle'], categories: ['Self-Help'], promotion: 'Staff Picks',
  },

  // Business & Finance (18)
  {
    name: 'Good to Great',
    description: "The Challenge: Built to Last, the defining management study of the nineties, showed how great companies triumph over time and how long-term sustained performance can be engineered into the DNA of an enterprise from the very beginning. But what about the company that is not born with great DNA? How can good companies, mediocre companies, even bad companies achieve enduring greatness?",
    price: 22.99, isbn: '9780066620992', authors: ['Jim Collins'], categories: ['Business & Finance'],
  },
  {
    name: 'Rich Dad Poor Dad',
    description: "Rich Dad Poor Dad is Robert's story of growing up with two dads — his real father and the father of his best friend, his 'rich dad' — and the ways in which both men shaped his thoughts about money and investing. The book explodes the myth that you need to earn a high income to be rich and explains the difference between working for money and having your money work for you.",
    price: 17.99, isbn: '9781612680194', authors: ['Robert Kiyosaki'], categories: ['Business & Finance'], promotion: 'Summer Sale',
  },
  {
    name: 'The 4-Hour Work Week',
    description: "Forget the old concept of retirement and the rest of the deferred-life plan–there is no need to wait and every reason not to, whether your dream is escaping the rat race, experiencing high-end world travel, earning a monthly five-figure income with zero management, or just living more and working less.",
    price: 19.99, isbn: '9780307465351', authors: ['Timothy Ferriss'], categories: ['Business & Finance'], promotion: 'Staff Picks',
  },
  {
    name: 'Start With Why',
    description: "Why are some people and organizations more inventive, pioneering and successful than others? And why are they able to repeat their success again and again? In business, it doesn't matter what you do, it matters WHY you do it. Start with Why shows that the leaders who've had the greatest influence in the world all think, act, and communicate the same way.",
    price: 18.99, isbn: '9781591846444', authors: ['Simon Sinek'], categories: ['Business & Finance'],
  },
  {
    name: 'The E-Myth Revisited',
    description: "E-Myth stands for Entrepreneurial Myth, the myth that most people who start small businesses are entrepreneurs. In this updated and expanded edition of the 1985 classic, The E-Myth Revisited, Michael Gerber dispels the myths surrounding starting your own business and shows how commonplace assumptions can get in the way of running a business.",
    price: 18.99, isbn: '9780887307287', authors: ['Michael E. Gerber'], categories: ['Business & Finance'],
  },
  {
    name: 'The Hard Thing About Hard Things',
    description: "Ben Horowitz, cofounder of Andreessen Horowitz and one of Silicon Valley's most respected and experienced entrepreneurs, offers essential advice on building and running a startup—practical wisdom for managing the toughest problems business school doesn't cover, based on his popular ben's blog.",
    price: 21.99, isbn: '9780062273208', authors: ['Ben Horowitz'], categories: ['Business & Finance'], promotion: 'Summer Sale',
  },
  {
    name: 'Zero to One',
    description: "The great secret of our time is that there are still uncharted frontiers to explore and new inventions to create. In Zero to One, legendary entrepreneur and investor Peter Thiel shows how we can find singular ways to create those new things. Thiel begins with the contrarian premise that we live in an age of technological stagnation.",
    price: 20.99, isbn: '9780804139021', authors: ['Peter Thiel'], categories: ['Business & Finance'],
  },
  {
    name: 'The Lean Startup',
    description: "Most startups fail. But many of those failures are preventable. The Lean Startup is a new approach being adopted across the globe, changing the way companies are built and new products are launched. Eric Ries defines a startup as an organization dedicated to creating something new under conditions of extreme uncertainty.",
    price: 19.99, isbn: '9780307887894', authors: ['Eric Ries'], categories: ['Business & Finance'], promotion: 'Staff Picks',
  },
  {
    name: 'Shoe Dog',
    description: "In this candid and riveting memoir, for the first time ever, Nike founder and CEO Phil Knight shares the inside story of the company's early days as an intrepid start-up and its evolution into one of the world's most iconic, game-changing, and profitable brands.",
    price: 19.99, isbn: '9781501135927', authors: ['Phil Knight'], categories: ['Business & Finance'],
  },
  {
    name: 'Never Split the Difference',
    description: "After a stint policing the rough streets of Kansas City, Missouri, Chris Voss joined the FBI, where his career as a hostage negotiator brought him face-to-face with a range of criminals, including bank robbers and terrorists. Reaching the pinnacle of his profession, he became the FBI's lead international kidnapping negotiator.",
    price: 19.99, isbn: '9780062407801', authors: ['Chris Voss'], categories: ['Business & Finance'], promotion: 'Summer Sale',
  },
  {
    name: 'Influence: The Psychology of Persuasion',
    description: "In the new edition of this highly acclaimed bestseller, Robert Cialdini—New York Times bestselling author of Pre-Suasion and the seminal expert in the fields of influence and persuasion—explains the psychology of why people say yes and how to apply these insights ethically in business and everyday settings.",
    price: 19.99, isbn: '9780062937650', authors: ['Robert Cialdini'], categories: ['Business & Finance'],
  },
  {
    name: 'Purple Cow',
    description: "You're either a Purple Cow or you're not. You're either remarkable or invisible. Make your choice. What do Apple, Starbucks, Dyson and Cirque du Soleil have in common? They are all Purple Cows. As Seth Godin explains in this iconic text, these companies have one thing in common: they are all remarkable.",
    price: 16.99, isbn: '9781591843177', authors: ['Seth Godin'], categories: ['Business & Finance'], promotion: 'Staff Picks',
  },
  {
    name: 'Hooked: How to Build Habit-Forming Products',
    description: "Hooked is based on Eyal's years of research, consulting, and practical experience. He wrote the book he wished had been available to him as a start-up founder—not abstract theory, but a how-to guide for building better products. Hooked is written for product managers, designers, marketers, start-up founders, and anyone who seeks to understand how products influence our behavior.",
    price: 17.99, isbn: '9781591847786', authors: ['Nir Eyal'], categories: ['Business & Finance'],
  },
  {
    name: 'The Millionaire Next Door',
    description: "The incredible story of America's wealthy—not the flamboyant celebrities we see on television or read about in magazines, but the millionaires next door. Thomas J. Stanley and William D. Danko reveal the surprising characteristics of those people who are quietly and efficiently accumulating wealth in America today.",
    price: 18.99, isbn: '9781589795471', authors: ['Thomas J. Stanley'], categories: ['Business & Finance'], promotion: 'Summer Sale',
  },
  {
    name: 'The Total Money Makeover',
    description: "If you will live like no one else, later you can live like no one else. Build up your money muscles with America's favorite finance coach. Okay, folks, do you want to turn those fat and flabby expenses into a well-toned budget? Do you want to transform your sad and skinny little bank account into a veritable financial muscle man?",
    price: 17.99, isbn: '9781595555274', authors: ['Dave Ramsey'], categories: ['Business & Finance'],
  },
  {
    name: 'Think and Grow Rich',
    description: "This is the original 1937 classic edition of one of the most influential business books ever written. Napoleon Hill's seminal masterpiece Think and Grow Rich has been helping people achieve success, financial and otherwise, for 80 years and more. It remains to this day one of the most enduring self-help books ever written.",
    price: 14.99, isbn: '9781585424337', authors: ['Napoleon Hill'], categories: ['Business & Finance'], promotion: 'Staff Picks',
  },
  {
    name: 'The Psychology of Money',
    description: "Doing well with money isn't necessarily about what you know. It's about how you behave. And behavior is hard to teach, even to really smart people. Money—investing, personal finance, and business decisions—is typically taught as a math-based field, where data and formulas tell us exactly what to do.",
    price: 19.99, isbn: '9780857197689', authors: ['Morgan Housel'], categories: ['Business & Finance'], promotion: 'Summer Sale',
  },
  {
    name: 'Leaders Eat Last',
    description: "In his work with organizations around the world, Simon Sinek noticed that some teams trust each other so deeply that they would literally put their lives on the line for each other. Other teams, no matter what incentives are offered, are dogged by infighting, fragmentation, and failure. Why? The answer became clear during a conversation with a Marine Corps general.",
    price: 19.99, isbn: '9781591848011', authors: ['Simon Sinek'], categories: ['Business & Finance'],
  },

  // Science (12)
  {
    name: 'The Selfish Gene',
    description: "Richard Dawkins' brilliant reformulation of the theory of natural selection has the rare distinction of having provoked as much excitement and interest outside the scientific community as within it. His account of the evolution of life is engagingly written, with an ability to clarify complex ideas without losing their substance or subtlety.",
    price: 18.99, isbn: '9780198788607', authors: ['Richard Dawkins'], categories: ['Science'],
  },
  {
    name: 'Cosmos',
    description: "Cosmos is one of the bestselling science books of all time. In clear-eyed prose, Sagan reveals a jewel-like blue world inhabited by a life form that is just beginning to discover its own identity and to venture into the vast ocean of space. Featuring a new Introduction by Ann Druyan, full color illustrations, and a new Foreword by Neil deGrasse Tyson.",
    price: 22.99, isbn: '9780345539434', authors: ['Carl Sagan'], categories: ['Science'], promotion: 'Staff Picks',
  },
  {
    name: 'Astrophysics for People in a Hurry',
    description: "What is the nature of space and time? How do we fit within the universe? How does the universe fit within us? There's no better guide through these mind-expanding questions than acclaimed astrophysicist and best-selling author Neil deGrasse Tyson. But today, few of us have time to contemplate the cosmos.",
    price: 17.99, isbn: '9780393609394', authors: ['Neil deGrasse Tyson'], categories: ['Science'], promotion: 'Summer Sale',
  },
  {
    name: 'Guns, Germs, and Steel',
    description: "In this Pulitzer Prize-winning book, Jared Diamond convincingly argues that geographical and environmental factors shaped the modern world. Diamond studied how the development of different human civilizations was affected by their environments—particularly by the availability of food plants, animals, and the technological developments that followed.",
    price: 19.99, isbn: '9780393317558', authors: ['Jared Diamond'], categories: ['Science', 'History'],
  },
  {
    name: 'A Short History of Nearly Everything',
    description: "Bill Bryson describes himself as a reluctant traveller, but even when he stays safely at home he can't contain his curiosity about the world around him. A Short History of Nearly Everything is his quest to understand everything that has happened from the Big Bang to the rise of civilization.",
    price: 19.99, isbn: '9780767908184', authors: ['Bill Bryson'], categories: ['Science'], promotion: 'Staff Picks',
  },
  {
    name: 'The Elegant Universe',
    description: "Brian Greene, one of the world's leading string theorists, peels away layers of mystery to reveal a universe that consists of eleven dimensions, where the fabric of space tears and repairs itself, and where the beginning of the universe was not the Big Bang but rather a big splat—the collision of two three-dimensional worlds.",
    price: 19.99, isbn: '9780393338102', authors: ['Brian Greene'], categories: ['Science'],
  },
  {
    name: 'What If?: Serious Scientific Answers to Absurd Hypothetical Questions',
    description: "Randall Munroe, creator of the wildly popular xkcd webcomic, answers the world's most (and least) important questions using the power of science. What if you tried to hit a baseball pitched at 90% the speed of light? What would happen if you made a periodic table out of cube-shaped bricks, with each brick made of the corresponding element? What would happen if the Earth and all terrestrial objects suddenly stopped spinning?",
    price: 17.99, isbn: '9780544272996', authors: ['Randall Munroe'], categories: ['Science'], promotion: 'Summer Sale',
  },
  {
    name: 'The Emperor of All Maladies',
    description: "The Emperor of All Maladies is a magnificent, profoundly humane 'biography' of cancer—from its first documented appearances thousands of years ago through the modern era of genome-based cyber-attacks on malignant cells—written by an oncologist and researcher at the Memorial Sloan-Kettering Cancer Center.",
    price: 21.99, isbn: '9781439170915', authors: ['Siddhartha Mukherjee'], categories: ['Science'],
  },
  {
    name: 'The Gene: An Intimate History',
    description: "In The Gene, Siddhartha Mukherjee describes in riveting and dramatic detail the quest to understand human heredity and its consequences. After tracing a story that begins long before Aristotle and ends with the startling possibilities of what Mukherjee calls 'the post-genomic world,' he reveals that understanding the gene—the basic unit of heredity—will allow us to re-examine the most fundamental questions of existence.",
    price: 21.99, isbn: '9781476733500', authors: ['Siddhartha Mukherjee'], categories: ['Science'], promotion: 'Staff Picks',
  },
  {
    name: "Surely You're Joking, Mr. Feynman!",
    description: "Richard Feynman, winner of the Nobel Prize in physics, thrived on outrageous adventure. Here he recounts in his inimitable voice his experience trading ideas on atomic physics with Einstein and Bohr and ideas on gambling with Nick the Greek; cracking the uncrackable safes guarding the most deeply held nuclear secrets; accompanying a ballet dancer as she learns to handle her bra.",
    price: 17.99, isbn: '9780393316049', authors: ['Richard Feynman'], categories: ['Science'], promotion: 'Summer Sale',
  },
  {
    name: 'Being Mortal: Medicine and What Matters in the End',
    description: "Medicine has triumphed in modern times, transforming birth, injury, and infectious disease from harrowing to manageable. But in the inevitable condition of aging and death, the goals of medicine seem too frequently to run counter to the interest of the patients themselves. Renowned writer and surgeon Atul Gawande tackles the hardest challenge of his profession.",
    price: 17.99, isbn: '9780805095159', authors: ['Atul Gawande'], categories: ['Science'],
  },
  {
    name: 'The Coming Plague',
    description: "In The Coming Plague, a gripping account of scientists in a race against time, Pulitzer Prize-winning journalist Laurie Garrett details the emergence of new epidemics and the worldwide failure to prepare defenses against them. Garrett's work paints a portrait of a borderless world where super-microbes are on the loose and resistant to all known drugs.",
    price: 19.99, isbn: '9780140250916', authors: ['Laurie Garrett'], categories: ['Science'], promotion: 'Staff Picks',
  },

  // History (11)
  {
    name: 'The Diary of a Young Girl',
    description: "Discovered in the attic in which she spent the last years of her life, Anne Frank's remarkable diary has become a world classic—a powerful reminder of the horrors of war and an eloquent testament to the human spirit. In 1942, with Nazis occupying Holland, a thirteen-year-old Jewish girl and her family fled their home in Amsterdam and went into hiding for the next two years.",
    price: 12.99, isbn: '9780553577129', authors: ['Anne Frank'], categories: ['History', 'Biography'],
  },
  {
    name: 'The Wright Brothers',
    description: "On a winter day in 1903, in the Outer Banks of North Carolina, two brothers—bicycle mechanics from Dayton, Ohio—changed history. But it would take the world some time to believe what had happened: the age of flight had begun, with the first heavier-than-air, powered machine carrying a pilot.",
    price: 18.99, isbn: '9781476728742', authors: ['David McCullough'], categories: ['History'], promotion: 'Summer Sale',
  },
  {
    name: 'Team of Rivals',
    description: "Acclaimed historian Doris Kearns Goodwin illuminates Abraham Lincoln's political genius in this highly original work, as the one-term congressman and prairie lawyer rises from obscurity to prevail over three gifted rivals of national reputation to become president.",
    price: 22.99, isbn: '9780743270755', authors: ['Doris Kearns Goodwin'], categories: ['History'], promotion: 'Staff Picks',
  },
  {
    name: 'The Devil in the White City',
    description: "The incredible true story of a brilliant architect and a charming serial killer at the 1893 World's Fair in Chicago. The White City refers to the 1893 World's Columbian Exposition, held in Chicago. Erik Larson narrates two parallel stories: the building of the 1893 Chicago World's Fair and the gruesome murders committed by Dr. H. H. Holmes.",
    price: 17.99, isbn: '9780375725609', authors: ['Erik Larson'], categories: ['History', 'Mystery & Thriller'],
  },
  {
    name: 'Unbroken',
    description: "On a May afternoon in 1943, an Army Air Forces bomber crashed into the Pacific Ocean and disappeared, leaving only a spray of debris and a slick of oil, gasoline, and blood. Then, on the ocean surface, a face appeared. It was that of a young lieutenant, the plane's bombardier, who was not expected to survive.",
    price: 17.99, isbn: '9780812974492', authors: ['Laura Hillenbrand'], categories: ['History', 'Biography'], promotion: 'Summer Sale',
  },
  {
    name: 'Dead Wake',
    description: "From the bestselling author and master of narrative nonfiction comes the enthralling story of the sinking of the Lusitania. On May 1, 1915, with WWI embroiling Europe, the Lusitania left New York City bound for Liverpool, England. Aboard was a record 1,959 people—an array of first-class millionaires, immigrants, and a German spy.",
    price: 17.99, isbn: '9780307408860', authors: ['Erik Larson'], categories: ['History'],
  },
  {
    name: '1776',
    description: "Pulitzer Prize-winning historian David McCullough tells the story of the year of the American Revolution. 1776 is the story of the men who marched with General George Washington in the year of the Revolution—the rebels who fought for the ideals expressed in the Declaration of Independence.",
    price: 17.99, isbn: '9780743226721', authors: ['David McCullough'], categories: ['History'], promotion: 'Staff Picks',
  },
  {
    name: 'The Rise and Fall of the Third Reich',
    description: "The most important—and most sobering—history of the Nazi nightmare ever assembled. William L. Shirer, a journalist and broadcaster who spent much of the 1930s in Germany, drew on his own experiences, as well as a vast array of captured Nazi documents, to produce this monumental work.",
    price: 24.99, isbn: '9781451651683', authors: ['Doris Kearns Goodwin'], categories: ['History'],
  },
  {
    name: 'The Warmth of Other Suns',
    description: "An epic, beautifully written masterwork, The Warmth of Other Suns tells the story of the Great Migration, in which six million Black citizens escaped the Jim Crow South for northern and western cities. The migration lasted from 1915 to 1970—nearly six decades of people fleeing for their lives in secret.",
    price: 20.99, isbn: '9780679763888', authors: ['Laura Hillenbrand'], categories: ['History'], promotion: 'Summer Sale',
  },
  {
    name: 'Longitude',
    description: "The dramatic story of a clockmaker who solved the greatest scientific problem of his time. Anyone alive in the eighteenth century would have known that 'the longitude problem' was the greatest scientific challenge of the day—and had been for centuries. Lacking the ability to measure their longitude, sailors throughout the great age of exploration had been literally lost at sea.",
    price: 14.99, isbn: '9780802715296', authors: ['Dava Sobel'], categories: ['History', 'Science'],
  },
  {
    name: 'Killers of the Flower Moon',
    description: "In the 1920s, the Osage Indian nation of Oklahoma was considered the wealthiest people per capita in the world. Then oil was discovered beneath their land, and a reign of terror began. Dozens of Osage people were murdered, and the newly created FBI undertook what became one of the most important homicide investigations in the history of the agency.",
    price: 19.99, isbn: '9780385541794', authors: ['David Grann'], categories: ['History'], promotion: 'Staff Picks',
  },

  // Biography (12)
  {
    name: 'Long Walk to Freedom',
    description: "The autobiography of Nelson Mandela is the story of a black man who grew up a chief's son in rural South Africa and became the nation's first democratically elected president. But above all it is a story of the triumph of the human spirit against the most extreme adversities.",
    price: 19.99, isbn: '9780316548182', authors: ['Nelson Mandela'], categories: ['Biography', 'History'],
  },
  {
    name: 'Born a Crime',
    description: "The compelling, inspiring, and comically sublime story of one man's coming-of-age, set during the twilight of apartheid and the tumultuous days of freedom that followed. Trevor Noah's unlikely path from apartheid South Africa to the desk of The Daily Show began with a criminal act: his birth.",
    price: 17.99, isbn: '9780399588174', authors: ['Trevor Noah'], categories: ['Biography'], promotion: 'Summer Sale',
  },
  {
    name: 'Becoming',
    description: "In her memoir, a work of deep reflection and mesmerizing storytelling, Michelle Obama invites readers into her world, chronicling the experiences that have shaped her—from her childhood on the South Side of Chicago to her years as an executive balancing the demands of motherhood and work, to her time spent at the world's most famous address.",
    price: 19.99, isbn: '9781524763138', authors: ['Michelle Obama'], categories: ['Biography'], promotion: 'Staff Picks',
  },
  {
    name: 'Educated',
    description: "Tara Westover was 17 the first time she set foot in a classroom. Born to survivalists in the mountains of Idaho, she prepared for the end of the world by stockpiling home-canned peaches and sleeping with her 'head-for-the-hills bag.' In the summer, she stewed herbs for her mother, a midwife and healer, and worked with her father in his junkyard.",
    price: 17.99, isbn: '9780399590504', authors: ['Tara Westover'], categories: ['Biography'],
  },
  {
    name: 'When Breath Becomes Air',
    description: "At the age of thirty-six, on the verge of completing a decade's worth of training as a neurosurgeon, Paul Kalanithi was diagnosed with stage IV lung cancer. One day he was a doctor treating the dying, and the next he was a patient struggling to live. And just like that, the future he and his wife had imagined evaporated.",
    price: 16.99, isbn: '9780812988406', authors: ['Paul Kalanithi'], categories: ['Biography'], promotion: 'Summer Sale',
  },
  {
    name: 'I Know Why the Caged Bird Sings',
    description: "Here is a book as joyous and painful, as mysterious and memorable, as childhood itself. I Know Why the Caged Bird Sings captures the longing of lonely children, the brute insult of bigotry, and the wonder of words that can make the world right. Maya Angelou's debut memoir is a modern American classic beloved worldwide.",
    price: 14.99, isbn: '9780345514400', authors: ['Maya Angelou'], categories: ['Biography'],
  },
  {
    name: 'The Glass Castle',
    description: "A riveting memoir of a family on the move. Jeannette Walls grew up with parents whose ideals and stubborn nonconformity were both their curse and their salvation. Rex and Rose Mary Walls had four children. In the beginning, they lived like nomads, moving among Southwest desert towns, camping in the mountains.",
    price: 16.99, isbn: '9780743247542', authors: ['Jeannette Walls'], categories: ['Biography'], promotion: 'Staff Picks',
  },
  {
    name: 'Open',
    description: "Andre Agassi, one of the most beloved athletes in history and one of the most gifted men ever to step onto a tennis court, tells his story for the first time. Agassi's autobiography is startling, honest, and moving. He describes a childhood of obsessive focus on tennis, imposed by his moody, demanding father.",
    price: 17.99, isbn: '9780307388407', authors: ['Andre Agassi'], categories: ['Biography'],
  },
  {
    name: 'Hillbilly Elegy',
    description: "From a former marine and Yale Law School graduate, a powerful account of growing up in a poor Rust Belt town that offers a broader, probing look at the struggles of America's white working class. Part memoir, part historical and social analysis, J.D. Vance's Hillbilly Elegy is a fascinating self-portrait of a family and culture in crisis.",
    price: 17.99, isbn: '9780062300546', authors: ['J.D. Vance'], categories: ['Biography'], promotion: 'Summer Sale',
  },
  {
    name: 'Alexander Hamilton',
    description: "Pulitzer Prize-winning author Ron Chernow tells the riveting story of a man who overcame all odds to shape, inspire, and scandalize the newborn America. According to historian Joseph Ellis, Alexander Hamilton is a biography that's in a class by itself. Few figures in American history have aroused such visceral love and hatred as Alexander Hamilton.",
    price: 22.99, isbn: '9780143034759', authors: ['Ron Chernow'], categories: ['Biography', 'History'],
  },
  {
    name: 'Churchill: A Life',
    description: "Churchill: A Life by Martin Gilbert is considered the definitive single-volume biography of Sir Winston Churchill. Based on a lifetime's study of Churchill's personal papers and public records, it chronicles both his public and private life. Churchill's sixty years in the center of events brought him into contact with almost every world leader in the first half of the twentieth century.",
    price: 24.99, isbn: '9780805000894', authors: ['Martin Gilbert'], categories: ['Biography', 'History'], promotion: 'Staff Picks',
  },
  {
    name: 'Into the Wild',
    description: "In April 1992, a young man from a well-to-do family hitchhiked to Alaska and walked alone into the wilderness north of Mt. McKinley. His name was Christopher McCandless. He had given $25,000 in savings to charity, abandoned his car and most of his possessions, burned all the cash in his wallet, and invented a new life for himself.",
    price: 15.99, isbn: '9780385486804', authors: ['Jon Krakauer'], categories: ['Biography'], promotion: 'Summer Sale',
  },
];

// ─── Review templates by category ─────────────────────────────────────────

const REVIEWS: Record<string, { star: number; title: string; content: string }[]> = {
  Fiction: [
    { star: 5, title: 'A timeless masterpiece', content: 'This book has stayed with me long after I finished it. The characters feel real and the story is deeply moving.' },
    { star: 5, title: 'Absolutely captivating', content: 'I could not put this book down. The prose is beautiful and the plot is gripping from beginning to end.' },
    { star: 4, title: 'Beautifully written', content: 'A wonderful piece of literature. The author has a gift for storytelling and the themes resonate deeply.' },
    { star: 4, title: 'A great read', content: 'Really enjoyed this one. Some slow moments but overall a satisfying and thought-provoking story.' },
    { star: 3, title: 'Good but not for everyone', content: 'The writing is technically excellent but the pacing felt slow at times. Worth reading if you enjoy literary fiction.' },
  ],
  'Mystery & Thriller': [
    { star: 5, title: 'Couldn\'t put it down', content: 'One of the most gripping thrillers I\'ve ever read. The twists kept coming and the ending blew my mind.' },
    { star: 5, title: 'Perfect page-turner', content: 'Devoured this in one sitting. Every chapter ends with a hook that makes you keep reading.' },
    { star: 4, title: 'Great suspense', content: 'Well-crafted mystery with memorable characters. The tension builds perfectly throughout the story.' },
    { star: 4, title: 'Kept me guessing', content: 'Clever plot with satisfying twists. Some predictable moments but overall an excellent thriller.' },
    { star: 3, title: 'Decent thriller', content: 'Enjoyable read with some genuinely surprising moments. The ending felt slightly rushed though.' },
  ],
  'Self-Help': [
    { star: 5, title: 'Life-changing insights', content: 'This book genuinely changed how I think and act. The advice is practical and immediately applicable to daily life.' },
    { star: 5, title: 'Must-read for everyone', content: 'Highly recommend to anyone looking to improve themselves. Full of actionable tips backed by real research.' },
    { star: 4, title: 'Very practical', content: 'Lots of useful frameworks and techniques. I\'ve already started implementing the advice and seeing results.' },
    { star: 4, title: 'Solid self-help book', content: 'Good content overall. Some ideas aren\'t new but the way they\'re presented makes them feel fresh and applicable.' },
    { star: 3, title: 'Has some good points', content: 'Decent book with some useful ideas. A bit repetitive in places but the core message is valuable.' },
  ],
  'Business & Finance': [
    { star: 5, title: 'Essential business reading', content: 'Every entrepreneur and professional should read this. The insights are profound and directly applicable to business.' },
    { star: 5, title: 'Changed my perspective on money', content: 'This book reshaped how I think about wealth and investing. Clear, concise, and deeply insightful.' },
    { star: 4, title: 'Very informative', content: 'Packed with valuable information. The real-world examples make complex concepts easy to understand.' },
    { star: 4, title: 'Great business insights', content: 'Well-researched and thoughtfully written. Applied several of the frameworks at work already.' },
    { star: 3, title: 'Good introduction', content: 'A solid overview of the topic. Some sections felt dated but the core principles remain relevant.' },
  ],
  Science: [
    { star: 5, title: 'Fascinating and accessible', content: 'Makes complex scientific concepts approachable and exciting. I came away with a much deeper understanding of the world.' },
    { star: 5, title: 'Mind-expanding', content: 'Brilliant book that truly expands your mind. The author has a rare gift for explaining difficult ideas clearly.' },
    { star: 4, title: 'Great science writing', content: 'Well-written and thoroughly researched. Some technical sections require concentration but it\'s worth the effort.' },
    { star: 4, title: 'Highly educational', content: 'Learned so much from this book. The author presents information in an engaging and memorable way.' },
    { star: 3, title: 'Interesting but dense', content: 'Contains fascinating information but can be quite dense in places. Best read slowly to absorb the ideas.' },
  ],
  History: [
    { star: 5, title: 'History brought to life', content: 'This book makes history feel vivid and immediate. The research is impeccable and the storytelling is superb.' },
    { star: 5, title: 'Absolutely riveting', content: 'Reads like a novel despite being meticulously documented history. Could not put it down.' },
    { star: 4, title: 'Well-researched', content: 'A thorough and engaging account. The author brings real depth and nuance to a complex historical period.' },
    { star: 4, title: 'Eye-opening', content: 'Learned things I never knew about this period of history. Really changed my understanding of the era.' },
    { star: 3, title: 'Informative but slow', content: 'Dense with information and well-researched, but the pacing can drag in places. Worth persisting with.' },
  ],
  Biography: [
    { star: 5, title: 'Deeply inspiring', content: 'This memoir is incredibly moving. Reading about this person\'s journey left me both humbled and motivated.' },
    { star: 5, title: 'Honest and powerful', content: 'A remarkably candid account of an extraordinary life. The writing is beautiful and the story is unforgettable.' },
    { star: 4, title: 'Fascinating life story', content: 'Thoroughly engaging biography. You come away feeling like you truly understand this person.' },
    { star: 4, title: 'Highly recommended', content: 'A well-told story with great insight into both the person and the times they lived in.' },
    { star: 3, title: 'Good but not great', content: 'An interesting life told competently. Some parts felt repetitive but overall a worthwhile read.' },
  ],
};

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n📚 seed-more-books: Adding 100 more books to existing database...\n');

  // 1. Load existing data
  console.log('🔍 Loading existing database state...');
  const existingCategories = await prisma.category.findMany();
  const categoryMap = new Map(existingCategories.map((c) => [c.name, c.id]));
  console.log(`    Found ${existingCategories.length} categories`);

  const existingAuthors = await prisma.author.findMany();
  const authorMap = new Map(existingAuthors.map((a) => [a.name, a.id]));
  console.log(`    Found ${existingAuthors.length} existing authors`);

  const existingPromotions = await prisma.promotionList.findMany();
  const promotionMap = new Map(existingPromotions.map((p) => [p.name, p]));
  console.log(`    Found ${existingPromotions.length} promotions`);

  const existingCustomers = await prisma.user.findMany({ where: { role: 'user' }, select: { id: true } });
  const customerIds = existingCustomers.map((u) => u.id);
  console.log(`    Found ${customerIds.length} customer accounts for reviews`);

  const existingBooks = await prisma.book.findMany({ select: { name: true } });
  const existingBookNames = new Set(existingBooks.map((b) => b.name));
  console.log(`    Found ${existingBooks.length} existing books (will skip duplicates)\n`);

  // 2. Create new authors that don't already exist
  console.log('👤 Creating new authors (skipping existing)...');
  let authorsCreated = 0;
  for (const a of NEW_AUTHORS) {
    if (authorMap.has(a.name)) continue;
    const avatarUrl = `https://i.pravatar.cc/300?img=${a.avatarImg}`;
    const image = await fetchAndUpload(avatarUrl, 'author', `${a.name}.jpg`);
    const author = await prisma.author.create({ data: { name: a.name, image } });
    await prisma.author.update({ where: { id: author.id }, data: { slug: `${makeSlug(a.name)}_${author.id}` } });
    authorMap.set(a.name, author.id);
    authorsCreated++;
  }
  console.log(`    Created ${authorsCreated} new authors\n`);

  // 3. Create books
  console.log('📖 Creating books...\n');
  let bookCount = 0;
  const newBookIds: number[] = [];

  for (const b of BOOKS) {
    if (existingBookNames.has(b.name)) {
      console.log(`    ⏭  Skipping (already exists): ${b.name}`);
      continue;
    }

    bookCount++;
    const coverUrl = `https://covers.openlibrary.org/b/isbn/${b.isbn}-L.jpg`;
    const cover = await fetchAndUpload(coverUrl, 'book', `${b.isbn}.jpg`);

    const promo = b.promotion ? promotionMap.get(b.promotion) : undefined;
    const discount = promo?.discountPercentage ?? 0;
    const finalPrice = parseFloat((b.price * (1 - discount / 100)).toFixed(2));
    const discountDate = promo ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null;

    const book = await prisma.book.create({
      data: {
        name: b.name,
        description: b.description,
        image: cover,
        price: b.price,
        finalPrice,
        discountPercentage: discount,
        ...(discountDate && { discountDate }),
        ...(promo && { promotionListId: promo.id }),
      },
    });
    await prisma.book.update({ where: { id: book.id }, data: { slug: `${makeSlug(b.name)}_${book.id}` } });
    newBookIds.push(book.id);

    // Junction records
    for (const authorName of b.authors) {
      const authorId = authorMap.get(authorName);
      if (authorId) await prisma.bookAuthor.create({ data: { bookId: book.id, authorId } });
    }
    for (const catName of b.categories) {
      const categoryId = categoryMap.get(catName);
      if (categoryId) await prisma.bookCategory.create({ data: { bookId: book.id, categoryId } });
    }

    // Reviews (3–5 per book)
    if (customerIds.length > 0) {
      const primaryCategory = b.categories[0];
      const templates = REVIEWS[primaryCategory] ?? REVIEWS['Fiction'];
      const reviewCount = 3 + (bookCount % 3); // 3, 4, or 5
      for (let i = 0; i < reviewCount && i < templates.length; i++) {
        const userId = customerIds[i % customerIds.length];
        const tmpl = templates[i];
        await prisma.ratingReview.create({
          data: { bookId: book.id, userId, star: tmpl.star, title: tmpl.title, content: tmpl.content },
        });
      }
    }

    console.log(`[${bookCount}/100] Uploaded: ${b.name}`);
  }

  // 4. Recompute avgStars and totalReviews for all affected books
  if (newBookIds.length > 0) {
    console.log('\n🔄 Recomputing review aggregates...');
    const reviewAggs = await prisma.ratingReview.groupBy({
      by: ['bookId'],
      where: { bookId: { in: newBookIds } },
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
    console.log(`    Updated review stats for ${reviewAggs.length} books`);
  }

  console.log(`\n✅ Done! Added ${bookCount} new books to the database.\n`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
