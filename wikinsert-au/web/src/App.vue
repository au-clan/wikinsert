<script setup lang="ts" xmlns="http://www.w3.org/1999/html">
import typeaheadSearch from './components/typeaheadSearch.vue';
</script>

<template>
  <main style="display: flex; height: 100vh; justify-content: center; align-items: center;">
    <div style="display: flex; flex-direction: column; align-items: center; gap: 1rem; justify-content: center;">
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        <img
            src="https://upload.wikimedia.org/wikipedia/commons/6/63/Wikipedia-logo.png"
            alt="Wikipedia Logo"
            style="width: 40px; height: 40px;"
        />
        <h1 class="wikimedia-heading">Wikinsert</h1>
      </div>
      <h2 class="wikimedia-subheading">
        AI-assisted entity insertion for Wikipedia editors
      </h2>
      <typeaheadSearch></typeaheadSearch>
    </div>
  </main>
</template>

<style scoped>
@import '@wikimedia/codex-design-tokens/theme-wikimedia-ui.css';

.wikimedia-heading {
  font-family: var(--font-family-sans),sans-serif;
  font-size: var(--font-size-xxx-large);
  font-weight: var(--font-weight-normal);
  line-height: var(--line-height-xxx-large);
  margin: 0;
}

.wikimedia-subheading {
  font-family: var(--font-family-sans), sans-serif;
  font-size: var(--font-size-large);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-large);
  margin: 0;
}
</style>