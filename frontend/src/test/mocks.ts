import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ReactElement } from 'react';
import React from 'react';

function AllProviders({ children }: { children: React.ReactNode }) {
  return React.createElement(BrowserRouter, null, children);
}

export function renderWithProviders(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, { wrapper: AllProviders, ...options });
}

export const mockProfile = {
  id: 'test-id',
  name: 'Test User',
  email: 'test@example.com',
  bio: 'Test bio',
  location: 'San Francisco',
  skills: ['react', 'typescript'],
  contactEmail: 'test@example.com',
  telegram: '@testuser',
  isAvailable: true,
  wallets: [],
  services: [],
  referralCode: 'ABC123',
  referralCount: 0,
};
