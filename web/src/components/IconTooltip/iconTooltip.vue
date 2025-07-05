<template>
  <cdx-icon :icon="cdxIconInfo()" v-tooltip:bottom="``" size="medium">
    Button with tooltip
  </cdx-icon>
</template>

<script>
import { defineComponent } from 'vue';
import {CdxIcon, CdxTooltip} from '@wikimedia/codex';
import {cdxIconInfo} from "@wikimedia/codex-icons";

export default defineComponent( {
  name: 'TooltipBasic',
  methods: {
    cdxIconInfo() {
      return cdxIconInfo
    }
  },
  components: { CdxIcon },
  directives: {
    tooltip: CdxTooltip
  }
} );
</script>