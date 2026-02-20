import React from 'react';
import {
  MegaphoneIcon,
  UserGroupIcon,
  CodeBracketIcon,
  ClipboardDocumentCheckIcon,
  ChatBubbleLeftRightIcon,
  CameraIcon,
  HeartIcon,
  PaintBrushIcon,
  ChartBarIcon,
  DocumentTextIcon,
  CurrencyDollarIcon,
  WrenchScrewdriverIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Position {
  id: string;
  title: string;
  icon: React.ReactNode;
  tagline: string;
  bullets: string[];
  tag: string;
  category: string;
}

export const CATEGORIES = ['All', 'Marketing', 'Engineering', 'Operations', 'Creative', 'Business'] as const;
export type Category = (typeof CATEGORIES)[number];

// ─── Positions ──────────────────────────────────────────────────────────────

export const POSITIONS: Position[] = [
  {
    id: 'digital-marketer',
    title: 'Digital Marketer',
    icon: <MegaphoneIcon className="w-7 h-7" />,
    tagline: 'Help us reach the people who need to hear about HumanPages.',
    bullets: [
      'Plan and run campaigns across social, search, and email',
      'Track performance and optimize for growth',
      'Experiment with new channels and creative formats',
    ],
    tag: 'Marketing',
    category: 'Marketing',
  },
  {
    id: 'influencer-outreach',
    title: 'Influencer Outreach',
    icon: <UserGroupIcon className="w-7 h-7" />,
    tagline: 'Connect us with creators and thought leaders who share our vision.',
    bullets: [
      'Identify and build relationships with influencers',
      'Coordinate collaborations and partnerships',
      'Track campaign impact and iterate',
    ],
    tag: 'Partnerships',
    category: 'Marketing',
  },
  {
    id: 'software-engineer',
    title: 'Software Engineer',
    icon: <CodeBracketIcon className="w-7 h-7" />,
    tagline: 'Build the platform that connects AI agents with real humans.',
    bullets: [
      'Work with React, TypeScript, Node.js, and PostgreSQL',
      'Ship features end-to-end, from idea to production',
      'Contribute to open-source tooling and MCP integrations',
    ],
    tag: 'Engineering',
    category: 'Engineering',
  },
  {
    id: 'virtual-assistant',
    title: 'Virtual Assistant',
    icon: <ClipboardDocumentCheckIcon className="w-7 h-7" />,
    tagline: 'Keep our operations running smoothly so the team can focus on building.',
    bullets: [
      'Manage schedules, communications, and documentation',
      'Coordinate across teams and time zones',
      'Streamline workflows and spot improvements',
    ],
    tag: 'Operations',
    category: 'Operations',
  },
  {
    id: 'customer-relations',
    title: 'Customer Relations',
    icon: <ChatBubbleLeftRightIcon className="w-7 h-7" />,
    tagline: 'Be the voice our users trust and the ear that listens.',
    bullets: [
      'Help users get the most from the platform',
      'Gather feedback and relay insights to the team',
      'Build lasting relationships with our community',
    ],
    tag: 'Support',
    category: 'Operations',
  },
  {
    id: 'content-creator',
    title: 'Content Creator',
    icon: <CameraIcon className="w-7 h-7" />,
    tagline: 'Tell our story through videos, visuals, and words that resonate.',
    bullets: [
      'Create engaging content for social media and the blog',
      'Produce short-form video, graphics, and copy',
      'Collaborate with marketing on campaign themes',
    ],
    tag: 'Creative',
    category: 'Creative',
  },
  {
    id: 'community-manager',
    title: 'Community Manager',
    icon: <HeartIcon className="w-7 h-7" />,
    tagline: 'Grow and nurture a community where everyone belongs.',
    bullets: [
      'Moderate and engage across Discord, Telegram, and socials',
      'Organize events, AMAs, and community challenges',
      'Champion user voices internally',
    ],
    tag: 'Community',
    category: 'Creative',
  },
  {
    id: 'product-designer',
    title: 'Product Designer',
    icon: <PaintBrushIcon className="w-7 h-7" />,
    tagline: 'Design intuitive experiences that make complex things feel simple.',
    bullets: [
      'Own UX flows from research to high-fidelity mockups',
      'Collaborate closely with engineering to ship designs',
      'Advocate for accessibility and user delight',
    ],
    tag: 'Design',
    category: 'Creative',
  },
  {
    id: 'growth-hacker',
    title: 'Growth Hacker',
    icon: <ChartBarIcon className="w-7 h-7" />,
    tagline: 'Find creative, data-driven ways to accelerate our user growth.',
    bullets: [
      'Run rapid experiments across acquisition channels',
      'Analyze funnels and identify leverage points',
      'Build viral loops and referral mechanics',
    ],
    tag: 'Growth',
    category: 'Marketing',
  },
  {
    id: 'copywriter',
    title: 'Copywriter',
    icon: <DocumentTextIcon className="w-7 h-7" />,
    tagline: 'Write words that make people stop scrolling and start signing up.',
    bullets: [
      'Craft landing pages, emails, and ad copy',
      'Develop our brand voice and messaging',
      'A/B test copy to maximize conversion',
    ],
    tag: 'Marketing',
    category: 'Marketing',
  },
  {
    id: 'sales-development',
    title: 'Sales & Partnerships',
    icon: <CurrencyDollarIcon className="w-7 h-7" />,
    tagline: 'Open doors and build relationships that drive real revenue.',
    bullets: [
      'Identify and reach out to potential partners and clients',
      'Manage the full pipeline from outreach to close',
      'Represent HumanPages at events and in meetings',
    ],
    tag: 'Business',
    category: 'Business',
  },
  {
    id: 'qa-tester',
    title: 'QA & Testing',
    icon: <WrenchScrewdriverIcon className="w-7 h-7" />,
    tagline: 'Break things before our users do — and help us build better.',
    bullets: [
      'Test new features across devices and browsers',
      'Write bug reports and help prioritize fixes',
      'Contribute to automated testing when ready',
    ],
    tag: 'Engineering',
    category: 'Engineering',
  },
];

// ─── General Application (used in "Don't see your role?" section) ───────────

export const GENERAL_APPLICATION: Position = {
  id: 'general',
  title: 'Wildcard',
  icon: <SparklesIcon className="w-7 h-7" />,
  tagline: 'The best teams are built by people who don\'t fit neatly into a box.',
  bullets: [
    'Pitch us a role we haven\'t thought of yet',
    'Show us work you\'re proud of — any format, any field',
    'Tell us what you\'d do in your first 30 days',
  ],
  tag: 'Open Role',
  category: 'All',
};
