const inactiveLineCol = '#999999';
const activeLineCol = '#99FF99';

const droneButtons = document.getElementById('drone_buttons');
const batteryDisplay = document.getElementById('battery_display');
const stateDisplay = document.getElementById('state_display');

const accessToken = '';
let canControl = false

let facilities = [];
let ownFacility = null;
let homeFacility = null;
let facilityDroneState = '';
let droneRequested = false;

let droneMarker = {};
let facilityMarkers = {};
let facilityLines = {};


function init() {
    let map = L.map('map').setView(own_facility.pos, 13);
    L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
        attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
        maxZoom: 18,
        id: 'mapbox/streets-v11',
        tileSize: 512,
        zoomOffset: -1,
        accessToken: accessToken
    }).addTo(mymap);

    droneMarker = L.marker([0.0, 0.0], {title: 'Kurier'});
    for (let facilityId in facilities) {
        facilityMarkers[facilityId] = L.marker(facilities[facilityId].pos, {title: facilities[facilityId].name}).addTo(map);
        if (facilities[facilityId] !== homeFacility) {
            facilityLines[facilityId] = L.polyline(
                [facilities[facilityId].pos].concat(facilities[facilityId].waypoints).concat(homeFacility.pos),
                {color: inactiveLineCol}
            ).addTo(map);
        }
    }

    const socket = io('/frontend');
    socket.on('facility_drone_state', onFacilityDroneState);
    socket.on('drone_state', onDroneState);
    socket.on('heartbeat', onHeartbeat);
    socket.on('drone_requested', onDroneRequested);
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// BUTTONS
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function showButton(text, classList) {
    let button = document.createElement('button');
    button.classList.add('item');
    for (const c of classList) {
        button.classList.add(c);
    }
    button.innerText = text;
    droneButtons.appendChild(button);
    return button;
}

function showTakeoff() {
    let button = showButton('Starterlaubnis erteilen', ['good_step']);
    button.onclick = () => {
        window.location.href = '/drone_control/allow_takeoff';
    };
}

function showReturn() {
    let button = showButton('Sofort umkehren', ['bad_step']);
    button.onclick = () => {
        show_popup('emergency_return');
    }
}

function showLand() {
    let button = showButton('Notlanden', ['bad_step']);
    button.onclick = () => {
        show_popup('emergency_land');
    }
}

function showRequest() {
    let button = showButton(
        droneRequested ? "Kurier angefordert" : "Kurier anfordern",
        droneRequested ? [] : ['good_step']
    )
    button.onclick = () => {
        window.location.href = '/drone_control/request';
    }
    button.id = 'request';
}

function showEmergency() {
    let button = showButton(
        "Der Kurier ist notgelandet und muss sofort von einem Mitarbeiter geborgen werden",
        ['bad_step']
    )
    button.disabled = true;
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// SOCKETIO EVENT HANDLERS
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function onFacilityDroneState(...args) {
    if (args.state === 'idle') {
        facilityLines[args.goal_facility_id].color = inactiveLineCol;
        if (ownFacility !== homeFacility) {
            batteryDisplay.style.display = 'none';
            stateDisplay.style.display = 'none';
        }
    } else {
        batteryDisplay.style.display = 'initial';
        stateDisplay.style.display = 'initial';
        facilityLines[args.goal_facility_id].color = activeLineCol;
    }

    droneButtons.innerHTML = '';
    if (canControl) {
        switch (args.state) {
            case 'idle':
            case 'flying_from':
            case 'returning_from':
                showRequest();
                break;
            case 'awaiting_takeoff':
                showTakeoff();
                break;
            case 'flying_to':
                showReturn();
            case 'returning_to':
                showLand();
                break;
            case 'emergency':
                showEmergency();
                break;
        }
    }
}

function onHeartbeat(args) {
    batteryDisplay.children[0].style.height = (args.battery*100)+'%';
    droneMarker.setLatLng(args.pos)
}

function onDroneState(args) {
    let states = {
        'idle': "Am Boden",
        'en_route': "Fliegt",
        'landing': "Landet",
        'returning': "Kehrt zurück",
        'emergency_landing': "Macht Notlandung",
        'crashed': "Notgelandet",
        'updating': "Empfängt Mission"
    }
    stateDisplay.innerText = states[args.state]
}

function onDroneRequested(arg) {
    droneRequested = arg;
    document.getElementById('request').innerText = droneRequested ? "Kurier angefordert" : "Kurier anfordern";
    if (droneRequested) {
        document.getElementById('request').classList.add('good_step');
    } else {
        document.getElementById('request').classList.remove('good_step')
    }
}