import '../../../test-setup';
import { afterEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, fireEvent, render, within } from '@testing-library/react';
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
      const { container } = render(
        <NestedParameterToggle expanded={false} onToggle={onToggle} />,
      );
      const q = within(container);

      expect(q.getByRole('button')).toBeDefined();
    });

    test('shows "Show child parameters" when collapsed', () => {
      const onToggle = mock(() => {});
      const { container } = render(
        <NestedParameterToggle expanded={false} onToggle={onToggle} />,
      );
      const q = within(container);

      expect(q.getByText(/Show child parameters/)).toBeDefined();
    });

    test('shows "Hide child parameters" when expanded', () => {
      const onToggle = mock(() => {});
      const { container } = render(
        <NestedParameterToggle expanded={true} onToggle={onToggle} />,
      );
      const q = within(container);

      expect(q.getByText(/Hide child parameters/)).toBeDefined();
    });

    test('displays count when provided', () => {
      const onToggle = mock(() => {});
      const { container } = render(
        <NestedParameterToggle expanded={false} onToggle={onToggle} count={5} />,
      );
      const q = within(container);

      expect(q.getByText(/\(5\)/)).toBeDefined();
    });

    test('applies custom className', () => {
      const onToggle = mock(() => {});
      const { container } = render(
        <NestedParameterToggle expanded={false} onToggle={onToggle} className="custom-toggle" />,
      );
      const q = within(container);

      const button = q.getByRole('button');
      expect(button.classList.contains('custom-toggle')).toBe(true);
    });
  });

  describe('accessibility', () => {
    test('sets aria-expanded to false when collapsed', () => {
      const onToggle = mock(() => {});
      const { container } = render(
        <NestedParameterToggle expanded={false} onToggle={onToggle} />,
      );
      const q = within(container);

      const button = q.getByRole('button');
      expect(button.getAttribute('aria-expanded')).toBe('false');
    });

    test('sets aria-expanded to true when expanded', () => {
      const onToggle = mock(() => {});
      const { container } = render(
        <NestedParameterToggle expanded={true} onToggle={onToggle} />,
      );
      const q = within(container);

      const button = q.getByRole('button');
      expect(button.getAttribute('aria-expanded')).toBe('true');
    });
  });

  describe('interaction', () => {
    test('calls onToggle when clicked', () => {
      const onToggle = mock(() => {});
      const { container } = render(
        <NestedParameterToggle expanded={false} onToggle={onToggle} />,
      );
      const q = within(container);

      fireEvent.click(q.getByRole('button'));
      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    test('can be clicked multiple times', () => {
      const onToggle = mock(() => {});
      const { container } = render(
        <NestedParameterToggle expanded={false} onToggle={onToggle} />,
      );
      const q = within(container);

      const button = q.getByRole('button');
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);

      expect(onToggle).toHaveBeenCalledTimes(3);
    });
  });

  describe('styling classes', () => {
    test('includes base classes', () => {
      const onToggle = mock(() => {});
      const { container } = render(
        <NestedParameterToggle expanded={false} onToggle={onToggle} />,
      );
      const q = within(container);

      const button = q.getByRole('button');
      expect(button.classList.contains('openpkg-nested-toggle')).toBe(true);
    });

    test('has rounded-b-none when expanded', () => {
      const onToggle = mock(() => {});
      const { container } = render(
        <NestedParameterToggle expanded={true} onToggle={onToggle} />,
      );
      const q = within(container);

      const button = q.getByRole('button');
      expect(button.classList.contains('rounded-b-none')).toBe(true);
    });

    test('does not have rounded-b-none when collapsed', () => {
      const onToggle = mock(() => {});
      const { container } = render(
        <NestedParameterToggle expanded={false} onToggle={onToggle} />,
      );
      const q = within(container);

      const button = q.getByRole('button');
      expect(button.classList.contains('rounded-b-none')).toBe(false);
    });
  });
});
