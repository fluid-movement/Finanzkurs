<script lang="ts">
  import { appStore } from "$lib/stores/app";
  import { formatEur } from "$lib/utils/calculations";
  import * as Card from "$lib/components/ui/card";
  import { Input } from "$lib/components/ui/input";
  import Tip from "$lib/components/Tip.svelte";
  import { Pencil } from "@lucide/svelte";

  let data = $derived($appStore);

  let income = $derived(data.plan.monthlyIncome);
  let fixed = $derived(data.plan.monthlyFixedCosts);
  let remaining = $derived(income - fixed);

  let pensionAccounts = $derived(
    data.accounts.filter((a) => a.isLocked && a.monthlyContribution > 0),
  );
  let totalPension = $derived(
    pensionAccounts.reduce((s, a) => s + a.monthlyContribution, 0),
  );

  let savingsAccounts = $derived(
    data.accounts.filter((a) => !a.isLocked && a.monthlyContribution > 0),
  );
  let totalSavings = $derived(
    savingsAccounts.reduce((s, a) => s + a.monthlyContribution, 0),
  );

  let available = $derived(remaining - totalPension - totalSavings);
  let overBudget = $derived(totalPension + totalSavings > remaining);

  let flowEditId = $state<string | null>(null);
  let flowEditValue = $state("");

  function pct(amount: number) {
    if (income === 0) return "0 %";
    return (
      ((amount / income) * 100).toLocaleString("de-DE", {
        maximumFractionDigits: 0,
      }) + " %"
    );
  }

  function startFlowEdit(id: string, current: number) {
    flowEditId = id;
    flowEditValue = String(current);
  }

  function commitFlowEdit(id: string) {
    const val = parseInt(flowEditValue, 10);
    if (!isNaN(val) && val >= 0) {
      if (id === "__income__") appStore.updatePlan({ monthlyIncome: val });
      else if (id === "__fixed__")
        appStore.updatePlan({ monthlyFixedCosts: val });
      else appStore.updateAccount(id, { monthlyContribution: val });
    }
    flowEditId = null;
  }

  function onFlowKeydown(e: KeyboardEvent, id: string) {
    if (e.key === "Enter") commitFlowEdit(id);
    if (e.key === "Escape") flowEditId = null;
  }
</script>

<section>
  <h2 class="mb-4 text-base font-semibold">Geldfluss</h2>

  {#if data.accounts.length === 0}
    <p class="text-sm text-muted-foreground">Keine Konten vorhanden.</p>
  {:else}
    {#if overBudget}
      <div
        class="mb-4 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm text-yellow-400"
      >
        ⚠ Altersvorsorge + Sparpläne ({formatEur(totalPension + totalSavings)})
        übersteigen das verfügbare Einkommen nach Fixkosten ({formatEur(remaining)}).
      </div>
    {/if}

    <div class="flex max-w-lg flex-col">
      <!-- Income -->
      <Card.Root class="rounded-b-none border-b-0 border-blue-500/40">
        <Card.Content class="flex items-center justify-between p-4">
          <div class="flex items-center gap-2 text-sm">
            <span class="size-3 rounded-sm bg-blue-500"></span>
            Monatliches Einkommen
            <Tip text="Dein monatliches Nettoeinkommen. Klicke auf den Betrag, um ihn zu bearbeiten." />
          </div>
          <div class="flex items-center gap-3">
            {#if flowEditId === "__income__"}
              <!-- svelte-ignore a11y_autofocus -->
              <Input
                class="w-24 text-right font-semibold"
                bind:value={flowEditValue}
                onblur={() => commitFlowEdit("__income__")}
                onkeydown={(e) => onFlowKeydown(e, "__income__")}
                autofocus
              />
            {:else}
              <button
                class="cursor-pointer group flex items-center gap-1.5 font-semibold transition-colors hover:text-blue-400"
                onclick={() => startFlowEdit("__income__", income)}
                title="Klicken zum Bearbeiten"
              >
                <span class="border-b border-dashed border-current/40">{formatEur(income)}</span>
                <Pencil size={11} class="opacity-0 transition-opacity group-hover:opacity-60" />
              </button>
            {/if}
            <span class="w-12 text-right text-xs text-muted-foreground">100 %</span>
          </div>
        </Card.Content>
      </Card.Root>

      <div class="ml-6 h-5 w-px bg-border"></div>

      <!-- Fixed costs -->
      <Card.Root class="rounded-none border-b-0 border-t-0 border-red-500/40">
        <Card.Content class="flex items-center justify-between p-4">
          <div class="flex items-center gap-2 text-sm">
            <span class="size-3 rounded-sm bg-red-500"></span>
            Fixkosten
            <Tip text="Monatliche Fixkosten wie Miete, Versicherungen, Abonnements etc. Klicke auf den Betrag zum Bearbeiten." />
          </div>
          <div class="flex items-center gap-3">
            {#if flowEditId === "__fixed__"}
              <!-- svelte-ignore a11y_autofocus -->
              <Input
                class="w-24 text-right font-semibold"
                bind:value={flowEditValue}
                onblur={() => commitFlowEdit("__fixed__")}
                onkeydown={(e) => onFlowKeydown(e, "__fixed__")}
                autofocus
              />
            {:else}
              <button
                class="cursor-pointer group flex items-center gap-1.5 font-semibold transition-colors hover:text-red-400"
                onclick={() => startFlowEdit("__fixed__", fixed)}
                title="Klicken zum Bearbeiten"
              >
                <span class="border-b border-dashed border-current/40">{formatEur(fixed)}</span>
                <Pencil size={11} class="opacity-0 transition-opacity group-hover:opacity-60" />
              </button>
            {/if}
            <span class="w-12 text-right text-xs text-muted-foreground">{pct(fixed)}</span>
          </div>
        </Card.Content>
      </Card.Root>

      <div class="ml-6 h-5 w-px bg-border"></div>

      <!-- Remaining after fixed -->
      <Card.Root class="rounded-none border-b-0 border-t-0 border-violet-500/40">
        <Card.Content class="flex items-center justify-between p-4">
          <div class="flex items-center gap-2 text-sm">
            <span class="size-3 rounded-sm bg-violet-500"></span>
            Verbleibend
            <Tip text="Einkommen minus Fixkosten – der Teil, der für Vorsorge, Sparen und Ausgaben übrig bleibt." />
          </div>
          <div class="flex items-center gap-3">
            <span class="font-semibold">{formatEur(remaining)}</span>
            <span class="w-12 text-right text-xs text-muted-foreground">{pct(remaining)}</span>
          </div>
        </Card.Content>
      </Card.Root>

      <!-- Pension accounts (Altersvorsorge) -->
      {#if pensionAccounts.length > 0}
        {#each pensionAccounts as acc}
          {@const netCost = (acc.taxBenefitRate ?? 0) > 0
            ? acc.monthlyContribution * (1 - (acc.taxBenefitRate ?? 0))
            : null}
          <div class="ml-8 h-px bg-border"></div>
          <Card.Root class="ml-8 rounded-none border-t-0 border-dashed border-orange-500/40">
            <Card.Content class="flex items-center justify-between p-4">
              <div class="flex items-center gap-2 text-sm">
                <span class="size-2 rounded-full" style="background:{acc.color}"></span>
                <span>{acc.name}</span>
                <span class="rounded-full border border-orange-500/40 bg-orange-500/10 px-1.5 py-0.5 text-[10px] text-orange-400">Altersvorsorge</span>
              </div>
              <div class="flex items-center gap-3">
                {#if flowEditId === acc.id}
                  <!-- svelte-ignore a11y_autofocus -->
                  <Input
                    class="w-24 text-right font-semibold"
                    bind:value={flowEditValue}
                    onblur={() => commitFlowEdit(acc.id)}
                    onkeydown={(e) => onFlowKeydown(e, acc.id)}
                    autofocus
                  />
                {:else}
                  <div class="text-right">
                    <button
                      class="group flex items-center gap-1.5 font-semibold transition-colors hover:text-orange-400"
                      onclick={() => startFlowEdit(acc.id, acc.monthlyContribution)}
                      title="Klicken zum Bearbeiten"
                    >
                      <span class="border-b border-dashed border-current/40">
                        {#if netCost !== null}
                          {formatEur(netCost)}
                          <span class="ml-1 text-xs font-normal text-muted-foreground/60">({formatEur(acc.monthlyContribution)})</span>
                        {:else}
                          {formatEur(acc.monthlyContribution)}
                        {/if}
                      </span>
                      <Pencil size={11} class="opacity-0 transition-opacity group-hover:opacity-60" />
                    </button>
                    {#if netCost !== null}
                      <p class="text-[10px] text-muted-foreground">netto (brutto)</p>
                    {/if}
                  </div>
                {/if}
                <span class="w-12 text-right text-xs text-muted-foreground">
                  {pct(acc.monthlyContribution)}
                </span>
              </div>
            </Card.Content>
          </Card.Root>
        {/each}
      {/if}

      <!-- Flexible savings accounts -->
      {#each savingsAccounts as acc}
        <div class="ml-8 h-px bg-border"></div>
        <Card.Root class="ml-8 rounded-none border-t-0 border-dashed">
          <Card.Content class="flex items-center justify-between p-4">
            <div class="flex items-center gap-2 text-sm">
              <span class="size-2 rounded-full" style="background:{acc.color}"></span>
              {acc.name}
            </div>
            <div class="flex items-center gap-3">
              {#if flowEditId === acc.id}
                <!-- svelte-ignore a11y_autofocus -->
                <Input
                  class="w-24 text-right font-semibold"
                  bind:value={flowEditValue}
                  onblur={() => commitFlowEdit(acc.id)}
                  onkeydown={(e) => onFlowKeydown(e, acc.id)}
                  autofocus
                />
              {:else}
                <button
                  class="group flex items-center gap-1.5 font-semibold transition-colors hover:text-foreground"
                  onclick={() => startFlowEdit(acc.id, acc.monthlyContribution)}
                  title="Klicken zum Bearbeiten"
                >
                  <span class="border-b border-dashed border-current/40">{formatEur(acc.monthlyContribution)}</span>
                  <Pencil size={11} class="opacity-0 transition-opacity group-hover:opacity-60" />
                </button>
              {/if}
              <span class="w-12 text-right text-xs text-muted-foreground">
                {pct(acc.monthlyContribution)}
              </span>
            </div>
          </Card.Content>
        </Card.Root>
      {/each}

      <div class="ml-8 h-px bg-border"></div>

      <!-- Available -->
      <Card.Root
        class="ml-8 rounded-t-none border-t-0 border-dashed {available < 0
          ? 'border-red-500/40'
          : 'border-green-500/40'}"
      >
        <Card.Content class="flex items-center justify-between p-4">
          <div class="flex items-center gap-2 text-sm">
            <span class="size-2 rounded-full bg-green-500"></span>
            Verfügbar zum Ausgeben
            <Tip text="Was nach Fixkosten, Altersvorsorge und Sparplänen für den Lebensunterhalt übrig bleibt." />
          </div>
          <div class="flex items-center gap-3">
            <span class="font-semibold {available < 0 ? 'text-red-400' : ''}">
              {formatEur(available)}
            </span>
            <span class="w-12 text-right text-xs text-muted-foreground">
              {pct(Math.max(available, 0))}
            </span>
          </div>
        </Card.Content>
      </Card.Root>
    </div>

    <p class="mt-4 text-sm text-muted-foreground">
      Du investierst
      <span class="font-medium text-foreground">{formatEur(totalSavings)}</span>
      flexibel{#if totalPension > 0} und
      <span class="font-medium text-foreground">{formatEur(totalPension)}</span>
      in Altersvorsorge{/if}
      pro Monat. Zum Leben bleiben dir ~<span class="font-medium text-foreground"
        >{formatEur(Math.max(available, 0))}</span
      >.
    </p>
  {/if}
</section>
