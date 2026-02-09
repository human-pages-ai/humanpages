export const SOCIAL_LINKS = [
  { name: 'Instagram', href: 'https://www.instagram.com/HumanPagesAI' },
  { name: 'X', href: 'https://x.com/HumanPagesAI' },
  { name: 'Facebook', href: 'https://facebook.com/HumanPagesAI' },
  { name: 'Reddit', href: 'https://www.reddit.com/user/HumanPages' },
] as const;

export const SOCIAL_URLS = SOCIAL_LINKS.map((link) => link.href);
