// src/App.test.js
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

test('renders site shell', () => {
  render(<MemoryRouter><App /></MemoryRouter>);
  expect(screen.getByText(/The Novel Way/i)).toBeInTheDocument();
});
