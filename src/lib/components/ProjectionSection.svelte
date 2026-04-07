<script lang="ts">
  import { appStore } from "$lib/stores/app";
  import { projectionUI } from "$lib/stores/projectionUI.svelte";
  import {
    projectAllAccounts,
    projectBalance,
    totalWealthByMonth,
    adjustForInflation,
    totalMattressByMonth,
    mattressBalance,
    applyWhatIfOverrides,
    kapitalertragsteuer,
    formatEur,
    formatPercent,
  } from "$lib/utils/calculations";
  import { whatIfStore } from "$lib/stores/whatif.svelte";
  import { Chart, registerables } from "chart.js";
  import * as Card from "$lib/components/ui/card";
  import { Slider } from "$lib/components/ui/slider";
  import Tip from "$lib/components/Tip.svelte";
  import { X } from "@lucide/svelte";

  Chart.register(...registerables);

  let data = $derived($appStore);

  // Sliders — initialized once from persisted plan, then written back on change
  let localHorizon = $state(20);
  let showInflationAdjusted = $state(false);
  let slidersInit = $state(false);

  $effect(() => {
    if (!slidersInit && data.plan.timeHorizonYears > 0) {
      localHorizon = data.plan.timeHorizonYears;
      projectionUI.inflationRate = data.plan.inflationRate;
      slidersInit = true;
    }
  });

  // Write slider values back to the store (one direction only — no sync effect needed).
  // MarktdatenCard writes directly to projectionUI.inflationRate, bypassing the store.
  $effect(() => {
    if (slidersInit) {
      appStore.updatePlan({
        timeHorizonYears: localHorizon,
        inflationRate: projectionUI.inflationRate,
      });
    }
  });

  // Projections
  let projections = $derived.by(() => {
    if (!slidersInit) return {} as Record<string, number[]>;
    return projectAllAccounts(data.accounts, {
      ...data.plan,
      timeHorizonYears: localHorizon,
    });
  });

  let totalFlexible = $derived(
    totalWealthByMonth(projections, data.accounts, true),
  );
  let totalAll = $derived(
    totalWealthByMonth(projections, data.accounts, false),
  );

  let displayFlexible = $derived(
    showInflationAdjusted
      ? adjustForInflation(totalFlexible, projectionUI.inflationRate)
      : totalFlexible,
  );
  let displayAll = $derived(
    showInflationAdjusted
      ? adjustForInflation(totalAll, projectionUI.inflationRate)
      : totalAll,
  );

  let finalFlexible = $derived(
    displayFlexible[displayFlexible.length - 1] ?? 0,
  );

  let mattressFlexible = $derived.by(() => {
    if (!slidersInit) return [] as number[];
    const nominal = totalMattressByMonth(
      data.accounts,
      { ...data.plan, timeHorizonYears: localHorizon },
      true,
    );
    return showInflationAdjusted
      ? adjustForInflation(nominal, projectionUI.inflationRate)
      : nominal;
  });
  let mattressFinal = $derived(
    mattressFlexible[mattressFlexible.length - 1] ?? 0,
  );
  let interestGain = $derived(finalFlexible - mattressFinal);
  let interestPct = $derived(
    mattressFinal > 0 ? interestGain / mattressFinal : 0,
  );

  // Kapitalertragsteuer — applied per flexible account at end of horizon
  let totalKest = $derived.by(() => {
    if (!slidersInit) return 0;
    // Split freistellungsauftrag evenly across fund accounts (conservative: apply it only once total)
    const frei = data.plan.freistellungsauftrag;
    let remainingFrei = frei;
    let totalTax = 0;
    for (const acc of data.accounts) {
      if (acc.isLocked) continue;
      const vals = projections[acc.id];
      if (!vals) continue;
      const gross = vals[vals.length - 1] ?? 0;
      const months = localHorizon * 12;
      const costBasis = mattressBalance(acc.currentBalance, acc.monthlyContribution, months, acc.contributionGrowthRate ?? 0)[months];
      const tax = kapitalertragsteuer(gross, costBasis, acc.isFund ?? false, remainingFrei);
      // Freistellungsauftrag consumed by first gains; remainder carries forward
      const gains = Math.max(0, gross - costBasis);
      const taxableGains = (acc.isFund ?? false) ? gains * 0.7 : gains;
      remainingFrei = Math.max(0, remainingFrei - taxableGains);
      totalTax += tax;
    }
    return totalTax;
  });
  let finalFlexibleNet = $derived(finalFlexible - totalKest);

  // What-if scenario
  let hasWhatIf = $derived(whatIfStore.activeCount > 0);

  let whatIfAccounts = $derived(
    applyWhatIfOverrides(data.accounts, whatIfStore.overrides),
  );

  let whatIfProjections = $derived.by(() => {
    if (!hasWhatIf || !slidersInit) return {} as Record<string, number[]>;
    return projectAllAccounts(whatIfAccounts, {
      ...data.plan,
      timeHorizonYears: localHorizon,
    });
  });

  let whatIfTotalFlexible = $derived.by(() => {
    if (!hasWhatIf) return [] as number[];
    return totalWealthByMonth(whatIfProjections, whatIfAccounts, true);
  });

  let whatIfDisplayFlexible = $derived.by(() => {
    if (!hasWhatIf) return [] as number[];
    return showInflationAdjusted
      ? adjustForInflation(whatIfTotalFlexible, projectionUI.inflationRate)
      : whatIfTotalFlexible;
  });

  let whatIfFinalFlexible = $derived(
    whatIfDisplayFlexible[whatIfDisplayFlexible.length - 1] ?? 0,
  );
  let whatIfDiff = $derived(hasWhatIf ? whatIfFinalFlexible - finalFlexible : 0);

  // Tax bonus line — reinvested Rürup refunds projected at the best flexible account's return
  let taxBonusLine = $derived.by(() => {
    if (!slidersInit) return [] as number[];
    const monthlyRefund = data.accounts
      .filter((a) => a.isLocked && (a.taxBenefitRate ?? 0) > 0)
      .reduce((s, a) => s + a.monthlyContribution * (a.taxBenefitRate ?? 0), 0);
    if (monthlyRefund === 0) return [] as number[];
    const refundReturnRate =
      data.accounts.find((a) => !a.isLocked && a.expectedAnnualReturn > 0)
        ?.expectedAnnualReturn ?? 0;
    const months = localHorizon * 12;
    const nominal = projectBalance(0, monthlyRefund, refundReturnRate, months);
    return showInflationAdjusted
      ? adjustForInflation(nominal, projectionUI.inflationRate)
      : nominal;
  });

  let taxBonusFinal = $derived(
    taxBonusLine.length > 0 ? (taxBonusLine[taxBonusLine.length - 1] ?? 0) : 0,
  );

  // Single total line: all accounts + reinvested bonus
  let displayTotal = $derived.by(() => {
    if (taxBonusLine.length === 0) return displayAll;
    return displayAll.map((v, i) => v + (taxBonusLine[i] ?? 0));
  });
  let finalTotal = $derived(displayTotal[displayTotal.length - 1] ?? 0);
  let hasPension = $derived(data.accounts.some((a) => a.isLocked));

  // What-if: combined total (all accounts with overrides + bonus)
  let whatIfDisplayTotal = $derived.by(() => {
    if (!hasWhatIf) return [] as number[];
    const whatIfAll = totalWealthByMonth(whatIfProjections, whatIfAccounts, false);
    const base = showInflationAdjusted
      ? adjustForInflation(whatIfAll, projectionUI.inflationRate)
      : whatIfAll;
    if (taxBonusLine.length === 0) return base;
    return base.map((v, i) => v + (taxBonusLine[i] ?? 0));
  });

  // Chart
  let canvas = $state<HTMLCanvasElement | undefined>(undefined);
  let chart: Chart | null = null;

  function drawChart() {
    if (!canvas || data.accounts.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (chart) chart.destroy();

    // chart.destroy() resets canvas dimensions — restore from container before creating new chart
    const container = canvas.parentElement;
    if (container) {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    }

    const months = localHorizon * 12;
    const labels = Array.from({ length: months + 1 }, (_, i) =>
      i % 12 === 0 ? `${i / 12} J` : "",
    );

    const datasets: import("chart.js").ChartDataset<"line">[] = [];
    for (const acc of data.accounts) {
      const vals = projections[acc.id];
      if (!vals) continue;
      const display = showInflationAdjusted
        ? adjustForInflation(vals, projectionUI.inflationRate)
        : vals;
      datasets.push({
        label: acc.name,
        data: display,
        borderColor: acc.color,
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.3,
        fill: false,
      });
    }
    if (hasWhatIf) {
      for (const acc of data.accounts) {
        if (!whatIfStore.hasOverride(acc.id)) continue;
        const vals = whatIfProjections[acc.id];
        if (!vals) continue;
        const display = showInflationAdjusted
          ? adjustForInflation(vals, projectionUI.inflationRate)
          : vals;
        datasets.push({
          label: `${acc.name} (Was wäre wenn)`,
          data: display,
          borderColor: acc.color + "99",
          borderWidth: 1.5,
          borderDash: [5, 4],
          pointRadius: 0,
          tension: 0.3,
          fill: false,
        });
      }
    }
    datasets.push({
      label: "Gesamtvermögen",
      data: displayTotal,
      borderColor: "#ffffff",
      borderWidth: 2.5,
      pointRadius: 0,
      tension: 0.3,
      fill: false,
    });
    if (hasWhatIf && whatIfDisplayTotal.length > 0) {
      datasets.push({
        label: "Gesamtvermögen (Was wäre wenn)",
        data: whatIfDisplayTotal,
        borderColor: "#ffffff66",
        borderWidth: 2,
        borderDash: [5, 4],
        pointRadius: 0,
        tension: 0.3,
        fill: false,
      });
    }

    chart = new Chart(ctx, {
      type: "line",
      data: { labels, datasets },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { labels: { color: "#94a3b8", font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: (c) => `${c.dataset.label}: ${formatEur(c.parsed.y ?? 0)}`,
            },
          },
        },
        scales: {
          x: {
            ticks: { color: "#64748b", maxRotation: 0 },
            grid: { color: "#ffffff0d" },
          },
          y: {
            ticks: { color: "#64748b", callback: (v) => formatEur(Number(v)) },
            grid: { color: "#ffffff0d" },
          },
        },
      },
    });
  }

  $effect(() => {
    void [
      projections,
      displayTotal,
      taxBonusLine,
      showInflationAdjusted,
      localHorizon,
      whatIfProjections,
      whatIfDisplayTotal,
      hasWhatIf,
    ];
    if (canvas) drawChart();
  });

  // Resize chart when the container changes size — debounced via rAF to avoid jank
  $effect(() => {
    const container = canvas?.parentElement;
    if (!container) return;
    let raf: number;
    const observer = new ResizeObserver((entries) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const { width, height } = entries[0].contentRect;
        chart?.resize(width, height);
      });
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  });
</script>

<section>
  <h2 class="mb-4 text-base font-semibold">Projektion</h2>

  <div class="flex flex-col gap-4 sm:flex-row sm:items-start">
    <!-- Controls -->
    <div class="flex shrink-0 flex-col gap-4 sm:w-52">
      <div class="flex items-center justify-between">
        <span class="flex items-center gap-1 text-sm text-muted-foreground">
          Inflationsbereinigt
          <Tip text="Zeigt alle Beträge in heutiger Kaufkraft statt nominalen Zukunftswerten. Nützlich, um den echten Wertzuwachs zu sehen." />
        </span>
        <button
          onclick={() => (showInflationAdjusted = !showInflationAdjusted)}
          class="rounded-full border px-3 py-1 text-xs transition-colors {showInflationAdjusted
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border bg-muted text-muted-foreground hover:text-foreground'}"
        >
          {showInflationAdjusted ? "Ein" : "Aus"}
        </button>
      </div>

      <div class="flex flex-col gap-2">
        <div class="flex justify-between text-sm">
          <span class="flex items-center gap-1 text-muted-foreground">
            Zeithorizont
            <Tip text="Über wie viele Jahre die Entwicklung projiziert wird." />
          </span>
          <span class="font-medium">{localHorizon} J</span>
        </div>
        <Slider type="single" min={5} max={40} step={1} bind:value={localHorizon} />
      </div>

      <div class="flex flex-col gap-2">
        <div class="flex justify-between text-sm">
          <span class="flex items-center gap-1 text-muted-foreground">
            Inflation
            <Tip text="Erwartete jährliche Inflationsrate – nur für die Kaufkraftbereinigung relevant, hat keinen Einfluss auf die Wachstumskurven selbst." />
          </span>
          <span class="font-medium">{formatPercent(projectionUI.inflationRate)}</span>
        </div>
        <Slider
          type="single"
          min={0}
          max={0.1}
          step={0.0025}
          bind:value={projectionUI.inflationRate}
        />
      </div>

      <div class="flex flex-col gap-1.5">
        <label class="flex items-center gap-1 text-sm text-muted-foreground">
          Freistellungsauftrag (€)
          <Tip text="Jährlicher Freibetrag auf Kapitalerträge (Standardwert: 1.000 € für Einzelpersonen, 2.000 € für Ehepaare). Reduziert die Steuer bei Entnahme." />
        </label>
        <input
          type="number"
          class="h-8 w-full rounded-md border border-input bg-background px-3 text-sm"
          min="0"
          step="100"
          value={data.plan.freistellungsauftrag}
          oninput={(e) => appStore.updatePlan({ freistellungsauftrag: Number((e.target as HTMLInputElement).value) || 0 })}
        />
      </div>

      {#if hasWhatIf}
        <button
          onclick={() => whatIfStore.clearAll()}
          class="flex items-center gap-1.5 rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs font-medium text-amber-400 transition-colors hover:bg-amber-400/20"
        >
          <X size={11} />
          Was-wäre-wenn zurücksetzen
        </button>
      {/if}

      <Card.Root class="p-3">
        {#if hasPension || taxBonusFinal > 0}
          <p class="flex items-center gap-1 text-xs text-muted-foreground">
            Gesamtvermögen
            <Tip text="Alle Konten inkl. Altersvorsorge{taxBonusFinal > 0 ? ' + reinvestierte Steuererstattung' : ''} am Ende des Zeithorizonts." />
          </p>
          <p class="mt-0.5 text-lg font-semibold">{formatEur(finalTotal)}</p>
          <div class="mt-2 border-t border-border pt-2">
            <p class="flex items-center gap-1 text-xs text-muted-foreground">
              davon flexibel (brutto)
              <Tip text="Projizierter Gesamtwert aller flexiblen Konten (ohne Altersvorsorge)." />
            </p>
            <p class="text-sm font-medium">{formatEur(finalFlexible)}</p>
          </div>
        {:else}
          <p class="flex items-center gap-1 text-xs text-muted-foreground">
            Endvermögen (brutto)
            <Tip text="Projizierter Gesamtwert am Ende des Zeithorizonts, vor Kapitalertragsteuer." />
          </p>
          <p class="mt-1 text-lg font-semibold">{formatEur(finalFlexible)}</p>
        {/if}
        {#if totalKest > 0}
          <div class="mt-2 border-t border-border pt-2">
            <p class="flex items-center gap-1 text-xs text-muted-foreground">
              Netto nach Steuer (flexibel)
              <Tip text="Flexibles Endvermögen nach Kapitalertragsteuer (26,375%, ggf. Teilfreistellung). Freistellungsauftrag bereits abgezogen." />
            </p>
            <p class="text-sm font-semibold text-sky-400">{formatEur(finalFlexibleNet)}</p>
            <p class="text-[10px] text-muted-foreground">−{formatEur(totalKest)} KeSt</p>
          </div>
        {/if}
        {#if hasWhatIf && whatIfDiff !== 0}
          <div
            class="mt-2 rounded-md border border-amber-400/30 bg-amber-400/10 px-2 py-1.5"
          >
            <div class="flex items-center justify-between">
              <span
                class="text-[10px] font-medium uppercase tracking-wide text-amber-400"
                >Was wäre wenn</span
              >
              <span
                class="text-sm font-semibold {whatIfDiff >= 0
                  ? 'text-green-400'
                  : 'text-red-400'}"
              >
                {whatIfDiff >= 0 ? "+" : ""}{formatEur(whatIfDiff)}
              </span>
            </div>
            <p class="mt-0.5 text-xs text-muted-foreground">
              → {formatEur(whatIfFinalFlexible)} flexibel
            </p>
          </div>
        {/if}
      </Card.Root>
    </div>

    <!-- Chart + mattress -->
    <div class="flex min-w-0 flex-1 flex-col gap-4">
      <Card.Root class="p-4">
        {#if data.accounts.length === 0}
          <p class="text-sm text-muted-foreground">
            Füge Konten hinzu, um die Projektion zu sehen.
          </p>
        {:else}
          <div class="h-96">
            <canvas bind:this={canvas} class="h-full w-full"></canvas>
          </div>
        {/if}
      </Card.Root>

      <!-- Mattress comparison -->
      <Card.Root class="border-indigo-500/30 p-4">
        <p class="mb-3 flex items-center gap-1 text-xs font-medium text-muted-foreground">
          Zinseszins-Vergleich (flexible Konten)
          <Tip text="Zeigt, wie viel du in deine flexiblen Konten eingezahlt hättest – und wie viel davon durch Zinseszins entstanden ist." />
        </p>
        <div class="grid grid-cols-3 gap-4">
          <div>
            <p class="flex items-center gap-1 text-xs text-muted-foreground">
              Eingezahlt
              <Tip text="Summe aller Einzahlungen und Startguthaben in flexible Konten ohne Verzinsung – was du unterm Kopfkissen hättest." />
            </p>
            <p class="mt-0.5 text-base font-semibold">
              {formatEur(mattressFinal)}
            </p>
          </div>
          <div>
            <p class="flex items-center gap-1 text-xs text-muted-foreground">
              Endwert
              <Tip text="Projizierter Gesamtwert der flexiblen Konten mit Zinseszins." />
            </p>
            <p class="mt-0.5 text-base font-semibold">
              {formatEur(finalFlexible)}
            </p>
          </div>
          <div>
            <p class="flex items-center gap-1 text-xs text-muted-foreground">
              Zinsgewinn
              <Tip text="Der Teil deines Endwerts, den du nie eingezahlt hast – kostenloser Zuwachs durch Zinseszins." />
            </p>
            <p class="mt-0.5 text-base font-semibold text-indigo-400">
              +{formatEur(interestGain)}
            </p>
            {#if interestPct > 0}
              <p class="text-xs text-indigo-400/70">
                +{(interestPct * 100).toFixed(0)} % gratis
              </p>
            {/if}
          </div>
        </div>
        {#if totalKest > 0}
          <div class="mt-3 border-t border-border pt-3">
            <div class="flex items-center justify-between">
              <p class="flex items-center gap-1 text-xs text-muted-foreground">
                Kapitalertragsteuer
                <Tip text="Geschätzte Steuer bei Vollentnahme aller flexiblen Konten zum Ende des Zeithorizonts. Berücksichtigt Teilfreistellung (wenn Aktienfonds markiert) und Freistellungsauftrag." />
              </p>
              <p class="text-sm font-medium text-red-400">−{formatEur(totalKest)}</p>
            </div>
            <div class="mt-1 flex items-center justify-between">
              <p class="text-xs text-muted-foreground">Netto-Auszahlung</p>
              <p class="text-sm font-semibold text-sky-400">{formatEur(finalFlexibleNet)}</p>
            </div>
          </div>
        {/if}
        {#if taxBonusFinal > 0}
          <p class="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
            Steuererstattung reinvestiert:
            <span class="font-medium text-amber-400">+{formatEur(taxBonusFinal)}</span>
            bereits im Gesamtvermögen enthalten.
            <Tip text="Hochrechnung, wenn du deine jährliche Steuererstattung aus Altersvorsorge-Beiträgen in dein ETF reinvestierst. Zinssatz = dein bestes flexibles Konto." />
          </p>
        {/if}
      </Card.Root>
    </div>
  </div>
</section>
