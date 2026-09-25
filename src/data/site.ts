export const site = {
  name: 'Rares Vasile',
  role: 'Desarrollador web',
  url: 'https://rarestesting.es',
  description:
    'Portfolio de Rares Vasile, desarrollador web. Interfaces rapidas, accesibles y con una capa visual que se recuerda.',
  locale: 'es-ES',
  // TODO(rares): decide que correo quieres publico. No pongo el de trabajo
  // por defecto: un portfolio personal lo indexa Google para siempre.
  email: 'hola@rarestesting.es',
  socials: [
    { label: 'GitHub', href: 'https://github.com/oF1sHeR' },
    { label: 'LinkedIn', href: '#' }, // TODO(rares): tu URL de LinkedIn
    { label: 'Email', href: 'mailto:hola@rarestesting.es' },
  ],
} as const;

export const nav = [
  { label: 'Inicio', href: '#inicio' },
  { label: 'Perfil', href: '#perfil' },
  { label: 'Proyectos', href: '#proyectos' },
  { label: 'Stack', href: '#stack' },
  { label: 'Contacto', href: '#contacto' },
] as const;
