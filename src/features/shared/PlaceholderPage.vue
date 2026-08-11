<script setup lang="ts">
import { Construction } from '@lucide/vue';

defineProps<{ title: string }>();
</script>

<template>
  <section class="page-section placeholder-page">
    <div class="placeholder-icon"><Construction :size="24" /></div>
    <p class="eyebrow">Migration workspace</p>
    <h1>{{ title }}</h1>
    <p>This route is wired into the new shell and ready for its feature implementation.</p>
  </section>
</template>
