<script lang="ts">
  import { appStore } from "$lib/stores/app";
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import AccountSidebar from "$lib/components/AccountSidebar.svelte";
  import ProjectionSection from "$lib/components/ProjectionSection.svelte";
  import GeldflussSection from "$lib/components/GeldflussSection.svelte";

  function exportData() {
    const json = JSON.stringify(appStore.getState(), null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finanzplaner-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importData() {
    if (!confirm("Alle aktuellen Daten werden überschrieben. Fortfahren?"))
      return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        const parsed = JSON.parse(text);
        appStore.importState(parsed);
      } catch {
        alert("Ungültige JSON-Datei.");
      }
    };
    input.click();
  }

  function resetData() {
    if (!confirm("Alle Daten auf Standardwerte zurücksetzen?")) return;
    appStore.resetToDefaults();
  }
</script>

<div class="flex h-[calc(100dvh-3rem)]">
  <AccountSidebar />

  <div class="flex-1 overflow-y-auto">
    <div class="mx-auto space-y-10 p-6">
      <ProjectionSection />
      <GeldflussSection />

      <section>
        <h2 class="mb-4 text-base font-semibold">Daten</h2>
        <Card.Root>
          <Card.Content class="flex flex-wrap gap-3 p-4">
            <Button variant="outline" onclick={exportData}>JSON exportieren</Button>
            <Button variant="outline" onclick={importData}>JSON importieren</Button>
            <Button variant="destructive" onclick={resetData}>Auf Standard zurücksetzen</Button>
          </Card.Content>
        </Card.Root>
      </section>
    </div>
  </div>
</div>
