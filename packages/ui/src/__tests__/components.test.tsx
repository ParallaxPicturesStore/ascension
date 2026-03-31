import React from 'react';
import { render, screen } from '@testing-library/react-native';

// Components under test
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { Input } from '../components/Input';
import { StreakCounter } from '../components/StreakCounter';

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

describe('Button', () => {
  it('renders the title text', () => {
    render(<Button title="Save" onPress={jest.fn()} />);
    expect(screen.getByText('Save')).toBeTruthy();
  });

  it('sets accessibility role to button', () => {
    render(<Button title="Save" onPress={jest.fn()} />);
    expect(screen.getByRole('button')).toBeTruthy();
  });

  it('renders primary variant by default', () => {
    const { getByRole } = render(<Button title="Go" onPress={jest.fn()} />);
    const btn = getByRole('button');
    // Just verify it renders without crashing (variant styling is internal)
    expect(btn).toBeTruthy();
  });

  it('renders danger variant without crashing', () => {
    const { getByText } = render(
      <Button title="Delete" onPress={jest.fn()} variant="danger" />,
    );
    expect(getByText('Delete')).toBeTruthy();
  });

  it('renders ghost variant without crashing', () => {
    const { getByText } = render(
      <Button title="Cancel" onPress={jest.fn()} variant="ghost" />,
    );
    expect(getByText('Cancel')).toBeTruthy();
  });

  it('renders secondary variant without crashing', () => {
    const { getByText } = render(
      <Button title="Info" onPress={jest.fn()} variant="secondary" />,
    );
    expect(getByText('Info')).toBeTruthy();
  });

  it('marks disabled state in accessibility', () => {
    render(<Button title="Nope" onPress={jest.fn()} disabled />);
    const btn = screen.getByRole('button');
    expect(btn.props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true }),
    );
  });
});

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

describe('Card', () => {
  it('renders children', () => {
    const { getByText } = render(<Card><>{`Hello card`}</></Card>);
    expect(getByText('Hello card')).toBeTruthy();
  });

  it('renders header when provided', () => {
    const { getByText } = render(
      <Card header={<>{`Header`}</>}><>{`Body`}</></Card>,
    );
    expect(getByText('Header')).toBeTruthy();
    expect(getByText('Body')).toBeTruthy();
  });

  it('renders footer when provided', () => {
    const { getByText } = render(
      <Card footer={<>{`Footer`}</>}><>{`Body`}</></Card>,
    );
    expect(getByText('Footer')).toBeTruthy();
  });

  it('renders without header and footer', () => {
    const { getByText } = render(<Card><>{`Content only`}</></Card>);
    expect(getByText('Content only')).toBeTruthy();
  });

  it('renders header, body, and footer together', () => {
    const { getByText } = render(
      <Card header={<>{`H`}</>} footer={<>{`F`}</>}>
        <>{`B`}</>
      </Card>,
    );
    expect(getByText('H')).toBeTruthy();
    expect(getByText('B')).toBeTruthy();
    expect(getByText('F')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------

describe('Badge', () => {
  it('renders the text', () => {
    const { getByText } = render(<Badge text="Active" />);
    expect(getByText('Active')).toBeTruthy();
  });

  it('renders success variant without crashing', () => {
    const { getByText } = render(<Badge text="OK" variant="success" />);
    expect(getByText('OK')).toBeTruthy();
  });

  it('renders warning variant without crashing', () => {
    const { getByText } = render(<Badge text="Warn" variant="warning" />);
    expect(getByText('Warn')).toBeTruthy();
  });

  it('renders danger variant without crashing', () => {
    const { getByText } = render(<Badge text="Error" variant="danger" />);
    expect(getByText('Error')).toBeTruthy();
  });

  it('defaults to neutral variant', () => {
    const { getByText } = render(<Badge text="Neutral" />);
    expect(getByText('Neutral')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

describe('Input', () => {
  it('renders with a label', () => {
    const { getByText } = render(<Input label="Email" />);
    expect(getByText('Email')).toBeTruthy();
  });

  it('renders without a label', () => {
    const { toJSON } = render(<Input placeholder="Type here" />);
    expect(toJSON()).toBeTruthy();
  });

  it('shows error text when error prop is set', () => {
    const { getByText } = render(<Input label="Password" error="Required" />);
    expect(getByText('Required')).toBeTruthy();
  });

  it('does not show error text when error prop is not set', () => {
    const { queryByText } = render(<Input label="Name" />);
    expect(queryByText('Required')).toBeNull();
  });

  it('sets accessibility label from label prop', () => {
    const { getByLabelText } = render(<Input label="Username" />);
    expect(getByLabelText('Username')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// StreakCounter
// ---------------------------------------------------------------------------

describe('StreakCounter', () => {
  it('displays the current streak number', () => {
    const { getByText } = render(
      <StreakCounter currentStreak={42} longestStreak={100} />,
    );
    expect(getByText('42')).toBeTruthy();
  });

  it('displays "days" (plural) for streak > 1', () => {
    const { getByText } = render(
      <StreakCounter currentStreak={5} longestStreak={10} />,
    );
    expect(getByText('days')).toBeTruthy();
  });

  it('displays "day" (singular) for streak of 1', () => {
    const { getByText } = render(
      <StreakCounter currentStreak={1} longestStreak={1} />,
    );
    expect(getByText('day')).toBeTruthy();
  });

  it('displays longest streak info', () => {
    const { getByText } = render(
      <StreakCounter currentStreak={10} longestStreak={50} />,
    );
    expect(getByText('Longest: 50 days')).toBeTruthy();
  });

  it('displays 0 streak correctly', () => {
    const { getByText } = render(
      <StreakCounter currentStreak={0} longestStreak={0} />,
    );
    expect(getByText('0')).toBeTruthy();
    expect(getByText('days')).toBeTruthy();
  });

  it('has an accessibility label describing the streak', () => {
    render(<StreakCounter currentStreak={7} longestStreak={14} />);
    const element = screen.getByLabelText(
      'Current streak: 7 days. Longest streak: 14 days.',
    );
    expect(element).toBeTruthy();
  });
});
