import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

export const TypesensePreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#fff5f2',
      100: '#ffe8e1',
      200: '#ffd2c7',
      300: '#ffad9b',
      400: '#fa826b',
      500: '#ed6048',
      600: '#ce422e',
      700: '#aa3425',
      800: '#8c2e24',
      900: '#742b23',
      950: '#3f120d',
    },
    colorScheme: {
      light: {
        surface: {
          0: '#fffdfc',
          50: '#fff8f6',
          100: '#fcece8',
          200: '#f7dcd5',
          300: '#ecc6bc',
          400: '#c99f96',
          500: '#a77e78',
          600: '#80605d',
          700: '#624846',
          800: '#433133',
          900: '#2d1d21',
          950: '#1b1014',
        },
        primary: {
          color: '{primary.600}',
          inverseColor: '#ffffff',
          hoverColor: '{primary.700}',
          activeColor: '{primary.800}',
        },
        highlight: {
          background: 'rgb(237 96 72 / 14%)',
          focusBackground: 'rgb(237 96 72 / 22%)',
          color: '{primary.800}',
          focusColor: '{primary.900}',
        },
        formField: {
          background: 'rgb(255 252 250 / 88%)',
          borderColor: 'rgb(205 102 84 / 20%)',
          hoverBorderColor: 'rgb(224 105 82 / 38%)',
          focusBorderColor: '{primary.color}',
          color: '{surface.900}',
          placeholderColor: '{surface.500}',
        },
      },
      dark: {
        surface: {
          0: '#ffffff',
          50: '#fff7f4',
          100: '#f8e3de',
          200: '#e7c9c4',
          300: '#c9a6a6',
          400: '#a78084',
          500: '#87636a',
          600: '#684952',
          700: '#4d333d',
          800: '#35232b',
          900: '#24171e',
          950: '#160e13',
        },
        primary: {
          color: '{primary.400}',
          inverseColor: '{surface.950}',
          hoverColor: '{primary.300}',
          activeColor: '{primary.200}',
        },
        highlight: {
          background: 'rgb(255 128 104 / 17%)',
          focusBackground: 'rgb(255 128 104 / 26%)',
          color: '{primary.100}',
          focusColor: '{primary.50}',
        },
        formField: {
          background: 'rgb(49 32 40 / 88%)',
          borderColor: 'rgb(255 142 118 / 20%)',
          hoverBorderColor: 'rgb(255 131 105 / 34%)',
          focusBorderColor: '{primary.color}',
          color: '{surface.50}',
          placeholderColor: '{surface.400}',
        },
      },
    },
  },
});
