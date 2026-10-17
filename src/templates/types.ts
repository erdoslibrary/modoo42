// src/templates/types.ts — 정의 원본은 docs/trd.md §3.3.
import type { z } from 'zod';
import type React from 'react';

export interface StudyTemplate<TData = Record<string, unknown>> {
  id: string;
  title: string;
  description: string;
  defaultTags: string[];
  defaultProofType: string;
  dataSchema?: z.ZodType<TData>;
  CustomFormField?: React.ComponentType<{
    value: TData;
    onChange: (val: TData) => void;
  }>;
}
