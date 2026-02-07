import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from './mocks';
import NotFound from '../pages/NotFound';

describe('NotFound', () => {
  it('renders 404 text', () => {
    renderWithProviders(<NotFound />);

    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByText('notFound.title')).toBeInTheDocument();
    expect(screen.getByText('notFound.message')).toBeInTheDocument();
  });

  it('has a link to home page', () => {
    renderWithProviders(<NotFound />);

    const homeLink = screen.getByRole('link', { name: /notFound.goHome/i });
    expect(homeLink).toBeInTheDocument();
    expect(homeLink).toHaveAttribute('href', '/');
  });
});
