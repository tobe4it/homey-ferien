'use strict';

const { ApiApp } = require('homey');

class FerienApi extends ApiApp {
  async onInit() {
    this.log('[FerienApi] API initialisiert');
  }

  /**
   * Route: GET /status
   * Gibt aktuellen Status (Feiertag/Ferien) und Einstellungen zurück.
   */
  async getStatus({ homey }) {
    try {
      const state = homey.settings.get('state') || 'NI';
      const checkVacation = !!homey.settings.get('check_vacation');

      const status = await homey.app.buildStatus({ state, checkVacation });

      return {
        ok: true,
        date: status.date,
        state: status.state,
        isPublicHoliday: status.publicHolidayToday,
        isSchoolVacation: status.schoolVacationToday,
        publicHolidayNames: status.publicHolidayNames,
        vacationNames: status.vacationNames,
        specialToday: status.specialToday,
      };
    } catch (err) {
      homey.error('[FerienApi] Fehler in getStatus():', err.message);
      return {
        ok: false,
        error: err.message,
      };
    }
  }
}

module.exports = FerienApi;
