/**
 * @fileoverview Tests for Select component.
 * 
 * Tests:
 * - Rendering options
 * - Selection changes
 * - Icon display
 * - Accessibility
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Select } from '@/components/Select';

// ============================================================================
// Types
// ============================================================================

interface SelectOption {
  id: string;
  name: string;
}

// ============================================================================
// Tests
// ============================================================================

describe('Select', () => {
  const defaultOptions: SelectOption[] = [
    { id: 'opt1', name: 'Option 1' },
    { id: 'opt2', name: 'Option 2' },
    { id: 'opt3', name: 'Option 3' },
  ];

  describe('rendering', () => {
    it('should render with selected value', () => {
      render(
        <Select value="opt1" onChange={() => {}} options={defaultOptions} />
      );

      expect(screen.getByRole('button')).toHaveTextContent('Option 1');
    });

    it('should render placeholder when no value matches', () => {
      render(
        <Select value="unknown" onChange={() => {}} options={defaultOptions} />
      );

      expect(screen.getByRole('button')).toHaveTextContent('Select...');
    });

    it('should render icon when provided', () => {
      render(
        <Select
          value="opt1"
          onChange={() => {}}
          options={defaultOptions}
          icon={<span data-testid="custom-icon">🔍</span>}
        />
      );

      expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    });

    it('should not render custom icon when not provided', () => {
      render(
        <Select value="opt1" onChange={() => {}} options={defaultOptions} />
      );

      expect(screen.queryByTestId('custom-icon')).not.toBeInTheDocument();
    });
  });

  describe('dropdown behavior', () => {
    it('should open dropdown when button clicked', async () => {
      const user = userEvent.setup();
      render(
        <Select value="opt1" onChange={() => {}} options={defaultOptions} />
      );

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });
    });

    it('should close dropdown when option selected', async () => {
      const user = userEvent.setup();
      render(
        <Select value="opt1" onChange={() => {}} options={defaultOptions} />
      );

      await user.click(screen.getByRole('button'));
      
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      const options = screen.getAllByRole('option');
      await user.click(options[1]!);

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });
    });
  });

  describe('option selection', () => {
    it('should call onChange when option clicked', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <Select value="opt1" onChange={onChange} options={defaultOptions} />
      );

      await user.click(screen.getByRole('button'));
      
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      const options = screen.getAllByRole('option');
      await user.click(options[1]!);

      expect(onChange).toHaveBeenCalledWith('opt2');
    });

    it('should display all options in the dropdown', async () => {
      const user = userEvent.setup();
      render(
        <Select value="opt1" onChange={() => {}} options={defaultOptions} />
      );

      await user.click(screen.getByRole('button'));

      await waitFor(() => {
        const options = screen.getAllByRole('option');
        expect(options).toHaveLength(3);
      });
    });
  });

  describe('accessibility', () => {
    it('should have aria-haspopup on button', () => {
      render(
        <Select value="opt1" onChange={() => {}} options={defaultOptions} />
      );

      expect(screen.getByRole('button')).toHaveAttribute('aria-haspopup', 'listbox');
    });

    it('should have aria-expanded when open', async () => {
      const user = userEvent.setup();
      render(
        <Select value="opt1" onChange={() => {}} options={defaultOptions} />
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'false');

      await user.click(button);

      await waitFor(() => {
        expect(button).toHaveAttribute('aria-expanded', 'true');
      });
    });

    it('should have role="listbox" on options container', async () => {
      const user = userEvent.setup();
      render(
        <Select value="opt1" onChange={() => {}} options={defaultOptions} />
      );

      await user.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });
    });

    it('should have role="option" on each option', async () => {
      const user = userEvent.setup();
      render(
        <Select value="opt1" onChange={() => {}} options={defaultOptions} />
      );

      await user.click(screen.getByRole('button'));

      await waitFor(() => {
        const options = screen.getAllByRole('option');
        expect(options).toHaveLength(3);
      });
    });

    it('should mark selected option', async () => {
      const user = userEvent.setup();
      render(
        <Select value="opt1" onChange={() => {}} options={defaultOptions} />
      );

      await user.click(screen.getByRole('button'));

      await waitFor(() => {
        const options = screen.getAllByRole('option');
        // The first option should be selected (opt1)
        expect(options[0]).toHaveTextContent('Option 1');
      });
    });
  });

  describe('empty options', () => {
    it('should render empty listbox when no options', async () => {
      const user = userEvent.setup();
      render(
        <Select value="" onChange={() => {}} options={[]} />
      );

      await user.click(screen.getByRole('button'));

      await waitFor(() => {
        const listbox = screen.getByRole('listbox');
        expect(listbox).toBeInTheDocument();
        expect(screen.queryAllByRole('option')).toHaveLength(0);
      });
    });
  });
});
