'use strict';

const Homey = require('homey');
const axios = require('axios');

class FerienApp extends Homey.App {
  async onInit() {
    this.log('Ferien App initialisiert');

    const vacationCard = this.homey.flow.getConditionCard('is_vacation');
    vacationCard.registerRunListener(async () => {
      const state = this.homey.settings.get('state') || 'NI';
      const today = new Date().toISOString().slice(0, 10);
      try {
        const res = await axios.get(`https://schulferien-api.de/api/v2/date/${today}?states=${state}`);
        return res.data?.isHoliday === true;
      } catch (err) {
        this.error('Fehler beim Prüfen der Schulferien:', err.message);
        return false;
      }
    });
    
    const holidayCard = this.homey.flow.getConditionCard('is_holiday');
    holidayCard.registerRunListener(async () => {
      const state = this.homey.settings.get('state') || 'NI';
      const year = new Date().getFullYear();
      const today = new Date().toISOString().slice(0, 10);
      try {
        const res = await axios.get(`https://feiertage-api.de/api/?jahr=${year}&nur_land=${state}`);
        const data = res.data || {};
        const entries = Object.values(data);
        return entries.some(h => (h?.datum || h?.date) === today);
      } catch (err) {
        this.error('Fehler beim Prüfen der Feiertage:', err.message);
        return false;
      }
    });

    // Defaults einmalig setzen, wenn noch nicht vorhanden
    if (this.homey.settings.get('state') == null) {
      this.homey.settings.set('state', 'NI');
    }
    if (this.homey.settings.get('check_vacation') == null) {
      this.homey.settings.set('check_vacation', true); // Default: Ferien prüfen
    }

    // Settings-Change loggen (hilfreich zum Debuggen)
    if (this.homey?.settings?.on) {
      this.homey.settings.on('set', (key) => {
        this.log('Setting changed:', key, this.homey.settings.get(key));
      });
    }

    const state = this.homey.settings.get('state') || 'NI';
    // Default auf TRUE, wenn Setting (noch) fehlt
    const cv = this.homey.settings.get('check_vacation');
    const checkVacation = (cv === undefined || cv === null) ? true : !!cv;

    await this.checkToday({ state, checkVacation });
  }

  async checkToday({ state, checkVacation }) {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const year = today.slice(0, 4);

    // ===== 1) Gesetzliche Feiertage =====
    const feiertageUrl = `https://feiertage-api.de/api/?jahr=${year}&nur_land=${state}`;
    let isPublicHoliday = false;

    try {
      const res = await axios.get(feiertageUrl, { timeout: 10000 });
      const data = res.data || {};
      const entries = Array.isArray(data) ? data : Object.values(data);
      isPublicHoliday = entries.some(h => (h?.datum || h?.date) === today);
    } catch (err) {
      this.error('Fehler beim Laden der gesetzlichen Feiertage:', err?.message || err);
    }

    // ===== 2) Schulferien =====
    let isSchoolVacation = false;

    if (checkVacation) {
      const vacationsUrl = `https://schulferien-api.de/api/v2/date/${today}?states=${state}`;
      try {
        const { data: v } = await axios.get(vacationsUrl, { timeout: 10000 });

        // a) Direktes Flag (schulferien-api: isHoliday == "heute sind Ferien")
        if (typeof v?.isHoliday === 'boolean') {
          isSchoolVacation = v.isHoliday;
        }

        // b) States-Array: [{ code:"NI", isHoliday:true, holidays:[...] }]
        if (!isSchoolVacation && Array.isArray(v?.states)) {
          const entry = v.states.find(s =>
            (s?.code || s?.stateCode || s?.state || s?.id) === state
          );
          if (entry) {
            if (typeof entry.isHoliday === 'boolean') {
              isSchoolVacation = entry.isHoliday;
            }
            if (!isSchoolVacation && Array.isArray(entry.holidays)) {
              const d = Date.parse(`${today}T00:00:00Z`);
              isSchoolVacation = entry.holidays.some(h => {
                const s = Date.parse(h?.start || h?.from);
                const e = Date.parse(h?.end || h?.until);
                // [start, end) – Ende exklusiv
                return Number.isFinite(s) && Number.isFinite(e) && d >= s && d < e;
              });
            }
          }
        }

        // c) Fallback: Root-holidays-Array (start/end)
        if (!isSchoolVacation && Array.isArray(v?.holidays)) {
          const d = Date.parse(`${today}T00:00:00Z`);
          isSchoolVacation = v.holidays.some(h => {
            if (h?.stateCode && h.stateCode !== state) return false;
            const s = Date.parse(h?.start || h?.from);
            const e = Date.parse(h?.end || h?.until);
            return Number.isFinite(s) && Number.isFinite(e) && d >= s && d < e;
          });
        }

      } catch (err) {
        this.error('Fehler beim Laden der Schulferien:', err?.message || err);
      }
    } else {
      this.log('Ferienprüfung deaktiviert (check_vacation=false).');
    }

    const isSpecialDay = isPublicHoliday || isSchoolVacation;

    this.log(
      `Heute (${today}) in ${state}: gesetzlicherFeiertag=${isPublicHoliday}, ` +
      `Schulferien=${isSchoolVacation}, special=${isSpecialDay}`
    );

    return { isPublicHoliday, isSchoolVacation, isSpecialDay };
  }
  async isHolidayToday() {
    const state = this.homey.settings.get('state') || 'NI';
    const result = await this.checkToday({ state, checkVacation: true });
    return result.isPublicHoliday;
  }

  async isVacationToday() {
    const state = this.homey.settings.get('state') || 'NI';
    const result = await this.checkToday({ state, checkVacation: true });
    return result.isSchoolVacation;
  }
}

module.exports = FerienApp;
