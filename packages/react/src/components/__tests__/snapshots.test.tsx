import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, render } from '@testing-library/react';
import { ExampleChips } from '../styled/ExampleChips';
import { MethodSection } from '../styled/MethodSection';
import { NestedParameterContainer } from '../styled/NestedParameterContainer';
import { NestedParameterToggle } from '../styled/NestedParameterToggle';

afterEach(() => {
  cleanup();
});

// =============================================================================
// Snapshot Tests
// =============================================================================

describe('Component Snapshots', () => {
  describe('MethodSection', () => {
    test('renders basic method section', () => {
      const { container } = render(
        <MethodSection
          id="createUser"
          title="createUser"
          signature="createUser(name: string, email: string): Promise<User>"
          description="Creates a new user with the specified name and email."
          notes={['This is an async function', 'Returns a Promise']}
        >
          <div>Parameters go here</div>
        </MethodSection>,
      );

      expect(container.innerHTML).toMatchSnapshot();
    });

    test('renders method section without notes', () => {
      const { container } = render(
        <MethodSection id="getUser" title="getUser" signature="getUser(id: string): User | null">
          <div>Parameters</div>
        </MethodSection>,
      );

      expect(container.innerHTML).toMatchSnapshot();
    });
  });

  describe('NestedParameterToggle', () => {
    test('collapsed state', () => {
      const { container } = render(
        <NestedParameterToggle expanded={false} onToggle={() => {}} count={3} />,
      );

      expect(container.innerHTML).toMatchSnapshot();
    });

    test('expanded state', () => {
      const { container } = render(
        <NestedParameterToggle expanded={true} onToggle={() => {}} count={3} />,
      );

      expect(container.innerHTML).toMatchSnapshot();
    });
  });

  describe('NestedParameterContainer', () => {
    test('renders with children', () => {
      const { container } = render(
        <NestedParameterContainer>
          <div>Child parameter 1</div>
          <div>Child parameter 2</div>
        </NestedParameterContainer>,
      );

      expect(container.innerHTML).toMatchSnapshot();
    });

    test('renders nested levels', () => {
      const { container } = render(
        <NestedParameterContainer level={2}>
          <div>Deeply nested</div>
        </NestedParameterContainer>,
      );

      expect(container.innerHTML).toMatchSnapshot();
    });
  });

  describe('ExampleChips', () => {
    test('renders multiple chips with active', () => {
      const { container } = render(
        <ExampleChips
          examples={[
            { id: 'basic', label: 'Basic' },
            { id: 'with-filter', label: 'With filter' },
            { id: 'advanced', label: 'Advanced' },
          ]}
          activeId="with-filter"
          onSelect={() => {}}
        />,
      );

      expect(container.innerHTML).toMatchSnapshot();
    });

    test('renders single chip', () => {
      const { container } = render(
        <ExampleChips
          examples={[{ id: 'only', label: 'Only option' }]}
          activeId="only"
          onSelect={() => {}}
        />,
      );

      expect(container.innerHTML).toMatchSnapshot();
    });
  });

  // Note: CollapsiblePanel uses Radix UI primitives which require
  // additional DOM APIs not available in jsdom. These are tested
  // manually via the HTML demo page at docs/examples/stripe-style-demo.html
});
