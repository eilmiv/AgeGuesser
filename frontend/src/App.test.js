import { render, screen } from '@testing-library/react';
import App from './App';

test('renders AgeGuesser header', () => {
  render(<App />);
  const heading = screen.getByText(/AgeGuesser/i);
  expect(heading).toBeInTheDocument();
});

test('shows configurations heading on initial load', () => {
  render(<App />);
  expect(screen.getAllByText(/Configurations/i).length).toBeGreaterThan(0);
});

test('shows new configuration button', () => {
  render(<App />);
  expect(screen.getByText(/New Configuration/i)).toBeInTheDocument();
});
