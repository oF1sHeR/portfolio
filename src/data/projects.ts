export interface Project {
  slug: string;
  title: string;
  summary: string;
  year: string;
  role: string;
  stack: string[];
  href?: string;
  repo?: string;
}

// TODO(rares): sustituir por proyectos reales. Deje la forma de los datos
// cerrada para que solo tengas que cambiar el contenido, no el markup.
export const projects: Project[] = [
  {
    slug: 'liquid-chrome',
    title: 'Este portfolio',
    summary:
      'Superficie de cromo liquido renderizada en un unico shader de pantalla completa. El nombre no esta dibujado encima: esta esculpido en el campo de altura del metal.',
    year: '2026',
    role: 'Diseño y desarrollo',
    stack: ['Astro', 'Three.js', 'GLSL', 'GSAP'],
    href: 'https://rarestesting.es',
    repo: 'https://github.com/oF1sHeR/portfolio',
  },
  {
    slug: 'proyecto-dos',
    title: 'Proyecto dos',
    summary: 'Describe aqui el problema que resolvia y que impacto tuvo, no las tecnologias.',
    year: '2025',
    role: 'Full stack',
    stack: ['TypeScript', 'Node', 'PostgreSQL'],
  },
  {
    slug: 'proyecto-tres',
    title: 'Proyecto tres',
    summary: 'Un caso donde el rendimiento o la accesibilidad fueron el reto principal.',
    year: '2025',
    role: 'Frontend',
    stack: ['React', 'Tailwind'],
  },
];

export const skills = [
  { group: 'Lenguajes', items: ['TypeScript', 'JavaScript', 'PHP', 'SQL', 'GLSL'] },
  { group: 'Frontend', items: ['Astro', 'React', 'Tailwind', 'Three.js', 'GSAP'] },
  { group: 'Backend', items: ['Node', 'MySQL', 'PostgreSQL', 'REST'] },
  { group: 'Infra', items: ['Git', 'GitHub Actions', 'Linux', 'Plesk', 'Nginx'] },
];
