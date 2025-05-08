<template>
  <div class="w-screen">
    <main class="flex justify-center items-start pt-[25vh]">
      <div class="flex flex-col items-center gap-4 w-full max-w-xl px-4">
        <div class="flex items-center justify-center gap-2">
          <img
              src="https://upload.wikimedia.org/wikipedia/commons/6/63/Wikipedia-logo.png"
              alt="Wikipedia Logo"
              class="w-14 h-14"
          />
          <h1 class="wikimedia-heading wikimedia-text">Wikinsert</h1>
        </div>
        <h2 class="text-center wikimedia-subheading wikimedia-text">
          AI-assisted <a class="text-blue-600 underline" target="_blank" href="https://arxiv.org/abs/2410.04254">entity insertion</a> for Wikipedia editors
        </h2>
        <div class="w-full h-full">
          <TypeaheadSearchWikipedia/>
        </div>
      </div>
    </main>
  </div>
</template>


<script setup lang="ts">
import TypeaheadSearchWikipedia from "@/components/TypeaheadSearch/typeaheadSearch.vue";
</script>
