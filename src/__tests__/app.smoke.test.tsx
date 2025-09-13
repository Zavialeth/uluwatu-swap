// src/__tests__/app.smoke.test.tsx
import { render } from '@testing-library/react'
import App from '../App'

test('renders heading', () => {
  const { getByText } = render(<App />);
  expect(getByText(/Sushi V3 Mini Frontend/i)).toBeInTheDocument();
});
