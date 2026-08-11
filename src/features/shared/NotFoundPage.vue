<script setup lang="ts">
import Button from 'primevue/button';
</script>

<template>
  <main class="standalone-state">
    <span>404</span>
    <h1>Page not found</h1>
    <p>The requested dashboard route does not exist.</p>
    <Button as="router-link" label="Return to status" to="/" />
  </main>
</template>
