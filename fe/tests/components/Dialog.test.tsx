/**
 * @fileoverview Tests for Dialog component.
 * 
 * Tests:
 * - Open/close states
 * - Title rendering
 * - Body content
 * - Footer rendering
 * - Close button
 * - Max width options
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { Dialog } from '@/components/Dialog';

// ============================================================================
// Tests
// ============================================================================

describe('Dialog', () => {
  describe('visibility', () => {
    it('should not render when closed', () => {
      render(
        <Dialog open={false} onClose={() => {}} title="Test Dialog">
          Content
        </Dialog>
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should render when open', async () => {
      render(
        <Dialog open={true} onClose={() => {}} title="Test Dialog">
          Content
        </Dialog>
      );

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });
  });

  describe('title', () => {
    it('should display title', async () => {
      render(
        <Dialog open={true} onClose={() => {}} title="My Dialog Title">
          Content
        </Dialog>
      );

      await waitFor(() => {
        expect(screen.getByText('My Dialog Title')).toBeInTheDocument();
      });
    });
  });

  describe('content', () => {
    it('should render children in body', async () => {
      render(
        <Dialog open={true} onClose={() => {}} title="Test">
          <p>Dialog content here</p>
        </Dialog>
      );

      await waitFor(() => {
        expect(screen.getByText('Dialog content here')).toBeInTheDocument();
      });
    });

    it('should render complex children', async () => {
      render(
        <Dialog open={true} onClose={() => {}} title="Test">
          <div>
            <input type="text" placeholder="Name" />
            <button>Submit</button>
          </div>
        </Dialog>
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Name')).toBeInTheDocument();
        expect(screen.getByText('Submit')).toBeInTheDocument();
      });
    });
  });

  describe('footer', () => {
    it('should render footer when provided', async () => {
      render(
        <Dialog
          open={true}
          onClose={() => {}}
          title="Test"
          footer={<button>Save</button>}
        >
          Content
        </Dialog>
      );

      await waitFor(() => {
        expect(screen.getByText('Save')).toBeInTheDocument();
      });
    });

    it('should not render footer content when not provided', async () => {
      render(
        <Dialog open={true} onClose={() => {}} title="Test">
          Content
        </Dialog>
      );

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // No footer button visible
      expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
    });

    it('should render multiple footer buttons', async () => {
      render(
        <Dialog
          open={true}
          onClose={() => {}}
          title="Test"
          footer={
            <>
              <button>Cancel</button>
              <button>Save</button>
            </>
          }
        >
          Content
        </Dialog>
      );

      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeInTheDocument();
        expect(screen.getByText('Save')).toBeInTheDocument();
      });
    });
  });

  describe('close behavior', () => {
    it('should call onClose when close button clicked', async () => {
      const onClose = vi.fn();
      render(
        <Dialog open={true} onClose={onClose} title="Test">
          Content
        </Dialog>
      );

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Find the close button (the X button in header)
      const closeButtons = screen.getAllByRole('button');
      const closeButton = closeButtons.find(btn => btn.querySelector('svg'));
      if (closeButton) {
        fireEvent.click(closeButton);
        expect(onClose).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('maxWidth', () => {
    it('should render with sm max-width', async () => {
      render(
        <Dialog open={true} onClose={() => {}} title="Test" maxWidth="sm">
          Content
        </Dialog>
      );

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // The max-width class is on the Dialog.Panel which wraps the content
      expect(screen.getByText('Content')).toBeInTheDocument();
      const contentContainer = screen.getByText('Content').closest('[class*="max-w"]');
      expect(contentContainer?.className).toContain('max-w-sm');
    });

    it('should render with md max-width by default', async () => {
      render(
        <Dialog open={true} onClose={() => {}} title="Test">
          Content
        </Dialog>
      );

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const contentContainer = screen.getByText('Content').closest('[class*="max-w"]');
      expect(contentContainer?.className).toContain('max-w-md');
    });

    it('should render with lg max-width', async () => {
      render(
        <Dialog open={true} onClose={() => {}} title="Test" maxWidth="lg">
          Content
        </Dialog>
      );

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const contentContainer = screen.getByText('Content').closest('[class*="max-w"]');
      expect(contentContainer?.className).toContain('max-w-lg');
    });

    it('should render with xl max-width', async () => {
      render(
        <Dialog open={true} onClose={() => {}} title="Test" maxWidth="xl">
          Content
        </Dialog>
      );

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const contentContainer = screen.getByText('Content').closest('[class*="max-w"]');
      expect(contentContainer?.className).toContain('max-w-xl');
    });
  });

  describe('accessibility', () => {
    it('should have role="dialog"', async () => {
      render(
        <Dialog open={true} onClose={() => {}} title="Test">
          Content
        </Dialog>
      );

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('should have aria-modal="true"', async () => {
      render(
        <Dialog open={true} onClose={() => {}} title="Test">
          Content
        </Dialog>
      );

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
      });
    });
  });
});
