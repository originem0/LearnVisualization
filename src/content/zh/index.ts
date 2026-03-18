import type { Category, Module, ProjectInfo, StateData } from '@/lib/types';
import projectRaw from './project.json';
import categoriesRaw from './categories.json';
import s01Raw from './modules/s01.json';
import s02Raw from './modules/s02.json';
import s03Raw from './modules/s03.json';
import s04Raw from './modules/s04.json';
import s05Raw from './modules/s05.json';
import s06Raw from './modules/s06.json';
import s07Raw from './modules/s07.json';
import s08Raw from './modules/s08.json';
import s09Raw from './modules/s09.json';
import s10Raw from './modules/s10.json';
import s11Raw from './modules/s11.json';
import s12Raw from './modules/s12.json';

const project = projectRaw as ProjectInfo;
const categories = categoriesRaw as Category[];
const modules = [
  s01Raw,
  s02Raw,
  s03Raw,
  s04Raw,
  s05Raw,
  s06Raw,
  s07Raw,
  s08Raw,
  s09Raw,
  s10Raw,
  s11Raw,
  s12Raw,
] as Module[];

const zhData: StateData = {
  project,
  categories,
  modules,
};

export default zhData;
