const columns = [
    { key: "C.P.", display: "C.P.", default: true },
    { key: "Dirección", display: "Dirección", default: true },
    { key: "Distancia", display: "Distancia", default: true },
    { key: "Horario", display: "Horario", default: true },
    { key: "Latitud", display: "Latitude", default: false },
    { key: "Longitud (WGS84)", display: "Longitud", default: false },
    { key: "Localidad", display: "Localidad", default: true },
    { key: "Margen", display: "Margen", default: false },
    { key: "Municipio", display: "Municipio", default: false },
    { key: "Precio Gasoleo A", display: "Gasoleo A", default: true },
    { key: "Precio Gasoleo Premium", display: "Gasoleo A +", default: true },
    { key: "Precio Gasolina 95 E5", display: "Sin Plomo 95", default: true },
    { key: "Precio Gasolina 98 E5", display: "Sin Plomo 98", default: true },
    { key: "Precio Biodiesel", display: "Biodiesel", default: false },
    { key: "Precio Bioetanol", display: "Bioetanol", default: false },
    { key: "Precio Gas Natural Comprimido", display: "GNC", default: false },
    { key: "Precio Gas Natural Licuado", display: "GNL", default: false },
    { key: "Precio Gases licuados del petróleo", display: "GLP", default: false },
    { key: "Precio Hidrogeno", display: "H2", default: false },
    { key: "Provincia", display: "Provincia", default: false },
    { key: "Remisión", display: "Remission", default: false },
    { key: "Rótulo", display: "Marca", default: true },
    { key: "Tipo Venta", display: "TV", default: false }
];

const loadingMessages = ["loading1", "loading2", "loading3"];

let visibleColumns = columns.filter(col => col.default).map(col => col.key);
let currentStations = [];
let allStations = [];
let sortOrder = {};
let currentSortColumn = null;
let mapEmbedsEnabled = false;
let currentLanguage = 'es';
let translations = {}
let isDarkMode = false;
let messageInterval;
let selectedBrands = new Set();
let currentPage = 1;
const itemsPerPage = 10;

function loadTranslations() {
    return fetch('stuff/translations.json')
        .then(response => response.json())
        .then(data => {
            translations = data;
            return translations;
        })
        .catch(error => {
            console.error('Error loading translations:', error);
            alert('Error loading translations. Please try again later.');
        });
}

function translate(key) {
    return translations[key]?.[currentLanguage] || key;
}

function initializeDarkMode() {
    const body = document.body;
    isDarkMode = localStorage.getItem('darkMode') === 'true';
    body.classList.toggle('dark-mode', isDarkMode);
}

function darkModeToggle() {
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const body = document.body;

    // Remove any existing event listener
    const newDarkModeToggle = darkModeToggle.cloneNode(true);
    darkModeToggle.parentNode.replaceChild(newDarkModeToggle, darkModeToggle);

    newDarkModeToggle.addEventListener('click', () => {
        isDarkMode = !isDarkMode;
        body.classList.toggle('dark-mode', isDarkMode);
        localStorage.setItem('darkMode', isDarkMode);
        updateDarkModeButtonText();
    });
}

function updateDarkModeButtonText() {
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    darkModeToggle.textContent = translate(isDarkMode ? 'lightMode' : 'darkMode');
}



function updateLanguage() {
    document.querySelector('h1').textContent = translate('title');
    document.querySelector('p').textContent = translate('subtitle');
    document.getElementById('toggle-search-menu').textContent = translate('filter');
    document.getElementById('toggle-column-menu').textContent = translate('settings');
    document.getElementById('distance-input').placeholder = translate('distancePlaceholder');
    document.getElementById('filter-by-distance').textContent = translate('filter');
    document.getElementById('provincia-select').firstElementChild.textContent = translate('selectProvincia');
    document.getElementById('municipio-select').firstElementChild.textContent = translate('selectMunicipio');
    document.getElementById('search-button').textContent = translate('search');
    document.getElementById('toggle-brand-filter').textContent = translate('brandFilter');
    document.getElementById('loading-text').textContent = translate('loadingStations');
    initializeColumnMenu();
    initializeDarkMode();

    if (currentStations && currentStations.length > 0) {
        initializeBrandFilterMenu(currentStations);
        displayStations(currentStations);
    }
}

function initializeLanguageSelector() {
    const languageSelector = document.getElementById('language-selector');

    const storedLanguage = localStorage.getItem('selectedLanguage');

    if (storedLanguage) {
        currentLanguage = storedLanguage;
    } else {
        localStorage.setItem('selectedLanguage', currentLanguage);
    }

    languageSelector.value = currentLanguage;

    languageSelector.addEventListener('change', (event) => {
        currentLanguage = event.target.value;
        localStorage.setItem('selectedLanguage', currentLanguage);
        updateLanguage();
    });
}

function saveColumnPreferences() {
    localStorage.setItem('visibleColumns', JSON.stringify(visibleColumns));
}

function loadColumnPreferences() {
    const savedColumns = localStorage.getItem('visibleColumns');
    if (savedColumns) {
        visibleColumns = JSON.parse(savedColumns);
    } else {
        visibleColumns = columns.filter(col => col.default).map(col => col.key);
    }
}

function showMapEmbed(event, station) {
    if (!mapEmbedsEnabled) return;

    const existingEmbed = document.querySelector('.map-embed');
    if (existingEmbed) existingEmbed.remove();

    const mapEmbed = document.createElement('div');
    mapEmbed.className = 'map-embed';
    const lat = parseFloat(station['Latitud'].replace(',', '.'));
    const lon = parseFloat(station['Longitud (WGS84)'].replace(',', '.'));

    const iframe = document.createElement('iframe');
    iframe.width = '300';
    iframe.height = '200';
    iframe.frameBorder = '0';
    iframe.style.border = '0';
    iframe.src = `https://www.openstreetmap.org/export/embed.html?bbox=${lon-0.01},${lat-0.01},${lon+0.01},${lat+0.01}&layer=mapnik&marker=${lat},${lon}`;

    mapEmbed.appendChild(iframe);

    const rect = event.target.getBoundingClientRect();
    mapEmbed.style.position = 'fixed';
    mapEmbed.style.top = `${rect.bottom}px`;
    mapEmbed.style.left = `${rect.left}px`;
    mapEmbed.style.zIndex = '9999';

    document.body.appendChild(mapEmbed);
}

function hideMapEmbed() {
    const mapEmbed = document.querySelector('.map-embed');
    if (mapEmbed) mapEmbed.remove();
}

function calculatePriceStats(stations, priceType) {
    const prices = stations
        .map(station => parseFloat(station[priceType].replace(',', '.')))
        .filter(price => !isNaN(price) && price > 0);

    if (prices.length === 0) return null;

    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const avg = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const delta = max - min;

    return { min, max, avg, delta };
}

function updatePriceStats(stations) {
    const priceColumns = columns.filter(col => col.key.startsWith('Precio'));
    priceColumns.forEach(column => {
        const stats = calculatePriceStats(stations, column.key);
        if (stats) {
            column.stats = stats;
        }
    });
}

function selectAllBrands() {
    const brandFilterMenu = document.getElementById('brand-menu');
    const checkboxes = brandFilterMenu.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.checked = true;
        selectedBrands.add(cb.value);
    });
    updateBrandFilter();
}

function deselectAllBrands() {
    const brandFilterMenu = document.getElementById('brand-menu');
    const checkboxes = brandFilterMenu.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.checked = false;
        selectedBrands.delete(cb.value);
    });
    updateBrandFilter();
}

function updateBrandFilter() {
    const brandFilterMenu = document.getElementById('brand-menu');
    const checkboxes = brandFilterMenu.querySelectorAll('input[type="checkbox"]');

    selectedBrands = new Set(
        Array.from(checkboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value)
    );

    console.log("Updated selectedBrands:", selectedBrands);

    if (currentStations && currentStations.length > 0) {
        displayStations(currentStations);
    }
}

function initializeBrandFilterMenu(stations) {
    const brandFilterMenu = document.getElementById('brand-menu');
    brandFilterMenu.innerHTML = '';

    const closeButton = document.createElement('button');
    closeButton.textContent = '✖';
    closeButton.style.cursor = 'pointer';
    closeButton.style.color = 'red';
    closeButton.addEventListener('click', () => {
        brandFilterMenu.style.display = 'none';
    });
    brandFilterMenu.appendChild(closeButton);

    const titleLabel = document.createElement('label');
    titleLabel.textContent = translate('brandFilter');
    titleLabel.style.fontWeight = 'bold';
    brandFilterMenu.appendChild(titleLabel);

    const selectAllButton = document.createElement('button');
    selectAllButton.textContent = translate('selectAll');
    selectAllButton.addEventListener('click', selectAllBrands);
    brandFilterMenu.appendChild(selectAllButton);

    const deselectAllButton = document.createElement('button');
    deselectAllButton.textContent = translate('deselectAll');
    deselectAllButton.addEventListener('click', deselectAllBrands);
    brandFilterMenu.appendChild(deselectAllButton);

    brandFilterMenu.appendChild(document.createElement('hr'));

    const brands = new Set(stations.map(station => station['Rótulo']));
    console.log("Brands found:", brands);

    brands.forEach(brand => {
        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = brand;
        checkbox.checked = true;
        checkbox.addEventListener('change', updateBrandFilter);
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(brand));
        brandFilterMenu.appendChild(label);
    });

    selectedBrands = new Set(brands);

    console.log("Initial selectedBrands:", selectedBrands);
}

function toggleColumnMenu() {
    const menu = document.getElementById('column-menu');
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

function toggleBrandFilterMenu() {
    const menu = document.getElementById('brand-menu');
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

function initializeColumnMenu() {
    const menu = document.getElementById('column-menu');
    menu.innerHTML = '';

    const closeButton = document.createElement('button');
    closeButton.textContent = '✖';
    closeButton.style.cursor = 'pointer';
    closeButton.style.color = 'red';
    closeButton.addEventListener('click', () => {
        menu.style.display = 'none';
    });
    menu.appendChild(closeButton);

    const settingsLabel = document.createElement('label');
    settingsLabel.textContent = translate('settings');
    settingsLabel.style.fontWeight = 'bold';
    settingsLabel.style.cursor = 'default';
    settingsLabel.style.userSelect = 'none';
    menu.appendChild(settingsLabel);
    menu.appendChild(document.createElement('hr'));

    const generalSettings = document.createElement('div');
    generalSettings.id = 'general-settings';

    // Map Embeds
    const mapEmbedsLabel = document.createElement('label');
    const mapEmbedsCheckbox = document.createElement('input');
    mapEmbedsCheckbox.type = 'checkbox';
    mapEmbedsCheckbox.id = 'map-embeds-checkbox';
    mapEmbedsCheckbox.checked = mapEmbedsEnabled;
    mapEmbedsCheckbox.addEventListener('change', (e) => {
        mapEmbedsEnabled = e.target.checked;
    });
    mapEmbedsLabel.appendChild(mapEmbedsCheckbox);
    mapEmbedsLabel.appendChild(document.createTextNode(translate('mapEmbeds')));
    generalSettings.appendChild(mapEmbedsLabel);

    // Open/Close Filter
    const openCloseLabel = document.createElement('label');
    const openCloseCheckbox = document.createElement('input');
    openCloseCheckbox.type = 'checkbox';
    openCloseCheckbox.id = 'open-close-checkbox';
    openCloseCheckbox.checked = false;
    openCloseLabel.appendChild(openCloseCheckbox);
    openCloseLabel.appendChild(document.createTextNode(translate('openStations')));
    openCloseCheckbox.addEventListener('change', () => {
        if (currentStations && currentStations.length > 0) {
            displayStations(currentStations);
        }
    });
    generalSettings.appendChild(openCloseLabel);

    menu.appendChild(generalSettings);

    const columnsLabel = document.createElement('label');
    columnsLabel.textContent = translate('columns');
    columnsLabel.style.fontWeight = 'bold';
    columnsLabel.style.cursor = 'default';
    columnsLabel.style.userSelect = 'none';
    menu.appendChild(columnsLabel);
    menu.appendChild(document.createElement('hr'));

    const columnSelection = document.createElement('div');
    columnSelection.id = 'column-selection';

    columns.forEach(column => {
        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = column.key;
        checkbox.checked = visibleColumns.includes(column.key);
        checkbox.addEventListener('change', updateVisibleColumns);
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(translate(column.display)));
        columnSelection.appendChild(label);
    });

    menu.appendChild(columnSelection);
}

function updateVisibleColumns() {
    console.log("Updating visible columns...");
    const checkboxes = document.querySelectorAll('#column-selection input[type="checkbox"]');
    console.log("Found checkboxes:", checkboxes.length);

    visibleColumns = Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);

    console.log("Visible columns after filter:", visibleColumns);

    // Ensure at least one column is always visible
    if (visibleColumns.length === 0) {
        visibleColumns = ['Rótulo']; // Default to showing at least the "Marca" column
        const rotuloCB = Array.from(checkboxes).find(cb => cb.value === 'Rótulo');
        if (rotuloCB) rotuloCB.checked = true;
        console.log("No columns selected, defaulting to 'Rótulo'");
    }

    console.log("Final visible columns:", visibleColumns);

    saveColumnPreferences();

    if (currentStations && currentStations.length > 0) {
        console.log("Displaying stations...");
        displayStations(currentStations);
    } else {
        console.error("No stations to display");
    }
}


function showSpinner() {
    const spinner = document.getElementById('loading-spinner');
    const loadingText = document.getElementById('loading-text');
    spinner.style.display = 'flex';
    let messageIndex = 0;

    loadingText.textContent = translate(loadingMessages[messageIndex]);

    messageInterval = setInterval(() => {
        messageIndex = (messageIndex + 1) % loadingMessages.length;
        loadingText.textContent = translate(loadingMessages[messageIndex]);
    }, 2000);
}

function hideSpinner() {
    const spinner = document.getElementById('loading-spinner');
    spinner.style.display = 'none';

    clearInterval(messageInterval);
}

function updateBrandFilterMenu(stations) {
    const brandFilterMenu = document.getElementById('brand-menu');
    const existingBrands = new Set(Array.from(brandFilterMenu.querySelectorAll('input[type="checkbox"]')).map(cb => cb.value));
    const currentBrands = new Set(stations.map(station => station['Rótulo']));

    currentBrands.forEach(brand => {
        if (!existingBrands.has(brand)) {
            const label = document.createElement('label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = brand;
            checkbox.checked = true;
            checkbox.addEventListener('change', updateBrandFilter);
            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(brand));
            brandFilterMenu.appendChild(label);
        }
    });

    existingBrands.forEach(brand => {
        if (!currentBrands.has(brand)) {
            const checkbox = brandFilterMenu.querySelector(`input[value="${brand}"]`);
            if (checkbox) {
                checkbox.parentElement.remove();
            }
        }
    });

    selectedBrands = new Set(
        Array.from(brandFilterMenu.querySelectorAll('input[type="checkbox"]:checked'))
            .map(cb => cb.value)
    );
}


async function fetchStations() {
    showSpinner();
    const urlParams = new URLSearchParams(window.location.search);
    const useMock = urlParams.get('mock') === 'true';
    const fetchUrl = useMock ? 'stuff/mock.json' : 'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/';

    try {
        if (useMock) {
            console.log('Using mock data');
        }
        const response = await fetch(fetchUrl);
        const data = await response.json();
        allStations = data.ListaEESSPrecio;
        hideSpinner();
        return allStations;
    } catch (error) {
        console.error('Error fetching stations:', error);
        hideSpinner();
        alert('Error loading gas stations. Please try again later.');
        return [];
    }
}

function displayStations(stations) {
    if (!Array.isArray(stations)) {
        console.error('displayStations received non-array data:', stations);
        alert('Error: Received invalid data from the server.');
        return;
    }

    console.log("Displaying stations:", stations.length);
    currentStations = stations;
    updatePriceStats(stations);
    updateBrandFilterMenu(stations);

    const tableHead = document.getElementById('stations-table-head');
    const tableBody = document.getElementById('stations-table-body');

    if (!tableHead || !tableBody) {
        console.error('Table head or body not found');
        return;
    }
    tableHead.innerHTML = '';
    tableBody.innerHTML = '';

    // Create table header
    const headerRow = document.createElement('tr');
    visibleColumns.forEach(columnKey => {
        const column = columns.find(col => col.key === columnKey);
        if(column) {
            const th = document.createElement('th');
            th.textContent = translate(column.display);
            if (columnKey.startsWith('Precio') || columnKey === 'Distancia') {
                if (columnKey.startsWith('Precio')) {
                    switch (columnKey) {
                        case 'Precio Gasoleo A':
                            th.classList.add('fuel-diesel');
                            break;
                        case 'Precio Gasoleo Premium':
                            th.classList.add('fuel-diesel-plus');
                            break;
                        case 'Precio Gasolina 95 E5':
                            th.classList.add('fuel-sp-95');
                            break;
                        case 'Precio Gasolina 98 E5':
                            th.classList.add('fuel-sp-98');
                            break;
                        case 'Precio Biodiesel':
                            th.classList.add('fuel-biodiesel');
                            break;
                        case 'Precio Bioetanol':
                            th.classList.add('fuel-bioetanol');
                            break;
                        case 'Precio Gas Natural Comprimido':
                            th.classList.add('fuel-gnc');
                            break;
                        case 'Precio Gas Natural Licuado':
                            th.classList.add('fuel-gnl');
                            break;
                        case 'Precio Gases licuados del petróleo':
                            th.classList.add('fuel-glp');
                            break;
                        case 'Precio Hidrogeno':
                            th.classList.add('fuel-h2');
                            break;
                        default:
                            console.error(`Unknown fuel type: ${columnKey}`);
                    }
                }
                const hasPrices = columnKey === 'Distancia' || columnHasPrices(stations, columnKey);
                if (!hasPrices) {
                    th.style.textDecoration = 'line-through';
                    th.style.color = 'gray';
                } else {
                    th.classList.add('sortable');
                    th.addEventListener('click', () => {
                        const isAscending = currentSortColumn === columnKey ? !sortOrder[columnKey] : true;
                        sortOrder = {};
                        sortOrder[columnKey] = isAscending;
                        if (columnKey === 'Distancia') {
                            sortStationsByDistance(currentStations, isAscending);
                        } else {
                            sortStationsByPrice(currentStations, columnKey, isAscending);
                        }
                    });
                }
            }
            headerRow.appendChild(th);
        } else {
            console.error(`Column not found for key: ${columnKey}`);
        }
    });
    tableHead.appendChild(headerRow);

    // Create table body
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedStations = stations.slice(startIndex, endIndex);

    paginatedStations.forEach((station, index) => {
        const { status, formattedTimetable } = getStatusAndTimetable(station['Horario']);
        const showOnlyOpenStations = document.getElementById('open-close-checkbox').checked;

        if (showOnlyOpenStations && status === translate('closed')) {
            return;
        }

        if (!selectedBrands.has(station['Rótulo'])) {
            return;
        }

        const row = document.createElement('tr');
        visibleColumns.forEach(columnKey => {
            const cell = document.createElement('td');
            if (columnKey === 'Dirección') {
                cell.textContent = station[columnKey] || '';
                cell.classList.add('address-cell');
                cell.addEventListener('mouseenter', (e) => showMapEmbed(e, station));
                cell.addEventListener('mouseleave', hideMapEmbed);
            } else if (columnKey.startsWith('Precio')) {
                cell.classList.add('seven-segment');
                const price = parseFloat(station[columnKey].replace(',', '.'));
                if(isNaN(price) || price===0){
                    cell.textContent = "-";
                } else {
                    cell.textContent = station[columnKey];

                    const column = columns.find(col => col.key === columnKey);
                    const stats = column.stats;
                    if (stats) {
                        if (price === stats.min) cell.classList.add('lowest-price');
                        if (price === stats.max) cell.classList.add('highest-price');
                    }
                }
            } else if (columnKey === 'Horario') {
                console.log(`Station ${index} status:`, status, 'Timetable:', formattedTimetable);
                const statusSpan = document.createElement('span');
                if(status === translate('open247')){
                    statusSpan.className = `status status-open`;
                    statusSpan.textContent = translate('open247')
                } else if(status === translate('open')){
                    statusSpan.className = `status status-open`;
                    statusSpan.textContent = translate('open');
                } else {
                    statusSpan.className = `status status-closed`;
                    statusSpan.textContent = translate('closed');
                }
                cell.appendChild(statusSpan);
                statusSpan.addEventListener('click', (event) => {
                    console.log('Status clicked:', status);
                    event.stopPropagation();
                    showTimetable(cell, formattedTimetable);
                });
            } else if (columnKey === 'Distancia') {
                cell.textContent = station.distance ? `${station.distance.toFixed(2)} km` : 'N/A';
            } else {
                cell.textContent = station[columnKey] || '';
            }
            row.appendChild(cell);
        });
        tableBody.appendChild(row);
    });

    console.log("Table updated with visible columns:", visibleColumns);
    updateSortIndicators();
    updatePaginationControls(stations.length);
}

function updatePaginationControls(totalItems) {
    const paginationContainer = document.getElementById('pagination-controls');
    paginationContainer.innerHTML = '';

    const totalPages = Math.ceil(totalItems / itemsPerPage);

    const prevButton = document.createElement('button');
    prevButton.textContent = 'Previous';
    prevButton.disabled = currentPage === 1;
    prevButton.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            displayStations(currentStations);
        }
    });
    paginationContainer.appendChild(prevButton);

    const nextButton = document.createElement('button');
    nextButton.textContent = 'Next';
    nextButton.disabled = currentPage === totalPages;
    nextButton.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            displayStations(currentStations);
        }
    });
    paginationContainer.appendChild(nextButton);
}

function getStatusAndTimetable(horario) {
    const now = new Date();
    const day = now.getDay();
    const time = now.getHours() * 100 + now.getMinutes();

    const days = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
    const currentDay = days[day];

    let status = translate('closed');
    let formattedTimetable = horario;

    if (horario.includes('24H')) {
        formattedTimetable = translate('open247');
        status = translate('open247');
    } else {
        const schedules = horario.split(';').map(s => s.trim());
        schedules.forEach(schedule => {
            // Nightmare fuel (haha)
            const [daysRange, startHour, thingToSplit, endMinute] = schedule.split(':').map(s => s.trim());
            const [startMin, endHour] = thingToSplit.split('-').map(t => parseInt(t));
            const [startDay, endDay] = daysRange.split('-');
            const openTime = parseInt(startHour) * 100 + parseInt(startMin);
            const closeTime = parseInt(endHour) * 100 + parseInt(endMinute);
            console.log('Checking schedule:', startDay, endDay, openTime, closeTime, currentDay, time)

            const isDayInRange = (startDay === 'L' && endDay === 'D') ||
                (days.indexOf(currentDay) >= days.indexOf(startDay) &&
                    days.indexOf(currentDay) <= days.indexOf(endDay));

            if (isDayInRange) {
                if (time >= openTime && time < closeTime) {
                    status = translate('open');
                }
            }
        });
    }

    return { status, formattedTimetable };
}

function sortStationsByDistance(stations, asc) {
    currentSortColumn = 'Distancia';
    sortOrder['Distancia'] = asc;
    stations.sort((a, b) => {
        const distanceA = a.distance !== undefined ? a.distance : Infinity;
        const distanceB = b.distance !== undefined ? b.distance : Infinity;
        return asc ? distanceA - distanceB : distanceB - distanceA;
    });
    displayStations(stations);
    updateSortIndicators();
}

function showTimetable(cell, timetable) {
    console.log('Showing timetable:', timetable);
    const existingTimetable = document.querySelector('.timetable');

    if (existingTimetable && cell.contains(existingTimetable)) {
        existingTimetable.remove();
        return;
    }

    if (existingTimetable) {
        existingTimetable.remove();
    }

    const timetableElement = document.createElement('div');
    timetableElement.className = 'timetable';
    timetableElement.innerHTML = `<strong>${translate('schedule')}</strong><br>${timetable.replace(/;/g, '<br>')}`;

    const rect = cell.getBoundingClientRect();
    console.log('Cell position:', rect);

    timetableElement.style.position = 'fixed';
    timetableElement.style.top = `${rect.bottom}px`;
    timetableElement.style.left = `${rect.left}px`;
    timetableElement.style.zIndex = '9999';
    timetableElement.style.padding = '10px';
    timetableElement.style.maxWidth = '300px';
    timetableElement.style.wordWrap = 'break-word';
    timetableElement.style.display = 'block';

    // Check if dark mode is active
    if (document.body.classList.contains('dark-mode')) {
        timetableElement.style.backgroundColor = '#2a2a2a';
        timetableElement.style.color = '#f0f0f0';
        timetableElement.style.border = '1px solid #4a4a4a';
        timetableElement.style.boxShadow = '0 2px 5px rgba(255,255,255,0.2)';
    } else {
        timetableElement.style.backgroundColor = 'white';
        timetableElement.style.color = '#333';
        timetableElement.style.border = '1px solid black';
        timetableElement.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    }

    cell.appendChild(timetableElement);
    console.log('Timetable element added to cell');

    const timetableRect = timetableElement.getBoundingClientRect();
    if (timetableRect.right > window.innerWidth) {
        timetableElement.style.left = `${window.innerWidth - timetableRect.width - 10}px`;
    }

    document.addEventListener('click', (event) => {
        console.log('Document clicked:', event.target);
        if (!timetableElement.contains(event.target) && event.target !== cell && !cell.contains(event.target)) {
            timetableElement.remove();
            console.log('Timetable element removed');
        }
    }, { once: true });
}


function updateSortIndicators() {
    const headers = document.querySelectorAll('.sortable');
    headers.forEach(header => {
        header.classList.remove('sorted-asc', 'sorted-desc', 'sorted');
    });

    if (currentSortColumn) {
        const header = Array.from(headers).find(header => {
            const column = columns.find(col => col.key === currentSortColumn);
            return header.textContent === translate(column.display);
        });
        if (header) {
            header.classList.add(sortOrder[currentSortColumn] ? 'sorted-asc' : 'sorted-desc');
            header.classList.add('sorted');
        }
    }
}


function toggleSearchMenu() {
    const menu = document.getElementById('search-menu');
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

function searchStations(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const municipio = formData.get('municipio');
    console.log('Selected municipio:', municipio);

    let url = `https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/FiltroMunicipio/${municipio}`;
    console.log('Request URL:', url);

    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Received data:', data);
            if (Array.isArray(data.ListaEESSPrecio)) {
                displayStations(data.ListaEESSPrecio);
            } else {
                console.error('Unexpected data structure:', data);
                alert('Received unexpected data structure from the server.');
            }
        })
        .catch(error => {
            console.error('Error fetching filtered stations:', error);
            alert('Error loading filtered gas stations. Please try again later.');
        });
}

function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        0.5 - Math.cos(dLat) / 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        (1 - Math.cos(dLon)) / 2;
    return R * 2 * Math.asin(Math.sqrt(a));
}

function columnHasPrices(stations, columnKey) {
    return stations.some(station => {
        const price = parseFloat(station[columnKey].replace(',', '.'));
        return !isNaN(price) && price > 0;
    });
}

function sortStationsByPrice(stations, priceType, asc) {
    if (!columnHasPrices(stations, priceType)) {
        console.log(`Cannot sort by ${priceType} as there are no prices available.`);
        return;
    }
    currentSortColumn = priceType;
    sortOrder[priceType] = asc;
    stations.sort((a, b) => {
        const priceA = parseFloat(a[priceType].replace(',', '.'));
        const priceB = parseFloat(b[priceType].replace(',', '.'));
        if (!isNaN(priceA) && !isNaN(priceB)) {
            return asc ? priceA - priceB : priceB - priceA;
        }
        if (isNaN(priceA)) return 1;
        if (isNaN(priceB)) return -1;
    });
    displayStations(stations);
    updateSortIndicators();
}

function filterStationsByDistance(maxDistance) {
    showSpinner();
    let timeoutReached = false;

    const timeout = setTimeout(() => {
        timeoutReached = true;
        hideSpinner();
        displayStations(allStations);
    }, 5000);

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (position) => {
            if (timeoutReached) return;
            clearTimeout(timeout);

            const { latitude, longitude } = position.coords;
            const stations = allStations.map(station => {
                const stationLat = parseFloat(station.Latitud.replace(',', '.'));
                const stationLon = parseFloat(station["Longitud (WGS84)"].replace(',', '.'));
                const distance = getDistance(latitude, longitude, stationLat, stationLon);
                return { ...station, distance };
            }).filter(station => station.distance <= maxDistance);

            hideSpinner();
            currentStations = stations.sort((a, b) => a.distance - b.distance);
            initializeBrandFilterMenu(currentStations);
            displayStations(currentStations);
        }, (error) => {
            if (timeoutReached) return;
            clearTimeout(timeout);

            console.error("Error getting location:", error);
            hideSpinner();
            alert("Unable to get your location. Please check your browser settings.");
            currentStations = allStations;
            initializeBrandFilterMenu(currentStations);
            displayStations(currentStations);
        });
    } else {
        if (timeoutReached) return;
        clearTimeout(timeout);

        hideSpinner();
        alert('Geolocation is not supported by this browser.');
        currentStations = allStations;
        initializeBrandFilterMenu(currentStations);
        displayStations(currentStations);
    }
}

function handleFilterByDistance() {
    const distanceInput = document.getElementById('distance-input');
    const maxDistance = parseFloat(distanceInput.value);
    if (isNaN(maxDistance) || maxDistance <= 0) {
        alert("Please enter a valid distance in kilometers.");
        return;
    }
    filterStationsByDistance(maxDistance);
}

function syncDistanceInputs() {
    const distanceInput = document.getElementById('distance-input');
    const distanceRange = document.getElementById('distance-range');
    distanceInput.value = distanceRange.value;
}

function initializeDistanceFilter() {
    const distanceInput = document.getElementById('distance-input');
    const distanceRange = document.getElementById('distance-range');
    const filterButton = document.getElementById('filter-by-distance');

    if (distanceInput && distanceRange && filterButton) {
        distanceInput.value = '4';
        distanceRange.value = '4';

        distanceInput.addEventListener('input', () => {
            distanceRange.value = distanceInput.value;
        });

        distanceRange.addEventListener('input', () => {
            distanceInput.value = distanceRange.value;
        });

        filterButton.addEventListener('click', handleFilterByDistance);
    } else {
        console.error('Distance filter elements not found');
    }
}

function initializeLocationFilters() {
    const provinciaSelect = document.getElementById('provincia-select');
    const municipioSelect = document.getElementById('municipio-select');

    fetch('https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/Listados/Provincias/')
        .then(response => response.json())
        .then(data => {
            data.forEach(provincia => {
                const option = document.createElement('option');
                option.value = provincia.IDPovincia;
                option.textContent = provincia.Provincia;
                provinciaSelect.appendChild(option);
            });
        });

    provinciaSelect.addEventListener('change', (event) => {
        const provinciaId = event.target.value;
        municipioSelect.innerHTML = '<option value="">Select Municipio</option>';

        if (provinciaId) {
            fetch(`https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/Listados/MunicipiosPorProvincia/${provinciaId}`)
                .then(response => response.json())
                .then(data => {
                    data.forEach(municipio => {
                        const option = document.createElement('option');
                        option.value = municipio.IDMunicipio;
                        option.textContent = municipio.Municipio;
                        municipioSelect.appendChild(option);
                    });
                });
        }
    });
}


function update_date(date) {
    document.getElementById('update-date').textContent = "Latest update:\n" + date;
}

window.onload = async function() {
    console.log("Initializing app...");
    await loadTranslations();
    allStations = await fetchStations();
    loadColumnPreferences();
    initializeLanguageSelector();
    initializeDistanceFilter();
    initializeLocationFilters();
    initializeColumnMenu();
    initializeDarkMode();
    darkModeToggle();
    updateDarkModeButtonText();
    updateLanguage();
    await filterStationsByDistance(4);
};
document.addEventListener('DOMContentLoaded', () => {
    const storedLanguage = localStorage.getItem('selectedLanguage');
    if (storedLanguage) {
        currentLanguage = storedLanguage;
    }

    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    document.body.classList.toggle('dark-mode', isDarkMode);
});
