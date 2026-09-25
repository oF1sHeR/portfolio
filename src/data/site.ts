export const site = {
  name: 'Rares Vasile',
  role: 'Desarrollador web',
  url: 'https://rarestesting.es',
  description:
    'Portfolio de Rares Vasile, desarrollador web full stack. PHP, Laravel y WordPress, con la base de datos y el servidor incluidos.',
  /**
   * Retrato recortado de la cabecera, generado por scripts/prepare-portrait.mjs.
   * Para rehacerlo con otra foto:
   *
   *   node scripts/prepare-portrait.mjs ruta/a/la/foto.jpg
   */
  portrait: '/retrato.webp',
  locale: 'es-ES',
  email: 'raresvsabau@gmail.com',
  socials: [
    { label: 'GitHub', href: 'https://github.com/oF1sHeR' },
    { label: 'LinkedIn', href: '#' }, // TODO(rares): tu URL de LinkedIn
    { label: 'Email', href: 'mailto:raresvsabau@gmail.com' },
  ],
} as const;

export const nav = [
  { label: 'Inicio', href: '#inicio' },
  { label: 'Perfil', href: '#perfil' },
  { label: 'Proyectos', href: '#proyectos' },
  { label: 'Stack', href: '#stack' },
  { label: 'Contacto', href: '#contacto' },
] as const;
