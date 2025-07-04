<template>
  <div class="w-screen overflow-x-hidden">
    <main class="flex justify-center items-start pt-[20vh]">
      <div class="flex flex-col items-center gap-6 w-full max-w-xl px-4">
        <!-- Logo and Title -->
        <div class="flex items-center justify-center gap-2">
          <img
              src="https://upload.wikimedia.org/wikipedia/commons/6/63/Wikipedia-logo.png"
              alt="Wikipedia Logo"
              class="w-14 h-14"
          />
          <h1 class="wikimedia-heading wikimedia-text">Wikinsert</h1>
        </div>

        <!-- Subheading -->
        <h2 class="text-center wikimedia-subheading wikimedia-text">
          AI-assisted <a class="text-blue-600 underline" target="_blank" href="https://arxiv.org/abs/2410.04254">entity insertion</a> for Wikipedia editors
        </h2>

        <!-- Language selector -->
        <div class="w-full flex justify-center">
          <select v-model="selectedLang" class="border rounded p-2">
            <option v-for="code in languageCodes" :key="code" :value="code">
              {{ code.toUpperCase() }}
            </option>
          </select>
        </div>

        <!-- Search Component -->
        <div class="w-full">
          <TypeaheadSearchWikipedia :lang="selectedLang" />
        </div>

        <!-- Info Box (Lowered with Cursive Text and Bold Header) -->
        <div class="bg-gray-100 wikimedia-text text-center text-gray-800 text-sm p-4 rounded-xl shadow-md leading-relaxed mt-40">
          <h3 class="wikimedia-subheading text-lg mb-4 wikimedia-text">About</h3>
          <p>Wikinsert is an AI automated tool that seeks to give Wikipedia editors a helping hand in the editorial task of entity insertion.</p>
          <p class="mt-2">Entity insertion involves taking a source article and inserting into it a hyperlink to an external article, denoting for example a concept, object, person, event or other type of entity.</p>
          <p class="mt-2">This project is part of a university bachelor at Aarhus University.</p>
        </div>
      </div>
    </main>
  </div>
</template>




<script setup lang="ts">
import { ref } from 'vue';
import TypeaheadSearchWikipedia from "@/components/TypeaheadSearch/typeaheadSearch.vue";

const languageCodes = [
  "en","de","fr","es","it","nl","pt","ru","ja","zh","ar","sv","pl","cs","fi",
  "no","da","ko","tr","he","uk","ca","hu","el","vi","id", "hi"
];
const selectedLang = ref('en');
</script>
