/**
 * Datos de la placa de circuito de tecnologias.
 *
 * `chips` son los componentes soldados y `traces` las pistas de cobre entre
 * ellos. Una pista significa "estas dos las uso juntas de verdad", no
 * "ambas existen": si las conexiones son decorativas, la seccion deja de
 * contar nada y se convierte en una nube de logos mas.
 */

export type ChipGroup = 'base' | 'frontend' | 'backend' | 'cms' | 'datos' | 'infra' | 'ia';

export type ChipLevel = 'core' | 'solvente' | 'tocado';

export interface Chip {
  id: string;
  label: string;
  group: ChipGroup;
  level: ChipLevel;
}

export const groupLabels: Record<ChipGroup, string> = {
  base: 'Fundamentos',
  frontend: 'Frontend',
  backend: 'Backend',
  cms: 'CMS y e-commerce',
  datos: 'Datos',
  infra: 'Infraestructura',
  ia: 'IA aplicada',
};

// Niveles segun lo que declaraste: fuerte en PHP, Laravel, WordPress, bases de
// datos y servidores, y mas flojo en JavaScript y sobre todo React. Los "core"
// se dibujan mas grandes y con la pista encendida por defecto.
//
// TODO(rares): confirmar MongoDB y TypeScript. Los puse en "tocado" por
// deduccion, no porque lo dijeras tu.
export const chips: Chip[] = [
  { id: 'html', label: 'HTML', group: 'base', level: 'solvente' },
  { id: 'css', label: 'CSS', group: 'base', level: 'solvente' },
  { id: 'js', label: 'JavaScript', group: 'base', level: 'solvente' },

  { id: 'ts', label: 'TypeScript', group: 'frontend', level: 'tocado' },
  { id: 'react', label: 'React', group: 'frontend', level: 'tocado' },

  { id: 'php', label: 'PHP', group: 'backend', level: 'core' },
  { id: 'laravel', label: 'Laravel', group: 'backend', level: 'core' },

  { id: 'wordpress', label: 'WordPress', group: 'cms', level: 'core' },
  { id: 'woocommerce', label: 'WooCommerce', group: 'cms', level: 'solvente' },
  { id: 'prestashop', label: 'PrestaShop', group: 'cms', level: 'solvente' },

  { id: 'mysql', label: 'MySQL', group: 'datos', level: 'core' },
  { id: 'mongodb', label: 'MongoDB', group: 'datos', level: 'tocado' },

  { id: 'git', label: 'Git / GitHub', group: 'infra', level: 'solvente' },
  { id: 'servidores', label: 'Servidores', group: 'infra', level: 'core' },
  { id: 'xampp', label: 'XAMPP', group: 'infra', level: 'solvente' },

  { id: 'ia', label: 'ChatGPT · Claude', group: 'ia', level: 'solvente' },
];

// TODO(rares): confirmar o corregir. Estas son las combinaciones que deduzco
// de tu lista; las pistas solo valen si reflejan como trabajas de verdad.
export const traces: Array<[string, string]> = [
  ['html', 'css'],
  ['css', 'js'],
  ['html', 'js'],

  ['js', 'ts'],
  ['ts', 'react'],
  ['js', 'react'],

  ['php', 'laravel'],
  ['laravel', 'mysql'],
  ['php', 'mysql'],
  ['php', 'xampp'],
  ['laravel', 'xampp'],

  ['wordpress', 'php'],
  ['wordpress', 'woocommerce'],
  ['woocommerce', 'mysql'],
  ['prestashop', 'php'],
  ['prestashop', 'mysql'],

  ['js', 'mongodb'],

  ['git', 'servidores'],
  ['react', 'git'],
  ['laravel', 'git'],
];
