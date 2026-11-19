import { defineConfig } from 'vitest/config';
export default defineConfig({
  esbuild: { tsconfigRaw: { compilerOptions: { experimentalDecorators: true, useDefineForClassFields: false } } as never },
  test: { include: ['test/**/*.test.ts'], testTimeout: 30000, hookTimeout: 60000, fileParallelism: false },
});
