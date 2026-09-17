import { readFile, writeFile } from 'node:fs/promises';

const queuePath = new URL('../content/autobot-queue.json', import.meta.url);
const feedPath = new URL('../data/public-feed.json', import.meta.url);
const queue = JSON.parse(await readFile(queuePath, 'utf8'));
const feed = JSON.parse(await readFile(feedPath, 'utf8'));
const publishedIds = new Set((feed.posts || []).map(post => post.id));
const next = queue.find(post => !publishedIds.has(post.id));

if (!next) {
  console.log('Autobot queue is empty. No post published.');
  process.exit(0);
}

const publishedAt = new Date().toISOString();
feed.updatedAt = publishedAt;
feed.posts = [{ ...next, publishedAt }, ...(feed.posts || [])].slice(0, 30);
await writeFile(feedPath, `${JSON.stringify(feed, null, 2)}\n`);
console.log(`Autobot published: ${next.id}`);
