/* global Homey */
(() => {
  const $ = sel => document.querySelector(sel);

  const ui = {
    date: $('#date'),
    state: $('#state'),
    stateBadge: $('#stateBadge'),
    ph: $('#ph'),
    vac: $('#vac'),
    phNames: $('#phNames'),
    vacNames: $('#vacNames'),
    special: $('#special'),
    refreshBtn: $('#refresh'),
  };

  async function fetchStatus() {
    ui.refreshBtn.disabled = true;
    const oldLabel = ui.refreshBtn.textContent;
    ui.refreshBtn.textContent = 'Aktualisiere…';
    try {
      const res = await Homey.api('GET', '/status');
      if (!res || res.ok === false) throw new Error(res?.error || 'Unbekannter Fehler');

      ui.date.textContent = res.date || '–';
      ui.state.textContent = res.state || '–';
      ui.stateBadge.textContent = res.state ? `Bundesland: ${res.state}` : '';

      ui.ph.innerHTML  = res.isPublicHoliday   ? '<span class="ok">Ja</span>' : '<span class="bad">Nein</span>';
      ui.vac.innerHTML = res.isSchoolVacation  ? '<span class="ok">Ja</span>' : '<span class="bad">Nein</span>';

      ui.phNames.textContent  = Array.isArray(res.publicHolidayNames) && res.publicHolidayNames.length
        ? res.publicHolidayNames.join(', ')
        : '–';

      ui.vacNames.textContent = Array.isArray(res.vacationNames) && res.vacationNames.length
        ? res.vacationNames.join(', ')
        : '–';

      ui.special.innerHTML = res.specialToday
        ? '<span class="ok">Ja</span>'
        : '<span class="bad">Nein</span>';

    } catch (err) {
      console.error('[settings] /status error:', err);
      ui.special.innerHTML = `<span class="bad">Fehler: ${err.message}</span>`;
    } finally {
      ui.refreshBtn.textContent = oldLabel;
      ui.refreshBtn.disabled = false;
    }
  }

  Homey.on('ready', async () => {
    ui.refreshBtn.addEventListener('click', fetchStatus);
    await fetchStatus();
    Homey.ready(); // <<< ohne das bleibt der Spinner in der Mobile-App
  });
})();
