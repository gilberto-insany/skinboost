import { addons } from 'storybook/manager-api';
import { create } from 'storybook/theming';

export function configureManager(proposed = false) {
  addons.setConfig({
    theme: create({
      base: 'light',
      brandTitle: `SkinBoost · ${proposed ? 'Alta fidelidade · proposta' : 'Wireframe atual'}`,
      colorPrimary: '#315e4b',
      colorSecondary: '#315e4b',
      appBg: '#f8f5ed',
      appContentBg: '#fbfbf7',
      fontBase: 'Arial, Helvetica, sans-serif',
    }),
    sidebar: { showRoots: true },
  });
}
