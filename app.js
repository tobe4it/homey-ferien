'use strict';

const Homey = require('homey');
const axios = require('axios');

class FerienApp extends Homey.App {
  async onInit() {
    this.log('[FerienApp] App initialisiert');

    // einmalig beim Start prüfen & loggen
    const state = this.homey.settings.get('state') || 'NI';
    const checkVacation = !!this.homey.settings.get('check_vacation');
    await this.checkToday({ state, checkVacation });

    // Flow-Karten registrieren (IDs müssen exakt zum Manifest passen)
    await this._registerFlowCards();
  }

  async _registerFlowCards() {
    // Heute gesetzlicher Feiertag?
    this.homey.flow
      .getConditionCard('is_holiday')
      .registerRunListener(async (args) => {
        const chosen = args?.state || this.homey.settings.get('state') || 'NI';
        const s = await this.buildStatus({ state: chosen, checkVacation: false });
        return s.publicHolidayToday === true;
      });

    // Heute Schulferien?
    this.homey.flow
      .getConditionCard('is_vacation')
      .registerRunListener(async (args) => {
        const chosen = args?.state || this.homey.settings.get('state') || 'NI';
        const s = await this.buildStatus({ state: chosen, checkVacation: true });
        return s.schoolVacationToday === true;
      });

    this.log('[FerienApp] Flow-Karten registriert');
  }

  /**
   * Baut den Tagesstatus für Bundesland/Option "Ferien prüfen".
   * Wird von onInit(), den Flow-Karten und api.js (/status) genutzt.
   */
  async buildStatus({ state, checkVacation }) {
    const today = new Date().toISOString().slice(0, 10);
    const year = today.slice(0, 4);

    // — gesetzliche Feiertage —
    let publicHolidayToday = false;
    let publicHolidayNames = [];
    try {
      const res = await axios.get(
        `https://feiertage-api.de/api/?jahr=${year}&nur_land=${state}`,
        { timeout: 10000 }
      );
      const data = res.data || {};
      const list = Array.isArray(data) ? data : Object.values(data);
      publicHolidayToday = list.some(h => (h?.datum || h?.date) === today);
      if (publicHolidayToday) {
        publicHolidayNames = list
          .filter(h => (h?.datum || h?.date) === today)
          .map(h => h?.name || h?.title)
          .filter(Boolean);
      }
    } catch (e) {
      this.error('[FerienApp] Fehler Feiertage:', e.message);
    }

    // — Schulferien (tagesbezogen) —
    let schoolVacationToday = false;
    let vacationNames = [];
    if (checkVacation) {
      try {
        const { data } = await axios.get(
          `https://schulferien-api.de/api/v2/date/${today}?states=${state}`,
          { timeout: 10000 }
        );
        // Beispiel-Antwort:
        // {"date":"YYYY-MM-DD","isHoliday":true,"holidays":[{start,end,name,...}]}
        schoolVacationToday = data?.isHoliday === true;
        vacationNames = Array.isArray(data?.holidays)
          ? data.holidays.map(h => h.name).filter(Boolean)
          : [];
      } catch (e) {
        this.error('[FerienApp] Fehler Schulferien:', e.message);
      }
    }

    return {
      date: today,
      state,
      publicHolidayToday,
      publicHolidayNames,
      schoolVacationToday,
      vacationNames,
      specialToday: publicHolidayToday || schoolVacationToday,
    };
  }

  // nur fürs Log beim Start
  async checkToday({ state, checkVacation }) {
    const s = await this.buildStatus({ state, checkVacation });
    this.log(
      `[FerienApp] Heute (${s.date}) in ${s.state}: ` +
      `gesetzlicherFeiertag=${s.publicHolidayToday}, ` +
      `Schulferien=${s.schoolVacationToday}, ` +
      `Feiertage=${s.publicHolidayNames.join(', ') || '-'}, ` +
      `Ferien=${s.vacationNames.join(', ') || '-'}`
    );
  }
}

module.exports = FerienApp;
