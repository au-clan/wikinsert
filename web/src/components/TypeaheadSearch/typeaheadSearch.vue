<template>
	<div class="wikimedia-text">
		<cdx-typeahead-search
			id="typeahead-search-wikipedia"
			form-action="#"
			:search-results="searchResults"
			:show-thumbnail="true"
			:highlight-query="true"
      :visible-item-limit=6
			placeholder=""
			@input="onInput"
			@search-result-click="onSearchResultClick"
			@submit="onSubmit"
		>
			<template #default>
				<input
					type="hidden"
					:value="lang"

				>
				<input
					type="hidden"
					value="Special:Search"
				>
			</template>
		</cdx-typeahead-search>
	</div>
</template>

<script lang="ts">
import {defineComponent, ref} from 'vue';
import {CdxTypeaheadSearch} from '@wikimedia/codex';
import type {SearchResult} from '@wikimedia/codex/dist/types/types.d.ts';
import type {FilteredArticle} from '../../../../extension/src/popup.js'

export default defineComponent({
  name: 'TypeaheadSearchWikipedia',
  components: { CdxTypeaheadSearch },
  props: {
    lang: {
      type: String,
      default: 'en'
    }
  },
  setup(props) {
		const searchResults = ref<SearchResult[]>( [] );
		const currentSearchTerm = ref( '' );

		function onInput( value: string ) {
			// eslint-disable-next-line no-console
			console.log( 'input event emitted with value:', value );

			// Internally track the current search term.
			currentSearchTerm.value = value;

			// Unset search results and the search footer URL if there is no value.
			if ( !value || value === '' ) {
				searchResults.value = [];
				return;
			}

		const lang = props.lang;

      /**
       * Format search results for consumption by TypeaheadSearch.
       *
       * @param filteredArticles
       * @return
       */
      function adaptApiResponse( filteredArticles: FilteredArticle[] ): SearchResult[] {
        return filteredArticles.map( ( { title, description, thumbnail, revid } ) => ( {
          label: title,
          value: crypto.randomUUID(),
          description: description,
          url: `https://${encodeURIComponent(lang)}.wikipedia.org/w/index.php?/title=${title}&oldid=${revid}`,
          thumbnail: thumbnail ? {
            url: thumbnail.source,
            width: thumbnail.width,
            height: thumbnail.height
          } : undefined
        } ) );
      }

      const baseApiUrl = "http://odin.st.lab.au.dk:8081";
			const url = `${baseApiUrl}/search?` +
                `&q=${encodeURIComponent(value)}` +
                `&lang=${encodeURIComponent(lang)}`;
			fetch(
				url
			).then( ( resp ) => resp.json() )
				.then( ( data ) => {
					console.log( 'data:', data );
					if ( currentSearchTerm.value === value ) {
						searchResults.value = data && data.length > 0 ?
							adaptApiResponse( data ) :
							[];
					}
				} ).catch( () => {
					// On error, reset search results and search footer URL.
          console.log("Could not fetch data from server")
					searchResults.value = [];
				} );
		}

		function onSearchResultClick( value: string ) {
			// eslint-disable-next-line no-console
			console.log( 'search-result-click event emitted with value:', value );
		}

		function onSubmit( value: string ) {
			// eslint-disable-next-line no-console
			const url = searchResults.value[0].url
			if(!url) {
				return
			}
			window.open(url)
		}

		return {
			searchResults,
			onInput,
			onSearchResultClick,
			onSubmit
		};
	}
} );
</script>