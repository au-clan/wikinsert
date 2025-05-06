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
            style="width: 56px; height: 56px;"
        />
        <h1 class="wikimedia-heading wikimedia-text">Wikinsert</h1>
      </div>
      <h2 class="wikimedia-subheading wikimedia-text">
        AI-assisted entity insertion for Wikipedia editors
      </h2>
      <typeaheadSearch></typeaheadSearch>
    </div>
  </main>
</template>