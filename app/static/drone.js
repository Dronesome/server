// style
const inactiveLineCol = '#999999';
const activeLineCol = '#99FF99';

// DOM
let droneButtons;
let batteryDisplay;
let stateDisplay;
let stateContainer;

let accessToken = '';
let canControl = false;

// facility data (set at the beginning)
let facilities = [];
let ownFacility = null;
let homeFacility = null;

// facility data (set dynamically)
let goalFacility = null;
let facilityState = '';
let droneRequested = false;

// map icons
let droneMarker = null;
let facilityMarkers = [];
let facilityLines = [];
let currentFacilityLine = null;


function init() {
    // get DOM elements
    droneButtons = document.getElementById('drone_buttons');
    batteryDisplay = document.getElementById('battery_display');
    stateDisplay = document.getElementById('state_display');
    stateContainer = document.getElementById('state_container');

    // init map
    let map = L.map('map').setView(ownFacility.pos, 13);
    L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
        attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
        maxZoom: 18,
        id: 'mapbox/streets-v11',
        tileSize: 512,
        zoomOffset: -1,
        accessToken: accessToken
    }).addTo(map);
    droneMarker = L.marker([0.0, 0.0], {title: 'Kurier'});
    for (let facilityId in facilities) {
        facilityMarkers[facilityId] = L.marker(facilities[facilityId].pos, {title: facilities[facilityId].name}).addTo(map);
        if (facilities[facilityId] !== homeFacility) {
            facilityLines[facilityId] = L.polyline(
                [facilities[facilityId].pos].concat(facilities[facilityId].waypoints).concat([homeFacility.pos]),
                {color: inactiveLineCol}
            ).addTo(map);
        }
    }

    // connect via socketio
    const socket = io('/frontend');
    socket.on('facility_state', onFacilityState);
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
    };
}

function showLand() {
    let button = showButton('Notlanden', ['bad_step']);
    button.onclick = () => {
        show_popup('emergency_land');
    };
}

function showRequest() {
    let canRequest = (ownFacility != goalFacility) && canControl && !droneRequested;
    let button = document.getElementById('request');
    if (!button) {
        button = showButton(
            canRequest ? "Kurier anfordern" : "Kurier angefordert",
            canRequest ? ['good_step'] : []
        );
    }
    if (canRequest) {
        button.onclick = () => {
            window.location.href = '/drone_control/request';
        }
    } else {
        button.onclick = null;
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

function onFacilityState(args) {
    console.log('onFacilityState', args);

    // show request button
    goalFacility = facilities[args.goal_id];
    if (ownFacility != homeFacility) showRequest();

    // highlight goal
    facilityMarkers[goalFacility.id].color = '#FF0000';

    // show / hide drone state
    if (args.state === 'idle' && goalFacility != ownFacility) {
        stateContainer.style.display = 'none';
    } else {
        stateContainer.style.display = 'initial';
    }

    // show / hide facility line
    if (goalFacility != homeFacility) currentFacilityLine = facilityLines[goalFacility.id];
    if (currentFacilityLine) currentFacilityLine.color = (args.state === 'idle') ? inactiveLineCol : activeLineCol;

    // show interactions
    droneButtons.innerHTML = '';
    if (canControl) {
        switch (args.state) {
            case 'awaiting_takeoff':
                if (goalFacility != ownFacility) showTakeoff();
                break;
            case 'en_route':
                showReturn();
            case 'returning':
                showLand();
                break;
            case 'emergency':
                showEmergency();
                break;
        }
    }
}

function onHeartbeat(args) {
    console.log('onHeartbeat', args);
    batteryDisplay.children[0].style.width = (args.battery*100)+'%';
    droneMarker.setLatLng(args.pos);
}

function onDroneState(args) {
    console.log('onDroneState', args);
    let states = {
        'idle': "Am Boden",
        'en_route': "Fliegt",
        'landing': "Landet",
        'return_landing': "Landet",
        'returning': "Kehrt zurück",
        'emergency_landing': "Macht Notlandung",
        'crashed': "Notgelandet",
        'updating': "Empfängt Mission"
    };
    stateDisplay.innerText = states[args.state];
}

function onDroneRequested(args) {
    console.log('onDroneRequested', args);
    droneRequested = args.requested; // only true when we are waiting for the mission to start
    showRequest();
}
