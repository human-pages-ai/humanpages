export const SOCIAL_LINKS = [
  { name: 'Instagram', href: 'https://www.instagram.com/HumanPages.AI' },
  { name: 'X', href: 'https://x.com/HumanPagesAI' },
  { name: 'Facebook', href: 'https://facebook.com/HumanPagesAI' },
  { name: 'Reddit', href: 'https://www.reddit.com/user/HumanPagesAI/' },
  { name: 'GitHub', href: 'https://github.com/human-pages-ai/humanpages' },
  { name: 'Linktree', href: 'https://linktr.ee/HumanPagesAI' },
] as const;

export const SOCIAL_URLS = SOCIAL_LINKS.map((link) => link.href);
