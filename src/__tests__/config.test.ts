// src/__tests__/config.test.ts
import { env } from '../config'

test('env should contain pool address', () => {
  expect(env.VITE_POOL_ADDRESS).toBeDefined();
});
