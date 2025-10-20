// settings.js
document.getElementById('settingsForm').onsubmit = function(event) {
    event.preventDefault();
    const state = document.getElementById('state').value;
    const checkVacation = document.getElementById('check_vacation').checked;

    Homey.setSettings({ state, checkVacation });
};

window.onload = function() {
    Homey.getSettings().then(settings => {
        document.getElementById('state').value = settings.state;
        document.getElementById('check_vacation').checked = settings.checkVacation;
    });
};

