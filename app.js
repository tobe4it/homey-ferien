/**
 * 'use strict';
 * 
 * const Homey = require('homey');
 * 
 * module.exports = class MyApp extends Homey.App {
 * 
 *   /**
 *    * onInit is called when the app is initialized.
 *    * /
 *   async onInit() {
 *     this.log('MyApp has been initialized');
 *   }
 * 
 * };
*/
const Homey = require('homey');
const axios = require('axios');

class MyApp extends Homey.App {
    async onInit() {
        this.log('App is running...');
        await this.checkHolidaysAndVacations();
    }

    async checkHolidaysAndVacations() {
        const settings = await this.getSettings();
        const today = new Date().toISOString().split('T')[0];
        const year = today.split('-')[0];

        const holidayUrl = `https://feiertage-api.de/api/?jahr=${year}&nur_land=${settings.state}`;
        let isVacation = false;

        try {
            // Feiertage abfragen
            const holidayResponse = await axios.get(holidayUrl);
            const holidays = holidayResponse.data.holidays;
            const isHoliday = holidays.some(holiday => holiday.date === today);

            if (settings.check_vacation) {
                const vacationUrl = `https://schulferien-api.de/api/v2/date/${today}?states=${settings.state}`;
                const vacationResponse = await axios.get(vacationUrl);
                const vacations = vacation

