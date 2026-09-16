const feedPosts = [
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
  const callToAction = post.cta ? '<a class="postCta" href="/login/">Open Member Access →</a>' : '';
  return `<article class="feedPost ${index === 2 ? 'teaserPost' : ''}">
    <div class="postTopline"><span>${escapeHtml(post.type)}</span><small>${escapeHtml(post.time)}</small></div>
    <h3>${escapeHtml(post.title)}</h3>
    <p>${escapeHtml(post.body)}</p>
    <div class="postFoot"><span>${escapeHtml(post.access)}</span>${callToAction}</div>
  </article>`;
}

const publicFeed = document.querySelector('#publicFeed');
if (publicFeed) publicFeed.innerHTML = feedPosts.map(postTemplate).join('');
