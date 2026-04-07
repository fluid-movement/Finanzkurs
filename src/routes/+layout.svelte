<script lang="ts">
  import "./layout.css";
  import favicon from "$lib/assets/favicon.svg";
  import { localStorageAvailable } from "$lib/stores/persistence";
  import { TooltipProvider } from "$lib/components/ui/tooltip";
  import { PiggyBank } from "@lucide/svelte";

  let { children } = $props();
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<div class="flex min-h-dvh flex-col bg-background text-foreground">
  {#if !localStorageAvailable}
    <div
      class="border-b border-yellow-500/40 bg-yellow-500/10 px-4 py-2 text-center text-xs text-yellow-400"
    >
      ⚠ Privater Modus erkannt — Daten werden nicht gespeichert und gehen beim
      Schließen verloren.
    </div>
  {/if}

  <header class="flex h-12 shrink-0 items-center border-b border-border px-4">
    <span class="text-sm flex gap-2 items-center font-semibold"
      ><PiggyBank size="16" />Finanzkurs</span
    >
  </header>

  <main class="flex-1 overflow-hidden">
    <TooltipProvider delayDuration={400}>
      {@render children()}
    </TooltipProvider>
  </main>
</div>
