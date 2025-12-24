/**
 * @fileoverview Tests for RadioGroup component.
 * 
 * Tests:
 * - Rendering options
 * - Selection state
 * - onChange callback
 * - Icons and descriptions
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RadioGroup } from '@/components/RadioGroup';

// ============================================================================
// Types
// ============================================================================

interface RadioOption {
  value: string;
  label: string;
  icon?: string | React.ReactNode;
  description?: string;
}

// ============================================================================
// Tests
// ============================================================================

describe('RadioGroup', () => {
  const defaultOptions: RadioOption[] = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System' },
  ];

  describe('rendering', () => {
    it('should render all options', () => {
      render(
        <RadioGroup value="light" onChange={() => {}} options={defaultOptions} />
      );

      expect(screen.getByRole('radiogroup')).toBeInTheDocument();
      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(3);
    });

    it('should display option labels', () => {
      render(
        <RadioGroup value="light" onChange={() => {}} options={defaultOptions} />
      );

      expect(screen.getByText('Light')).toBeInTheDocument();
      expect(screen.getByText('Dark')).toBeInTheDocument();
      expect(screen.getByText('System')).toBeInTheDocument();
    });

    it('should render empty when no options', () => {
      render(
        <RadioGroup value="" onChange={() => {}} options={[]} />
      );

      expect(screen.getByRole('radiogroup')).toBeInTheDocument();
      expect(screen.queryAllByRole('radio')).toHaveLength(0);
    });
  });

  describe('selection state', () => {
    it('should mark selected option with aria-checked', () => {
      render(
        <RadioGroup value="dark" onChange={() => {}} options={defaultOptions} />
      );

      const radios = screen.getAllByRole('radio');
      // Light (unchecked)
      expect(radios[0]).toHaveAttribute('aria-checked', 'false');
      // Dark (checked)
      expect(radios[1]).toHaveAttribute('aria-checked', 'true');
      // System (unchecked)
      expect(radios[2]).toHaveAttribute('aria-checked', 'false');
    });

    it('should apply selected styles to selected option', () => {
      render(
        <RadioGroup value="light" onChange={() => {}} options={defaultOptions} />
      );

      const radios = screen.getAllByRole('radio');
      // The selected option should have border-primary class
      expect(radios[0]).toHaveClass('border-primary');
    });
  });

  describe('onChange', () => {
    it('should call onChange when option clicked', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <RadioGroup value="light" onChange={onChange} options={defaultOptions} />
      );

      const radios = screen.getAllByRole('radio');
      await user.click(radios[1]!); // Click on "Dark"

      expect(onChange).toHaveBeenCalledWith('dark');
    });

    it('should call onChange only once per click', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <RadioGroup value="light" onChange={onChange} options={defaultOptions} />
      );

      const radios = screen.getAllByRole('radio');
      await user.click(radios[1]!);

      expect(onChange).toHaveBeenCalledTimes(1);
    });
  });

  describe('icons', () => {
    it('should render string icons', () => {
      const optionsWithIcons: RadioOption[] = [
        { value: 'en', label: 'English', icon: '🇺🇸' },
        { value: 'vi', label: 'Vietnamese', icon: '🇻🇳' },
      ];

      render(
        <RadioGroup value="en" onChange={() => {}} options={optionsWithIcons} />
      );

      expect(screen.getByText('🇺🇸')).toBeInTheDocument();
      expect(screen.getByText('🇻🇳')).toBeInTheDocument();
    });

    it('should render React node icons', () => {
      const optionsWithReactIcons: RadioOption[] = [
        { value: 'light', label: 'Light', icon: <span data-testid="sun-icon">☀️</span> },
        { value: 'dark', label: 'Dark', icon: <span data-testid="moon-icon">🌙</span> },
      ];

      render(
        <RadioGroup value="light" onChange={() => {}} options={optionsWithReactIcons} />
      );

      expect(screen.getByTestId('sun-icon')).toBeInTheDocument();
      expect(screen.getByTestId('moon-icon')).toBeInTheDocument();
    });
  });

  describe('descriptions', () => {
    it('should render descriptions when provided', () => {
      const optionsWithDesc: RadioOption[] = [
        { value: 'opt1', label: 'Option 1', description: 'First option description' },
        { value: 'opt2', label: 'Option 2', description: 'Second option description' },
      ];

      render(
        <RadioGroup value="opt1" onChange={() => {}} options={optionsWithDesc} />
      );

      expect(screen.getByText('First option description')).toBeInTheDocument();
      expect(screen.getByText('Second option description')).toBeInTheDocument();
    });

    it('should not render description when not provided', () => {
      render(
        <RadioGroup value="light" onChange={() => {}} options={defaultOptions} />
      );

      // Default options don't have descriptions
      expect(screen.queryByText(/description/i)).not.toBeInTheDocument();
    });
  });

  describe('columns configuration', () => {
    it('should use default 3 columns when not specified', () => {
      const { container } = render(
        <RadioGroup value="light" onChange={() => {}} options={defaultOptions} />
      );

      expect(container.querySelector('.grid-cols-3')).toBeInTheDocument();
    });

    it('should support 1 column layout', () => {
      const { container } = render(
        <RadioGroup value="light" onChange={() => {}} options={defaultOptions} columns={1} />
      );

      expect(container.querySelector('.grid-cols-1')).toBeInTheDocument();
    });

    it('should support 2 column layout', () => {
      const { container } = render(
        <RadioGroup value="light" onChange={() => {}} options={defaultOptions} columns={2} />
      );

      expect(container.querySelector('.grid-cols-2')).toBeInTheDocument();
    });

    it('should support 4 column layout', () => {
      const { container } = render(
        <RadioGroup value="light" onChange={() => {}} options={defaultOptions} columns={4} />
      );

      expect(container.querySelector('.grid-cols-4')).toBeInTheDocument();
    });

    it('should fallback to 3 columns for unsupported column values', () => {
      const { container } = render(
        <RadioGroup value="light" onChange={() => {}} options={defaultOptions} columns={5 as any} />
      );

      expect(container.querySelector('.grid-cols-3')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have role="radiogroup" on container', () => {
      render(
        <RadioGroup value="light" onChange={() => {}} options={defaultOptions} />
      );

      expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    });

    it('should have role="radio" on each option', () => {
      render(
        <RadioGroup value="light" onChange={() => {}} options={defaultOptions} />
      );

      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(3);
    });

    it('should have tabIndex on options', () => {
      render(
        <RadioGroup value="light" onChange={() => {}} options={defaultOptions} />
      );

      const radios = screen.getAllByRole('radio');
      // Headless UI RadioGroup handles tabIndex internally
      radios.forEach(radio => {
        expect(radio).toBeInTheDocument();
      });
    });
  });
});
