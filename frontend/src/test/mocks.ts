import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { ReactElement } from 'react';
import React from 'react';
import { FeedbackProvider } from '../hooks/useFeedback';

function AllProviders({ children }: { children: React.ReactNode }) {
  return React.createElement(HelmetProvider, null,
    React.createElement(BrowserRouter, null,
      React.createElement(FeedbackProvider, null, children)
    )
  );
}

export function renderWithProviders(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, { wrapper: AllProviders, ...options });
}

export const mockProfile = {
  id: 'test-id',
  name: 'Test User',
  email: 'test@example.com',
  username: 'testuser',
  bio: 'Test bio',
  location: 'San Francisco',
  skills: ['react', 'typescript'],
  equipment: [],
  languages: [],
  contactEmail: 'test@example.com',
  telegram: '@testuser',
  isAvailable: true,
  linkedinUrl: '',
  twitterUrl: '',
  githubUrl: '',
  instagramUrl: '',
  youtubeUrl: '',
  websiteUrl: '',
  wallets: [],
  fiatPaymentMethods: [],
  services: [],
  referralCode: 'TEST123',
  referralCount: 0,
  minOfferPrice: undefined,
  maxOfferDistance: undefined,
  minRateUsdc: undefined,
};
