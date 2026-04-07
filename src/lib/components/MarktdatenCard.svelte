<script lang="ts">
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import Tip from "$lib/components/Tip.svelte";
  import { projectionUI } from "$lib/stores/projectionUI.svelte";
  import { RefreshCw } from "@lucide/svelte";

  type InflationDatum = {
    value: number;
    date: string;
  };

  let inflation = $state<InflationDatum | null>(null);
  let loading = $state(true);
  let fetchedAt = $state<Date | null>(null);

  async function load() {
    loading = true;
    try {
      const res = await fetch(
        "https://api.worldbank.org/v2/country/DE/indicator/FP.CPI.TOTL.ZG?format=json&mrv=1",
      );
      const json = await res.json();
      const entry = json?.[1]?.[0];
      inflation = entry?.value != null ? { value: entry.value, date: entry.date } : null;
    } catch {
      inflation = null;
    }
    fetchedAt = new Date();
    loading = false;
  }

  $effect(() => { load(); });

  function applyInflation() {
    if (inflation) projectionUI.inflationRate = inflation.value / 100;
  }

  function formatTime(d: Date) {
    return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  }
</script>

<div class="w-64 shrink-0">
  <div class="mb-4 flex items-center justify-between">
    <h2 class="text-base font-semibold">Marktdaten</h2>
    <button
      onclick={load}
      disabled={loading}
      class="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
      title="Aktualisieren"
    >
      <RefreshCw size={13} class={loading ? "animate-spin" : ""} />
    </button>
  </div>

  <Card.Root>
    <Card.Content class="flex flex-col gap-0 p-0">
      {#if loading}
        <div class="flex items-center justify-center py-8 text-xs text-muted-foreground">
          Laden…
        </div>
      {:else}
        <!-- Inflation -->
        <div class="flex flex-col gap-2 p-4">
          <div class="flex items-center justify-between">
            <span class="flex items-center gap-1 text-xs text-muted-foreground">
              Inflationsrate (DE)
              <Tip text="Jährliche Veränderung des Verbraucherpreisindex (CPI) für Deutschland. Quelle: World Bank. Letztverfügbares Jahr – kann 1–2 Jahre zurückliegen." />
            </span>
            {#if inflation}
              <span class="text-[10px] text-muted-foreground/60">{inflation.date}</span>
            {/if}
          </div>
          {#if inflation}
            <div class="flex items-end justify-between">
              <span class="text-xl font-semibold">
                {inflation.value.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %
              </span>
              <span class="rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">World Bank</span>
            </div>
            <Button variant="outline" size="sm" class="h-7 w-full text-xs" onclick={applyInflation}>
              Als Inflationsrate übernehmen
            </Button>
          {:else}
            <span class="text-sm text-muted-foreground">Nicht verfügbar</span>
          {/if}
        </div>

        <div class="border-t border-border"></div>

        <!-- MSCI World static reference -->
        <div class="flex flex-col gap-1 p-4">
          <span class="flex items-center gap-1 text-xs text-muted-foreground">
            MSCI World (hist. Ø)
            <Tip text="Historische durchschnittliche Jahresrendite des MSCI World Index über ~50 Jahre, nominal in USD. Häufig als Richtwert für langfristige Aktienrenditen verwendet. Kein Zukunftsversprechen." />
          </span>
          <div class="flex items-end justify-between">
            <span class="text-xl font-semibold">~ 7–8 %</span>
            <span class="rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">Referenz</span>
          </div>
          <p class="text-[11px] text-muted-foreground">Typischer Richtwert für globale ETFs.</p>
        </div>

        <div class="border-t border-border"></div>

        <!-- MSCI World EUR static reference -->
        <div class="flex flex-col gap-1 p-4">
          <span class="flex items-center gap-1 text-xs text-muted-foreground">
            MSCI World (hist. Ø, EUR)
            <Tip text="Historische Rendite des MSCI World in EUR liegt durch Währungseffekte (USD/EUR) typischerweise etwas niedriger, ca. 6–7 % p.a. Je nach Zeitraum kann sie aber auch höher ausfallen." />
          </span>
          <div class="flex items-end justify-between">
            <span class="text-xl font-semibold">~ 6–7 %</span>
            <span class="rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">Referenz</span>
          </div>
          <p class="text-[11px] text-muted-foreground">In EUR – für deutsche Anleger relevanter.</p>
        </div>
      {/if}
    </Card.Content>
  </Card.Root>

  {#if fetchedAt && !loading}
    <p class="mt-2 text-right text-[10px] text-muted-foreground/50">
      Abgerufen um {formatTime(fetchedAt)}
    </p>
  {/if}
</div>
