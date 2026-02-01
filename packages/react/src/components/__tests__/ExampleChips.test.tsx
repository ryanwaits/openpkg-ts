import '../../../test-setup';
import { afterEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import { type ExampleChip, ExampleChips } from '../styled/ExampleChips';

afterEach(() => {
  cleanup();
});

// =============================================================================
// Test Data
// =============================================================================

const mockExamples: ExampleChip[] = [
  { id: 'basic', label: 'Basic' },
  { id: 'with-filter', label: 'With filter' },
  { id: 'with-order', label: 'With order' },
];

// =============================================================================
// Tests
// =============================================================================

describe('ExampleChips', () => {
  describe('rendering', () => {
    test('renders all example chips', () => {
      const onSelect = mock(() => {});
      const { container } = render(
        <ExampleChips examples={mockExamples} activeId="basic" onSelect={onSelect} />,
      );
      const q = within(container);

      expect(q.getByText('Basic')).toBeDefined();
      expect(q.getByText('With filter')).toBeDefined();
      expect(q.getByText('With order')).toBeDefined();
    });

    test('renders as buttons', () => {
      const onSelect = mock(() => {});
      const { container } = render(
        <ExampleChips examples={mockExamples} activeId="basic" onSelect={onSelect} />,
      );
      const q = within(container);

      const buttons = q.getAllByRole('button');
      expect(buttons).toHaveLength(3);
    });

    test('applies custom className', () => {
      const onSelect = mock(() => {});
      const { container } = render(
        <ExampleChips
          examples={mockExamples}
          activeId="basic"
          onSelect={onSelect}
          className="custom-class"
        />,
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.classList.contains('custom-class')).toBe(true);
    });
  });

  describe('active state', () => {
    test('marks active chip with aria-pressed', () => {
      const onSelect = mock(() => {});
      const { container } = render(
        <ExampleChips examples={mockExamples} activeId="with-filter" onSelect={onSelect} />,
      );
      const q = within(container);

      const activeButton = q.getByText('With filter');
      expect(activeButton.getAttribute('aria-pressed')).toBe('true');
    });

    test('marks inactive chips as not pressed', () => {
      const onSelect = mock(() => {});
      const { container } = render(
        <ExampleChips examples={mockExamples} activeId="basic" onSelect={onSelect} />,
      );
      const q = within(container);

      const inactiveButton = q.getByText('With filter');
      expect(inactiveButton.getAttribute('aria-pressed')).toBe('false');
    });
  });

  describe('interaction', () => {
    test('calls onSelect when chip is clicked', () => {
      const onSelect = mock(() => {});
      const { container } = render(
        <ExampleChips examples={mockExamples} activeId="basic" onSelect={onSelect} />,
      );
      const q = within(container);

      fireEvent.click(q.getByText('With filter'));
      expect(onSelect).toHaveBeenCalledWith('with-filter');
    });

    test('calls onSelect with correct id for each chip', () => {
      const onSelect = mock(() => {});
      const { container } = render(
        <ExampleChips examples={mockExamples} activeId="basic" onSelect={onSelect} />,
      );
      const q = within(container);

      fireEvent.click(q.getByText('With order'));
      expect(onSelect).toHaveBeenCalledWith('with-order');
    });

    test('allows clicking already active chip', () => {
      const onSelect = mock(() => {});
      const { container } = render(
        <ExampleChips examples={mockExamples} activeId="basic" onSelect={onSelect} />,
      );
      const q = within(container);

      fireEvent.click(q.getByText('Basic'));
      expect(onSelect).toHaveBeenCalledWith('basic');
    });
  });

  describe('edge cases', () => {
    test('handles empty examples array', () => {
      const onSelect = mock(() => {});
      const { container } = render(<ExampleChips examples={[]} activeId="" onSelect={onSelect} />);

      const buttons = container.querySelectorAll('button');
      expect(buttons.length).toBe(0);
    });

    test('handles single example', () => {
      const onSelect = mock(() => {});
      const { container } = render(
        <ExampleChips
          examples={[{ id: 'only', label: 'Only one' }]}
          activeId="only"
          onSelect={onSelect}
        />,
      );
      const q = within(container);

      expect(q.getByText('Only one')).toBeDefined();
    });
  });
});
