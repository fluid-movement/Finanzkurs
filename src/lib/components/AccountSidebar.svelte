<script lang="ts">
  import { appStore } from "$lib/stores/app";
  import {
    projectAllAccounts,
    mattressBalance,
    kapitalertragsteuer,
    formatEur,
  } from "$lib/utils/calculations";
  import Tip from "$lib/components/Tip.svelte";
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { ChevronDown } from "@lucide/svelte";
  import { v4 as uuidv4 } from "uuid";
  import { whatIfStore } from "$lib/stores/whatif.svelte";
  let data = $derived($appStore);

  let expandedId = $state<string | null>(null);
  let wiOpen = $state<string | null>(null);

  $effect(() => {
    const ids = new Set(data.accounts.map((a) => a.id));
    for (const id of Object.keys(whatIfStore.overrides)) {
      if (!ids.has(id)) whatIfStore.clearAccount(id);
    }
  });

  function addAccount() {
    const id = uuidv4();
    appStore.addAccount({
      id,
      name: "Neues Konto",
      currentBalance: 0,
      monthlyContribution: 0,
      expectedAnnualReturn: 0,
      isLocked: false,
      color: "#94a3b8",
    });
    expandedId = id;
  }

  // Per-account insight uses plan.timeHorizonYears directly (kept in sync by ProjectionSection)
  let projections = $derived(projectAllAccounts(data.accounts, data.plan));
</script>

<aside class="flex w-80 shrink-0 flex-col overflow-hidden border-r border-border">
  <div
    class="flex shrink-0 items-center justify-between border-b border-border px-4 py-3"
  >
    <span class="text-sm font-semibold">Konten</span>
    <Button size="sm" variant="ghost" class="h-7 text-xs" onclick={addAccount}
      >+ Konto</Button
    >
  </div>

  <div class="flex-1 overflow-y-auto">
    {#if data.accounts.length === 0}
      <div
        class="flex h-32 items-center justify-center text-sm text-muted-foreground"
      >
        Noch keine Konten.
      </div>
    {/if}

    {#each data.accounts as acc (acc.id)}
      <!-- Collapsed row -->
      <button
        class="w-full border-b border-border p-3 text-left transition-colors hover:bg-muted/50 {expandedId ===
        acc.id
          ? 'bg-muted/50'
          : ''}"
        onclick={() => (expandedId = expandedId === acc.id ? null : acc.id)}
      >
        <div class="flex items-center gap-2 text-sm">
          <span
            class="size-2.5 shrink-0 rounded-full"
            style="background:{acc.color}"
          ></span>
          {#if whatIfStore.hasOverride(acc.id)}
            <span class="size-1.5 shrink-0 rounded-full bg-amber-400" title="Was-wäre-wenn aktiv"></span>
          {/if}
          <span class="flex-1 truncate font-medium">{acc.name}</span>
          {#if acc.isLocked}<span class="text-xs text-muted-foreground"
              >🔒</span
            >{/if}
          <span class="text-xs text-muted-foreground"
            >{formatEur(acc.currentBalance)}</span
          >
        </div>
        <div class="ml-[18px] mt-1 flex gap-3 text-xs text-muted-foreground">
          {#if acc.isLocked && (acc.taxBenefitRate ?? 0) > 0}
            {@const netCost = acc.monthlyContribution * (1 - (acc.taxBenefitRate ?? 0))}
            <span>
              {formatEur(netCost)}/Mo netto
              <span class="opacity-50">({formatEur(acc.monthlyContribution)} brutto)</span>
            </span>
          {:else}
            <span>{formatEur(acc.monthlyContribution)}/Mo</span>
          {/if}
          <span>{(acc.expectedAnnualReturn * 100).toFixed(1)} %</span>
          {#if (acc.contributionGrowthRate ?? 0) > 0}
            <span class="text-emerald-400/70">+{((acc.contributionGrowthRate ?? 0) * 100).toFixed(1)} %/J</span>
          {/if}
        </div>
      </button>

      <!-- Expanded editor -->
      {#if expandedId === acc.id}
        {@const horizon = data.plan.timeHorizonYears}
        {@const months = horizon * 12}
        {@const accVals = projections[acc.id] ?? []}
        {@const accFinal = accVals[accVals.length - 1] ?? 0}
        {@const accMattress = mattressBalance(acc.currentBalance, acc.monthlyContribution, months, acc.contributionGrowthRate ?? 0)[months]}
        {@const accGain = accFinal - accMattress}

        <div class="border-b border-border bg-muted/20 p-4">
          <div class="flex flex-col gap-3">
            <div class="flex flex-col gap-1.5">
              <Label class="text-xs">Name</Label>
              <Input
                class="h-8 text-sm"
                value={acc.name}
                oninput={(e) =>
                  appStore.updateAccount(acc.id, {
                    name: (e.target as HTMLInputElement).value,
                  })}
              />
            </div>

            <div class="grid grid-cols-2 gap-2">
              <div class="flex flex-col gap-1.5">
                <Label class="text-xs">Kontostand (€)</Label>
                <Input
                  class="h-8 text-sm"
                  type="number"
                  value={acc.currentBalance}
                  oninput={(e) =>
                    appStore.updateAccount(acc.id, {
                      currentBalance: Number(
                        (e.target as HTMLInputElement).value,
                      ),
                    })}
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <Label class="text-xs">Einzahlung/Mo (€)</Label>
                <Input
                  class="h-8 text-sm"
                  type="number"
                  value={acc.monthlyContribution}
                  oninput={(e) =>
                    appStore.updateAccount(acc.id, {
                      monthlyContribution: Number(
                        (e.target as HTMLInputElement).value,
                      ),
                    })}
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <Label class="flex items-center gap-1 text-xs">
                  Rendite (%)
                  <Tip text="Erwartete jährliche Rendite vor Inflation. Historischer MSCI World-Durchschnitt: ~7 %." />
                </Label>
                <Input
                  class="h-8 text-sm"
                  type="number"
                  step="0.1"
                  value={(acc.expectedAnnualReturn * 100).toFixed(1)}
                  oninput={(e) =>
                    appStore.updateAccount(acc.id, {
                      expectedAnnualReturn:
                        Number((e.target as HTMLInputElement).value) / 100,
                    })}
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <Label class="text-xs">Farbe</Label>
                <input
                  type="color"
                  class="h-8 w-full cursor-pointer rounded-md border border-input"
                  value={acc.color}
                  oninput={(e) =>
                    appStore.updateAccount(acc.id, {
                      color: (e.target as HTMLInputElement).value,
                    })}
                />
              </div>
            </div>

            <div class="flex flex-col gap-1.5">
              <Label class="flex items-center gap-1 text-xs">
                Beitragswachstum (%/J)
                <Tip text="Jährliche Erhöhung der monatlichen Einzahlung – z. B. 2 % für Gehaltserhöhungen. Bei 0 bleibt der Beitrag konstant." />
              </Label>
              <Input
                class="h-8 text-sm"
                type="number"
                step="0.5"
                min="0"
                max="20"
                value={((acc.contributionGrowthRate ?? 0) * 100).toFixed(1)}
                oninput={(e) =>
                  appStore.updateAccount(acc.id, {
                    contributionGrowthRate:
                      Number((e.target as HTMLInputElement).value) / 100,
                  })}
              />
            </div>

            <div class="flex items-center gap-2">
              <input
                type="checkbox"
                id="fund-{acc.id}"
                checked={acc.isFund ?? false}
                onchange={(e) =>
                  appStore.updateAccount(acc.id, {
                    isFund: (e.target as HTMLInputElement).checked,
                  })}
              />
              <Label class="flex cursor-pointer items-center gap-1 text-xs" for="fund-{acc.id}">
                Aktienfonds / ETF
                <Tip text="Aktiviere dies für Aktienfonds und ETFs. Durch die Teilfreistellung sind 30% der Gewinne steuerfrei → effektiver Steuersatz ~18,5% statt 26,4%." />
              </Label>
            </div>

            <div class="flex items-center gap-2">
              <input
                type="checkbox"
                id="locked-{acc.id}"
                checked={acc.isLocked}
                onchange={(e) =>
                  appStore.updateAccount(acc.id, {
                    isLocked: (e.target as HTMLInputElement).checked,
                  })}
              />
              <Label class="flex cursor-pointer items-center gap-1 text-xs" for="locked-{acc.id}">
                Altersvorsorge-Konto
                <Tip text="Altersvorsorge-Konten (z.B. Rürup, bAV) fließen nicht in das flexible Gesamtvermögen ein und haben im Geldfluss eine eigene Kategorie." />
              </Label>
            </div>

            {#if acc.isLocked}
              <div class="flex flex-col gap-1.5">
                <Label class="flex items-center gap-1 text-xs">
                  Grenzsteuersatz (%)
                  <Tip text="Dein persönlicher Grenzsteuersatz. Bestimmt die jährliche Steuererstattung auf Beiträge. Nachschlagen: bmf-steuerrechner.de" />
                </Label>
                <Input
                  class="h-8 text-sm"
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  value={((acc.taxBenefitRate ?? 0) * 100).toFixed(0)}
                  oninput={(e) =>
                    appStore.updateAccount(acc.id, {
                      taxBenefitRate:
                        Number((e.target as HTMLInputElement).value) / 100,
                    })}
                />
              </div>
            {/if}

            <!-- Per-account insight -->
            <div
              class="flex flex-col gap-1.5 rounded-md border border-border bg-background p-3 text-xs"
            >
              {#if (acc.contributionGrowthRate ?? 0) > 0}
                {@const finalContribution = acc.monthlyContribution * Math.pow(1 + (acc.contributionGrowthRate ?? 0), horizon - 1)}
                <div class="flex justify-between">
                  <span class="flex items-center gap-1 text-muted-foreground">
                    Beitrag in Jahr {horizon}
                    <Tip text="Monatlicher Beitrag im letzten Jahr nach jährlichen Erhöhungen." />
                  </span>
                  <span class="text-emerald-400">{formatEur(finalContribution)}/Mo</span>
                </div>
              {/if}
              <div class="flex justify-between">
                <span class="flex items-center gap-1 text-muted-foreground">
                  Eingezahlt über {horizon} J
                  <Tip text="Gesamte Einzahlungen und Startguthaben ohne Zinsen." />
                </span>
                <span>{formatEur(accMattress)}</span>
              </div>
              <div class="flex justify-between">
                <span class="flex items-center gap-1 text-muted-foreground">
                  Endwert (projiziert)
                  <Tip text="Hochgerechneter Kontostand am Ende des Zeithorizonts mit Zinseszins." />
                </span>
                <span class="font-medium">{formatEur(accFinal)}</span>
              </div>
              <div class="flex justify-between border-t border-border pt-1.5">
                <span class="flex items-center gap-1 text-muted-foreground">
                  Zinsgewinn
                  <Tip text="Endwert minus Eingezahltem – der kostenlose Zinseszinsanteil." />
                </span>
                <span
                  class="font-semibold {accGain >= 0
                    ? 'text-green-400'
                    : 'text-red-400'}"
                >
                  {accGain >= 0 ? "+" : ""}{formatEur(accGain)}{accMattress > 0
                    ? ` (${accGain >= 0 ? "+" : ""}${((accGain / accMattress) * 100).toFixed(0)} %)`
                    : ""}
                </span>
              </div>
              {#if !acc.isLocked && accFinal > 0}
                {@const kest = kapitalertragsteuer(accFinal, accMattress, acc.isFund ?? false, data.plan.freistellungsauftrag)}
                {@const netValue = accFinal - kest}
                <div class="flex justify-between border-t border-border pt-1.5">
                  <span class="flex items-center gap-1 text-muted-foreground">
                    Netto nach Steuer
                    <Tip text="Endwert nach Kapitalertragsteuer (26,375%{acc.isFund ? ', inkl. 30% Teilfreistellung für Aktienfonds' : ''}). Freistellungsauftrag bereits abgezogen." />
                  </span>
                  <span class="font-semibold text-sky-400">{formatEur(netValue)}</span>
                </div>
              {/if}

              {#if (acc.taxBenefitRate ?? 0) > 0}
                {@const netCost = acc.monthlyContribution * (1 - (acc.taxBenefitRate ?? 0))}
                {@const annualRefund = acc.monthlyContribution * (acc.taxBenefitRate ?? 0) * 12}
                <div class="flex justify-between border-t border-border pt-1.5">
                  <span class="flex items-center gap-1 text-muted-foreground">
                    Nettokosten
                    <Tip text="Tatsächliche monatliche Kosten nach Abzug der Steuererstattung." />
                  </span>
                  <span class="font-medium">{formatEur(netCost)}/Mo</span>
                </div>
                <div class="flex justify-between">
                  <span class="flex items-center gap-1 text-muted-foreground">
                    Jährl. Erstattung
                    <Tip text="Jährliche Steuererstattung durch die Abzugsfähigkeit deiner Beiträge." />
                  </span>
                  <span class="font-medium text-amber-400">+{formatEur(annualRefund)}</span>
                </div>
              {/if}
            </div>

            <!-- What-if subsection -->
            {#if true}
              {@const wi = whatIfStore.overrides[acc.id] ?? {}}
              {@const hasWi = whatIfStore.hasOverride(acc.id)}
            <div class="rounded-md border border-amber-400/30 bg-amber-400/5">
              <button
                class="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-amber-400"
                onclick={() => (wiOpen = wiOpen === acc.id ? null : acc.id)}
              >
                <span class="flex-1 text-left">Was wäre wenn?</span>
                {#if hasWi}
                  <span class="rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[10px]">aktiv</span>
                {/if}
                <ChevronDown
                  size={12}
                  class="transition-transform {wiOpen === acc.id ? 'rotate-180' : ''}"
                />
              </button>

              {#if wiOpen === acc.id}
                <div
                  class="flex flex-col gap-2 border-t border-amber-400/20 px-3 pb-3 pt-2"
                >
                  <div class="grid grid-cols-2 gap-2">
                    <div class="flex flex-col gap-1">
                      <Label class="text-xs">Kontostand (€)</Label>
                      <Input
                        class="h-8 text-sm"
                        type="number"
                        placeholder={String(acc.currentBalance)}
                        value={wi.currentBalance ?? ""}
                        oninput={(e) => {
                          const raw = (e.target as HTMLInputElement).value;
                          whatIfStore.setField(
                            acc.id,
                            "currentBalance",
                            raw === "" ? undefined : Number(raw),
                          );
                        }}
                      />
                    </div>
                    <div class="flex flex-col gap-1">
                      <Label class="text-xs">Einzahlung/Mo (€)</Label>
                      <Input
                        class="h-8 text-sm"
                        type="number"
                        placeholder={String(acc.monthlyContribution)}
                        value={wi.monthlyContribution ?? ""}
                        oninput={(e) => {
                          const raw = (e.target as HTMLInputElement).value;
                          whatIfStore.setField(
                            acc.id,
                            "monthlyContribution",
                            raw === "" ? undefined : Number(raw),
                          );
                        }}
                      />
                    </div>
                  </div>
                  <div class="flex flex-col gap-1">
                    <Label class="text-xs">Rendite (%)</Label>
                    <Input
                      class="h-8 text-sm"
                      type="number"
                      step="0.1"
                      placeholder={(acc.expectedAnnualReturn * 100).toFixed(1)}
                      value={wi.expectedAnnualReturn != null
                        ? (wi.expectedAnnualReturn * 100).toFixed(1)
                        : ""}
                      oninput={(e) => {
                        const raw = (e.target as HTMLInputElement).value;
                        whatIfStore.setField(
                          acc.id,
                          "expectedAnnualReturn",
                          raw === "" ? undefined : Number(raw) / 100,
                        );
                      }}
                    />
                  </div>
                  <div class="flex flex-col gap-1">
                    <Label class="text-xs">Beitragswachstum (%/J)</Label>
                    <Input
                      class="h-8 text-sm"
                      type="number"
                      step="0.5"
                      min="0"
                      placeholder={((acc.contributionGrowthRate ?? 0) * 100).toFixed(1)}
                      value={wi.contributionGrowthRate != null
                        ? (wi.contributionGrowthRate * 100).toFixed(1)
                        : ""}
                      oninput={(e) => {
                        const raw = (e.target as HTMLInputElement).value;
                        whatIfStore.setField(
                          acc.id,
                          "contributionGrowthRate",
                          raw === "" ? undefined : Number(raw) / 100,
                        );
                      }}
                    />
                  </div>
                  {#if hasWi}
                    <Button
                      variant="ghost"
                      size="sm"
                      class="self-start text-xs text-amber-400 hover:text-amber-300"
                      onclick={() => whatIfStore.clearAccount(acc.id)}
                    >
                      Zurücksetzen
                    </Button>
                  {/if}
                </div>
              {/if}
            </div>
            {/if}

            <Button
              variant="ghost"
              size="sm"
              class="self-start text-xs text-muted-foreground hover:text-destructive"
              onclick={() => {
                appStore.deleteAccount(acc.id);
                expandedId = null;
              }}
            >
              Konto löschen
            </Button>
          </div>
        </div>
      {/if}
    {/each}
  </div>
</aside>
