import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */
const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    'index',
    {
      type: 'category',
      label: 'Get started',
      items: ['getting-started', 'create-and-open-projects'],
    },
    {
      type: 'category',
      label: 'Write and design',
      items: [
        'writing-and-design',
        'write-in-the-editor',
        'formatting-reference',
        'images-and-assets',
        'book-style',
        'templates-and-styles',
      ],
    },
    {
      type: 'category',
      label: 'Preview and publish',
      items: [
        'preview-and-publishing',
        'preview-modes',
        'book-details-and-page-furniture',
        'exporting-a-book',
      ],
    },
  ],
};

export default sidebars;
