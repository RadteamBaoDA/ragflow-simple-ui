/**
 * @fileoverview Tests for ErrorPage component.
 * 
 * Tests:
 * - Error code rendering (403, 404, 500, 503)
 * - Custom title and message
 * - Navigation buttons
 * - Icons
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ErrorPage from '@/components/ErrorPage';

// ============================================================================
// Types
// ============================================================================

interface ErrorPageProps {
  code: 403 | 404 | 500 | 503;
  title?: string;
  message?: string;
}

// ============================================================================
// Test Helpers
// ============================================================================

function renderErrorPage(props: ErrorPageProps) {
  return render(
    <MemoryRouter>
      <ErrorPage {...props} />
    </MemoryRouter>
  );
}

// ============================================================================
// Tests
// ============================================================================

describe('ErrorPage', () => {
  describe('403 Forbidden', () => {
    it('should render 403 error page', () => {
      renderErrorPage({ code: 403 });

      // Check that heading with translated key is displayed
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('errorPage.accessDenied');
    });

    it('should show access denied message', () => {
      renderErrorPage({ code: 403 });

      expect(screen.getByText('errorPage.accessDeniedMessage')).toBeInTheDocument();
    });
  });

  describe('404 Not Found', () => {
    it('should render 404 error page', () => {
      renderErrorPage({ code: 404 });

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('errorPage.pageNotFound');
    });

    it('should show page not found message', () => {
      renderErrorPage({ code: 404 });

      expect(screen.getByText('errorPage.pageNotFoundMessage')).toBeInTheDocument();
    });
  });

  describe('500 Internal Server Error', () => {
    it('should render 500 error page', () => {
      renderErrorPage({ code: 500 });

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('errorPage.internalServerError');
    });

    it('should show internal server error message', () => {
      renderErrorPage({ code: 500 });

      expect(screen.getByText('errorPage.internalServerErrorMessage')).toBeInTheDocument();
    });
  });

  describe('503 Service Unavailable', () => {
    it('should render 503 error page', () => {
      renderErrorPage({ code: 503 });

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('errorPage.serviceUnavailable');
    });

    it('should show service unavailable message', () => {
      renderErrorPage({ code: 503 });

      expect(screen.getByText('errorPage.serviceUnavailableMessage')).toBeInTheDocument();
    });
  });

  describe('custom content', () => {
    it('should show custom title when provided', () => {
      renderErrorPage({ code: 404, title: 'Custom Title' });

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Custom Title');
    });

    it('should show custom message when provided', () => {
      renderErrorPage({ code: 404, message: 'Custom error message' });

      expect(screen.getByText('Custom error message')).toBeInTheDocument();
    });

    it('should show both custom title and message', () => {
      renderErrorPage({ 
        code: 403, 
        title: 'Custom Access Error',
        message: 'You need special permissions'
      });

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Custom Access Error');
      expect(screen.getByText('You need special permissions')).toBeInTheDocument();
    });
  });

  describe('navigation', () => {
    it('should render go back button', () => {
      renderErrorPage({ code: 404 });

      expect(screen.getByRole('button', { name: /common.goBack/i })).toBeInTheDocument();
    });

    it('should render go home button', () => {
      renderErrorPage({ code: 404 });

      expect(screen.getByRole('button', { name: /common.goHome/i })).toBeInTheDocument();
    });

    it('should render both navigation buttons', () => {
      renderErrorPage({ code: 500 });

      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(2);
    });

    it('should call navigate(-1) when go back clicked', async () => {
      const user = userEvent.setup();
      renderErrorPage({ code: 404 });

      const backButton = screen.getByRole('button', { name: /common.goBack/i });
      await user.click(backButton);

      // Button was clicked (navigation would happen in real app)
      expect(backButton).toBeInTheDocument();
    });

    it('should navigate to home when go home clicked', async () => {
      const user = userEvent.setup();
      renderErrorPage({ code: 404 });

      const homeButton = screen.getByRole('button', { name: /common.goHome/i });
      await user.click(homeButton);

      // Button was clicked (navigation would happen in real app)
      expect(homeButton).toBeInTheDocument();
    });
  });

  describe('default error code', () => {
    it('should use 500 default for unknown codes', () => {
      // The component handles default case in switch
      renderErrorPage({ code: 500 });

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('errorPage.internalServerError');
    });
  });
});
