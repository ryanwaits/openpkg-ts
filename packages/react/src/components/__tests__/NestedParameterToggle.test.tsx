import { describe, expect, test, mock, afterEach } from 'bun:test';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { NestedParameterToggle } from '../styled/NestedParameterToggle';

afterEach(() => {
  cleanup();
});

// =============================================================================
// Tests
// =============================================================================

describe('NestedParameterToggle', () => {
  describe('rendering', () => {
    test('renders as button', () => {
      const onToggle = mock(() => {});
      render(<NestedParameterToggle expanded={false} onToggle={onToggle} />);

      expect(screen.getByRole('button')).toBeDefined();
    });

    test('shows "Show child parameters" when collapsed', () => {
      const onToggle = mock(() => {});
      render(<NestedParameterToggle expanded={false} onToggle={onToggle} />);

      expect(screen.getByText(/Show child parameters/)).toBeDefined();
    });

    test('shows "Hide child parameters" when expanded', () => {
      const onToggle = mock(() => {});
      render(<NestedParameterToggle expanded={true} onToggle={onToggle} />);

      expect(screen.getByText(/Hide child parameters/)).toBeDefined();
    });

    test('displays count when provided', () => {
      const onToggle = mock(() => {});
      render(
        <NestedParameterToggle expanded={false} onToggle={onToggle} count={5} />
      );

      expect(screen.getByText(/\(5\)/)).toBeDefined();
    });

    test('applies custom className', () => {
      const onToggle = mock(() => {});
      render(
        <NestedParameterToggle
          expanded={false}
          onToggle={onToggle}
          className="custom-toggle"
        />
      );

      const button = screen.getByRole('button');
      expect(button.classList.contains('custom-toggle')).toBe(true);
    });
  });

  describe('accessibility', () => {
    test('sets aria-expanded to false when collapsed', () => {
      const onToggle = mock(() => {});
      render(<NestedParameterToggle expanded={false} onToggle={onToggle} />);

      const button = screen.getByRole('button');
      expect(button.getAttribute('aria-expanded')).toBe('false');
    });

    test('sets aria-expanded to true when expanded', () => {
      const onToggle = mock(() => {});
      render(<NestedParameterToggle expanded={true} onToggle={onToggle} />);

      const button = screen.getByRole('button');
      expect(button.getAttribute('aria-expanded')).toBe('true');
    });
  });

  describe('interaction', () => {
    test('calls onToggle when clicked', () => {
      const onToggle = mock(() => {});
      render(<NestedParameterToggle expanded={false} onToggle={onToggle} />);

      fireEvent.click(screen.getByRole('button'));
      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    test('can be clicked multiple times', () => {
      const onToggle = mock(() => {});
      render(<NestedParameterToggle expanded={false} onToggle={onToggle} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);

      expect(onToggle).toHaveBeenCalledTimes(3);
    });
  });

  describe('styling classes', () => {
    test('includes base classes', () => {
      const onToggle = mock(() => {});
      render(<NestedParameterToggle expanded={false} onToggle={onToggle} />);

      const button = screen.getByRole('button');
      expect(button.classList.contains('openpkg-nested-toggle')).toBe(true);
    });

    test('has rounded-b-none when expanded', () => {
      const onToggle = mock(() => {});
      render(<NestedParameterToggle expanded={true} onToggle={onToggle} />);

      const button = screen.getByRole('button');
      expect(button.classList.contains('rounded-b-none')).toBe(true);
    });

    test('does not have rounded-b-none when collapsed', () => {
      const onToggle = mock(() => {});
      render(<NestedParameterToggle expanded={false} onToggle={onToggle} />);

      const button = screen.getByRole('button');
      expect(button.classList.contains('rounded-b-none')).toBe(false);
    });
  });
});
