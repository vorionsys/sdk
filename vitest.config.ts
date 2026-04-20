// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-2026 Vorion LLC

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'src/**/__tests__/*.ts'],
    globals: true,
  },
});
