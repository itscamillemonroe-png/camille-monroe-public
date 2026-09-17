const fallbackPosts = [
  {
    type: 'Today with Camille',
    title: 'Giving this space the attention it deserves.',
    body: 'I’m putting the finishing touches on my new home and feed today—cleaner, closer, and much easier to keep up with. This is where I’ll leave the updates that matter.',
    time: 'Today',
    access: 'Public note'
  },
  {
    type: 'From the blog',
    title: 'Why I’m bringing everything under one roof.',
    body: 'Social apps move fast. I wanted one place where you can catch a longer thought, a quick check-in, and the next member drop without chasing me across five different timelines.',
    time: 'This week',
    access: '3 min read'
  },
  {
    type: 'Teaser',
    title: 'Black lace won tonight.',
    body: 'The look is picked. The lighting is warm. I’m keeping the rest behind Member Access—but I’ll leave just enough here to keep you curious.',
    time: 'Tonight',
    access: 'Preview'
  },
  {
    type: 'Quick post',
    title: 'A soft check-in between edits.',
    body: 'I’ve been organizing the next set, tightening the details, and deciding what deserves a full blog versus a little note. Consider this the little note.',
    time: 'Recently',
    access: 'Public note'
  },
  {
    type: 'Members next',
    title: 'The full experience stays close.',
    body: 'Members get the complete posts, private releases, and access updates in the same clean feed—no bouncing around, no guessing where to look.',
    time: 'Coming next',
    access: 'Member preview',
    cta: true
  }
];

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
}

function postTemplate(post, index) {
  const hasLink = Boolean(post.href || post.cta === true);
  const linkText = typeof post.cta === 'string' ? post.cta : 'Open Member Access';
  const callToAction = hasLink ? `<a class="postCta" href="${escapeHtml(post.href || '/login/')}">${escapeHtml(linkText)} →</a>` : '';
  const dateLabel = post.publishedAt
    ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(post.publishedAt))
    : post.time;
  return `<article class="feedPost ${index === 0 ? 'teaserPost' : ''}">
    <div class="postTopline"><span>${escapeHtml(post.category || post.type)}</span><small>${escapeHtml(dateLabel)}</small></div>
    <h3>${escapeHtml(post.title)}</h3>
    <p>${escapeHtml(post.body)}</p>
    <div class="postFoot"><span>${escapeHtml(post.access || 'Public note')}</span>${callToAction}</div>
  </article>`;
}

async function loadFeed() {
  try {
    const response = await fetch('/data/public-feed.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Feed request failed: ${response.status}`);
    const payload = await response.json();
    return Array.isArray(payload.posts) && payload.posts.length ? payload.posts : fallbackPosts;
  } catch (error) {
    console.warn('Autobot feed fallback in use.', error);
    return fallbackPosts;
  }
}

const publicFeed = document.querySelector('#publicFeed');
if (publicFeed) loadFeed().then(posts => { publicFeed.innerHTML = posts.map(postTemplate).join(''); });
