<script lang="ts">
  import * as Tooltip from "$lib/components/ui/tooltip";
  import { Info } from "@lucide/svelte";

  let { text }: { text: string } = $props();
</script>

<Tooltip.Root>
  <Tooltip.Trigger
    class="inline-flex cursor-default text-muted-foreground/40 transition-colors hover:text-muted-foreground focus-visible:outline-none"
  >
    <Info size={12} />
  </Tooltip.Trigger>
  <Tooltip.Content sideOffset={6} class="max-w-56 text-center leading-snug">
    {text}
  </Tooltip.Content>
</Tooltip.Root>
