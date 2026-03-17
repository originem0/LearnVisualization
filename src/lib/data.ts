import state from '@/data/state.json';
import type { Category, Module, StateData } from './types';

export const data = state as StateData;

export const categoriesById = data.categories.reduce<Record<string, Category>>((acc, category) => {
  acc[category.id] = category;
  return acc;
}, {});

export const modulesById = data.modules.reduce<Record<number, Module>>((acc, module) => {
  acc[module.id] = module;
  return acc;
}, {});

export const moduleIds = data.modules.map((module) => module.id);
