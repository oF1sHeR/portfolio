export const site = {
  name: 'Rares Vasile',
  role: 'Desarrollador web',
  url: 'https://rarestesting.es',
  description:
    'Portfolio de Rares Vasile, desarrollador web full stack. PHP, Laravel y WordPress, con la base de datos y el servidor incluidos.',
  /**
   * Retrato de la cabecera. Ahora apunta a un marcador de posicion.
   *
   * TODO(rares): sustituir por tu foto. Lo ideal son DOS ficheros en /public:
   * el retrato recortado sin fondo (PNG con transparencia) y el original. Con
   * el recorte, el desplazamiento por parallaje separa figura y fondo de
   * verdad, sin necesidad de estimar profundidad a ojo.
   */
  portrait: '/retrato.svg',
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
