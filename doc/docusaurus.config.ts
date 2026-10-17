import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'Foliform',
  tagline: 'Write. Design. Publish.',
  favicon: 'img/foliform-icon.svg',

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: 'https://foliform.github.io',
  baseUrl: '/Foliform',
  trailingSlash: false,

  onBrokenLinks: 'throw',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Foliform',
      logo: {
        alt: 'Foliform app icon',
        src: 'img/foliform-icon.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'Documentation',
        },
        {
          label: 'Get started',
          to: '/docs/getting-started',
          position: 'right',
          className: 'navbarCta',
        },
        {
          label: 'GitHub',
          href: 'https://github.com/Foliform/Foliform',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Documentation home',
              to: '/docs',
            },
            {
              label: 'Getting started',
              to: '/docs/getting-started',
            },
            {
              label: 'Writing and design',
              to: '/docs/writing-and-design',
            },
            {
              label: 'Templates and styles',
              to: '/docs/templates-and-styles',
            },
            {
              label: 'Markdown and HTML reference',
              to: '/docs/formatting-reference',
            },
            {
              label: 'Preview and publishing',
              to: '/docs/preview-and-publishing',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Foliform. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
