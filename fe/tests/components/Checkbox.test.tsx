/**
 * @fileoverview Tests for Checkbox component.
 * 
 * Tests:
 * - Rendering checked/unchecked states
 * - onChange callback
 * - Label rendering
 * - Accessibility
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { Checkbox } from '../../src/components/Checkbox';

// ============================================================================
// Tests
// ============================================================================

describe('Checkbox', () => {
  describe('rendering', () => {
    it('should render unchecked checkbox', () => {
      render(<Checkbox checked={false} onChange={() => {}} />);

      const checkbox = screen.getByRole('switch');
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).toHaveAttribute('aria-checked', 'false');
    });

    it('should render checked checkbox', () => {
      render(<Checkbox checked={true} onChange={() => {}} />);

      const checkbox = screen.getByRole('switch');
      expect(checkbox).toHaveAttribute('aria-checked', 'true');
    });

    it('should show check icon when checked', () => {
      const { container } = render(<Checkbox checked={true} onChange={() => {}} />);

      // The Check icon from lucide-react
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should hide check icon when unchecked', () => {
      const { container } = render(<Checkbox checked={false} onChange={() => {}} />);

      expect(container.querySelector('svg')).not.toBeInTheDocument();
    });
  });

  describe('label', () => {
    it('should render label when provided', () => {
      render(<Checkbox checked={false} onChange={() => {}} label="Accept terms" />);

      expect(screen.getByText('Accept terms')).toBeInTheDocument();
    });

    it('should not render label when not provided', () => {
      const { container } = render(<Checkbox checked={false} onChange={() => {}} />);

      expect(container.querySelector('label')).not.toBeInTheDocument();
    });

    it('should toggle checkbox when clicking label', () => {
      const onChange = vi.fn();
      render(<Checkbox checked={false} onChange={onChange} label="Click me" />);

      fireEvent.click(screen.getByText('Click me'));

      expect(onChange).toHaveBeenCalledWith(true);
    });
  });

  describe('onChange', () => {
    it('should call onChange with true when clicking unchecked checkbox', () => {
      const onChange = vi.fn();
      render(<Checkbox checked={false} onChange={onChange} />);

      fireEvent.click(screen.getByRole('switch'));

      expect(onChange).toHaveBeenCalledWith(true);
    });

    it('should call onChange with false when clicking checked checkbox', () => {
      const onChange = vi.fn();
      render(<Checkbox checked={true} onChange={onChange} />);

      fireEvent.click(screen.getByRole('switch'));

      expect(onChange).toHaveBeenCalledWith(false);
    });

    it('should call onChange only once per click', () => {
      const onChange = vi.fn();
      render(<Checkbox checked={false} onChange={onChange} />);

      fireEvent.click(screen.getByRole('switch'));

      expect(onChange).toHaveBeenCalledTimes(1);
    });
  });

  describe('accessibility', () => {
    it('should have role="switch"', () => {
      render(<Checkbox checked={false} onChange={() => {}} />);

      expect(screen.getByRole('switch')).toBeInTheDocument();
    });

    it('should have correct aria-checked for unchecked', () => {
      render(<Checkbox checked={false} onChange={() => {}} />);

      expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    });

    it('should have correct aria-checked for checked', () => {
      render(<Checkbox checked={true} onChange={() => {}} />);

      expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    });
  });

  describe('className', () => {
    it('should apply additional className', () => {
      const { container } = render(
        <Checkbox checked={false} onChange={() => {}} className="custom-class" />
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });
  });
});
