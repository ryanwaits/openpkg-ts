import { describe, expect, test, mock, afterEach } from 'bun:test';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ExampleChips, type ExampleChip } from '../styled/ExampleChips';

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
      render(
        <ExampleChips
          examples={mockExamples}
          activeId="basic"
          onSelect={onSelect}
        />
      );

      expect(screen.getByText('Basic')).toBeDefined();
      expect(screen.getByText('With filter')).toBeDefined();
      expect(screen.getByText('With order')).toBeDefined();
    });

    test('renders as buttons', () => {
      const onSelect = mock(() => {});
      render(
        <ExampleChips
          examples={mockExamples}
          activeId="basic"
          onSelect={onSelect}
        />
      );

      const buttons = screen.getAllByRole('button');
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
        />
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.classList.contains('custom-class')).toBe(true);
    });
  });

  describe('active state', () => {
    test('marks active chip with aria-pressed', () => {
      const onSelect = mock(() => {});
      render(
        <ExampleChips
          examples={mockExamples}
          activeId="with-filter"
          onSelect={onSelect}
        />
      );

      const activeButton = screen.getByText('With filter');
      expect(activeButton.getAttribute('aria-pressed')).toBe('true');
    });

    test('marks inactive chips as not pressed', () => {
      const onSelect = mock(() => {});
      render(
        <ExampleChips
          examples={mockExamples}
          activeId="basic"
          onSelect={onSelect}
        />
      );

      const inactiveButton = screen.getByText('With filter');
      expect(inactiveButton.getAttribute('aria-pressed')).toBe('false');
    });
  });

  describe('interaction', () => {
    test('calls onSelect when chip is clicked', () => {
      const onSelect = mock(() => {});
      render(
        <ExampleChips
          examples={mockExamples}
          activeId="basic"
          onSelect={onSelect}
        />
      );

      fireEvent.click(screen.getByText('With filter'));
      expect(onSelect).toHaveBeenCalledWith('with-filter');
    });

    test('calls onSelect with correct id for each chip', () => {
      const onSelect = mock(() => {});
      render(
        <ExampleChips
          examples={mockExamples}
          activeId="basic"
          onSelect={onSelect}
        />
      );

      fireEvent.click(screen.getByText('With order'));
      expect(onSelect).toHaveBeenCalledWith('with-order');
    });

    test('allows clicking already active chip', () => {
      const onSelect = mock(() => {});
      render(
        <ExampleChips
          examples={mockExamples}
          activeId="basic"
          onSelect={onSelect}
        />
      );

      fireEvent.click(screen.getByText('Basic'));
      expect(onSelect).toHaveBeenCalledWith('basic');
    });
  });

  describe('edge cases', () => {
    test('handles empty examples array', () => {
      const onSelect = mock(() => {});
      const { container } = render(
        <ExampleChips
          examples={[]}
          activeId=""
          onSelect={onSelect}
        />
      );

      const buttons = container.querySelectorAll('button');
      expect(buttons.length).toBe(0);
    });

    test('handles single example', () => {
      const onSelect = mock(() => {});
      render(
        <ExampleChips
          examples={[{ id: 'only', label: 'Only one' }]}
          activeId="only"
          onSelect={onSelect}
        />
      );

      expect(screen.getByText('Only one')).toBeDefined();
    });
  });
});
