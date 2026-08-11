import {
  Activity,
  BookOpen,
  Braces,
  ChartNoAxesCombined,
  Database,
  FileKey,
  GitBranch,
  Network,
  Search,
  Settings2,
  SlidersHorizontal,
  SpellCheck2,
  Tags,
} from '@lucide/vue';
import type { Component } from 'vue';

export interface NavigationItem {
  label: string;
  to: string;
  icon: Component;
  collectionScoped?: boolean;
}

export interface NavigationGroup {
  label: string;
  items: NavigationItem[];
}

export const navigationGroups: NavigationGroup[] = [
  {
    label: 'Overview',
    items: [
      { label: 'Server status', to: '/', icon: Activity },
      { label: 'Cluster', to: '/clusters', icon: Network },
    ],
  },
  {
    label: 'Data',
    items: [
      { label: 'Collections', to: '/collections', icon: Database },
      { label: 'Search', to: '/collection/current/search', icon: Search, collectionScoped: true },
      {
        label: 'Documents',
        to: '/collection/current/document',
        icon: BookOpen,
        collectionScoped: true,
      },
      { label: 'Schema', to: '/collection/current/schema', icon: Braces, collectionScoped: true },
      { label: 'Aliases', to: '/aliases', icon: GitBranch },
    ],
  },
  {
    label: 'Configuration',
    items: [
      { label: 'API keys', to: '/apikeys', icon: FileKey },
      { label: 'Analytics rules', to: '/analyticsrules', icon: ChartNoAxesCombined },
      { label: 'Search presets', to: '/searchpresets', icon: SlidersHorizontal },
      { label: 'Stopwords', to: '/stopwords', icon: SpellCheck2 },
      { label: 'Stemming', to: '/stemming', icon: Settings2 },
      { label: 'Synonyms', to: '/synonyms', icon: Tags },
      { label: 'Curations', to: '/curations', icon: SlidersHorizontal },
    ],
  },
];
