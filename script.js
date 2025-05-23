$.fn.dataTable.ext.type.order['price-with-na-asc'] = function(a, b) {
    const getPrice = (data) => {
        if (typeof data === 'string') {
            if (data.includes('N/A') || data.includes('unavailable')) {
                return Number.MAX_VALUE;
            }
            const priceMatch = data.match(/>([\d,]+)€</);
            if (priceMatch) {
                return parseFloat(priceMatch[1].replace(',', '.'));
            }
        }
        return Number.MAX_VALUE;
    };
    
    return getPrice(a) - getPrice(b);
};

$.fn.dataTable.ext.type.order['price-with-na-desc'] = function(a, b) {
    const getPrice = (data) => {
        if (typeof data === 'string') {
            if (data.includes('N/A') || data.includes('unavailable')) {
                return -Number.MAX_VALUE;
            }
            const priceMatch = data.match(/>([\d,]+)€</);
            if (priceMatch) {
                return parseFloat(priceMatch[1].replace(',', '.'));
            }
        }
        return -Number.MAX_VALUE;
    };
    
    return getPrice(b) - getPrice(a);
};

class GasStationApp {
    constructor() {
        this.data = [];
        this.dataTable = null;
        this.apiUrl = 'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/';
        this.activeFuels = ['gasolina95', 'gasoleo']; // Default visible fuels
        this.cookieConsent = false;
        this.darkMode = false;
        this.fuelMapping = {
            'gasolina95': 'Precio Gasolina 95 E5',
            'gasoleo': 'Precio Gasoleo A',
            'gasolina98': 'Precio Gasolina 98 E5',
            'gasoleoB': 'Precio Gasoleo B',
            'gasolina95Premium': 'Precio Gasolina 95 E5 Premium',
            'gasoleoPremium': 'Precio Gasoleo Premium',
            'gasolina95E10': 'Precio Gasolina 95 E10',
            'gasolina98E10': 'Precio Gasolina 98 E10',
            'glp': 'Precio Gases licuados del petróleo',
            'gnc': 'Precio Gas Natural Comprimido',
            'gnl': 'Precio Gas Natural Licuado',
            'adblue': 'Precio Adblue',
            'biodiesel': 'Precio Biodiesel',
            'bioetanol': 'Precio Bioetanol',
            'hidrogeno': 'Precio Hidrogeno',
            'gasolinaRenovable': 'Precio Gasolina Renovable'
        };
        
        this.initializeElements();
        this.initializeCookieConsent();
        this.loadSettings();
        this.attachEventListeners();
        this.initializeDataTable();
        this.loadData();
    }

    initializeElements() {
        this.loadingEl = document.getElementById('loading');
        this.errorEl = document.getElementById('error');
        this.provinceFilterEl = document.getElementById('province-filter');
        this.refreshBtnEl = document.getElementById('refresh-btn');
        this.lastUpdateEl = document.getElementById('last-update');
        this.totalCountEl = document.getElementById('total-count');
        this.applyFiltersBtn = document.getElementById('apply-filters');
        this.fuelCheckboxes = document.querySelectorAll('.fuel-filter');
        this.darkModeToggle = document.getElementById('dark-mode-toggle');
    }

    attachEventListeners() {
        this.provinceFilterEl.addEventListener('change', () => this.filterByProvince());
        this.refreshBtnEl.addEventListener('click', () => this.loadData());
        this.applyFiltersBtn.addEventListener('click', () => {
            this.applyFuelFilters();
            this.requestCookieConsentIfNeeded();
        });
        
        this.darkModeToggle.addEventListener('click', () => {
            this.toggleDarkMode();
            this.requestCookieConsentIfNeeded();
        });

        this.applyFiltersBtn.addEventListener('click', () => {
            const modal = bootstrap.Modal.getInstance(document.getElementById('settingsModal'));
            modal.hide();
        });
        
        $(document).on('click', '.schedule-status', (e) => {
            const scheduleElement = e.target;
            const horario = scheduleElement.getAttribute('data-horario');
            this.showScheduleDetails(horario, scheduleElement);
        });
    }

    initializeCookieConsent() {
        this.cookieConsentInstance = window.cookieconsent.initialise({
            palette: {
                popup: {
                    background: "#1d8a8a"
                },
                button: {
                    background: "#62ffaa"
                }
            },
            theme: "classic",
            position: "bottom-right",
            content: {
                message: "Este sitio utiliza cookies para recordar tus preferencias de filtros y modo oscuro.",
                dismiss: "Entendido",
                deny: "Rechazar",
                allow: "Permitir cookies",
                link: "Más información"
            },
            type: "opt-in",
            onStatusChange: (status) => {
                this.cookieConsent = status === 'allow';
                if (this.cookieConsent) {
                    this.saveSettings();
                } else {
                    this.clearSettings();
                }
            }
        });
    }

    requestCookieConsentIfNeeded() {
        const consentStatus = localStorage.getItem('cookieconsent_status');
        if (!consentStatus) {
            this.initializeCookieConsent();
        } else if (consentStatus === 'allow') {
            this.cookieConsent = true;
            this.saveSettings();
        }
    }

    toggleDarkMode() {
        this.darkMode = !this.darkMode;
        document.documentElement.setAttribute('data-theme', this.darkMode ? 'dark' : 'light');
        this.darkModeToggle.textContent = this.darkMode ? '☀️' : '🌙';
    }

    loadSettings() {
        if (localStorage.getItem('cookieconsent_status') === 'allow') {
            this.cookieConsent = true;
            
            // Load dark mode setting
            const savedDarkMode = localStorage.getItem('gasoprice_darkmode');
            if (savedDarkMode === 'true') {
                this.darkMode = true;
                document.documentElement.setAttribute('data-theme', 'dark');
                this.darkModeToggle.textContent = '☀️';
            }

            const savedFuels = localStorage.getItem('gasoprice_fuels');
            if (savedFuels) {
                this.activeFuels = JSON.parse(savedFuels);
                this.fuelCheckboxes.forEach(checkbox => {
                    checkbox.checked = this.activeFuels.includes(checkbox.value);
                });
            }
        }
    }

    saveSettings() {
        if (this.cookieConsent) {
            localStorage.setItem('gasoprice_darkmode', this.darkMode.toString());
            localStorage.setItem('gasoprice_fuels', JSON.stringify(this.activeFuels));
        }
    }

    clearSettings() {
        localStorage.removeItem('gasoprice_darkmode');
        localStorage.removeItem('gasoprice_fuels');
    }

    initializeDataTable() {
        const totalColumns = 4 + this.activeFuels.length + 1; // 4 basic + fuel columns + horario
        
        const fuelColumnDefs = [];
        for (let i = 4; i < 4 + this.activeFuels.length; i++) {
            fuelColumnDefs.push({
                targets: i,
                type: 'price-with-na'
            });
        }

        this.dataTable = $('#gas-stations-table').DataTable({
            language: {
                url: 'https://cdn.datatables.net/plug-ins/1.13.7/i18n/es-ES.json'
            },
            pageLength: 25,
            responsive: true,
            order: [[0, 'asc']],
            columnDefs: fuelColumnDefs,
            columns: Array(totalColumns).fill(null) // Ensure column count matches
        });
    }

    async loadData() {
        this.showLoading();
        
        try {
            const response = await fetch(this.apiUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            this.processData(data);
        } catch (error) {
            console.error('Error fetching data:', error);
            this.showError();
        }
    }

    processData(data) {
        this.data = data.ListaEESSPrecio || [];
        
        this.updateLastUpdate(data.Fecha);
        this.populateProvinceFilter();
        this.updateColumnVisibility(); // This will rebuild table with correct columns
        this.updateStats();
        this.hideLoading();
    }

    applyFuelFilters() {
        this.activeFuels = [];
        
        this.fuelCheckboxes.forEach(checkbox => {
            if (checkbox.checked) {
                this.activeFuels.push(checkbox.value);
            }
        });
        
        this.updateColumnVisibility();
        this.populateDataTable();
    }

    updateColumnVisibility() {
        if (this.dataTable) {
            this.dataTable.destroy();
        }
        this.updateTableHeader();
        document.querySelector('#table-body').innerHTML = '';
        this.initializeDataTable();
        if (this.data.length > 0) {
            this.populateDataTable();
        }
    }

    updateTableHeader() {
        const thead = document.querySelector('#gas-stations-table thead tr');
        thead.innerHTML = `
            <th>Localidad</th>
            <th>Provincia</th>
            <th>Dirección</th>
            <th>Rótulo</th>
            ${this.activeFuels.map(fuel => {
                const labels = {
                    'gasolina95': 'Gasolina 95 E5',
                    'gasoleo': 'Gasóleo A',
                    'gasolina98': 'Gasolina 98 E5',
                    'gasoleoB': 'Gasóleo B',
                    'gasolina95Premium': 'Gasolina 95 E5 Premium',
                    'gasoleoPremium': 'Gasóleo Premium',
                    'gasolina95E10': 'Gasolina 95 E10',
                    'gasolina98E10': 'Gasolina 98 E10',
                    'glp': 'GLP',
                    'gnc': 'GNC',
                    'gnl': 'GNL',
                    'adblue': 'AdBlue',
                    'biodiesel': 'Biodiesel',
                    'bioetanol': 'Bioetanol',
                    'hidrogeno': 'Hidrógeno',
                    'gasolinaRenovable': 'Gasolina Renovable'
                };
                return `<th>${labels[fuel]}</th>`;
            }).join('')}
            <th>Horario</th>
        `;
    }

    parseSchedule(horario) {
        if (!horario || horario === 'N/A') {
            return { status: 'unknown', text: 'Horario no disponible' };
        }

        // Check for 24H format
        if (horario.includes('24H') || horario.includes('24:00-24:00')) {
            return { status: '24h', text: '24/7' };
        }

        const now = new Date();
        const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const currentTime = now.getHours() * 60 + now.getMinutes(); // Minutes since midnight

        // Parse schedule parts separated by semicolon
        const scheduleparts = horario.split(';').map(part => part.trim());
        
        let foundScheduleForToday = false;
        
        for (const part of scheduleparts) {
            const dayTimeMatch = part.match(/([LMXJVSD-]+):\s*(\d{2}:\d{2})-(\d{2}:\d{2})/);
            if (!dayTimeMatch) continue;

            const [, dayRange, openTime, closeTime] = dayTimeMatch;
            const daysApplied = this.parseDayRange(dayRange);
            
            if (daysApplied.includes(currentDay)) {
                foundScheduleForToday = true;
                const openMinutes = this.timeToMinutes(openTime);
                let closeMinutes = this.timeToMinutes(closeTime);
                
                if (closeTime === '00:00') {
                    closeMinutes = 24 * 60; // End of day
                }
                
                let isOpen;
                if (closeMinutes > openMinutes) {
                    isOpen = currentTime >= openMinutes && currentTime < closeMinutes;
                } else {
                    isOpen = currentTime >= openMinutes || currentTime < closeMinutes;
                }
                
                return {
                    status: isOpen ? 'open' : 'closed',
                    text: isOpen ? `Abierto (${openTime}-${closeTime})` : `Cerrado (${openTime}-${closeTime})`
                };
            }
        }

        if (scheduleparts.length > 0 && !foundScheduleForToday) {
            return { status: 'closed', text: 'Cerrado hoy' };
        }

        return { status: 'unknown', text: 'Horario no claro' };
    }

    parseDayRange(dayRange) {
        const dayMap = {
            'L': 1, 'M': 2, 'X': 3, 'J': 4, 'V': 5, 'S': 6, 'D': 0
        };

        if (dayRange.includes('-')) {
            const [start, end] = dayRange.split('-');
            const startDay = dayMap[start];
            const endDay = dayMap[end];
            
            const days = [];
            if (startDay <= endDay) {
                for (let i = startDay; i <= endDay; i++) {
                    days.push(i);
                }
            } else {
                for (let i = startDay; i <= 6; i++) days.push(i);
                for (let i = 0; i <= endDay; i++) days.push(i);
            }
            return days;
        } else {
            const singleDays = dayRange.split(',').map(day => day.trim());
            return singleDays.map(day => dayMap[day]).filter(day => day !== undefined);
        }
    }

    timeToMinutes(timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    }

    formatScheduleStatus(horario) {
        const schedule = this.parseSchedule(horario);
        
        switch (schedule.status) {
            case '24h':
                return `<span class="schedule-status schedule-24h" data-horario="${horario}" title="Ver horarios">24/7</span>`;
            case 'open':
                return `<span class="schedule-status schedule-open" data-horario="${horario}" title="Ver horarios">Abierto</span>`;
            case 'closed':
                return `<span class="schedule-status schedule-closed" data-horario="${horario}" title="Ver horarios">Cerrado</span>`;
            default:
                return `<span class="schedule-status schedule-unknown" data-horario="${horario}" title="Ver horarios">N/A</span>`;
        }
    }

    showScheduleDetails(horario, element) {
        // Log the original horario for debugging
        console.log('Original horario from JSON:', horario);
        
        if (!horario || horario === 'N/A') {
            this.showTooltip('Horario no disponible', element);
            return;
        }

        const formattedSchedule = this.formatScheduleForDisplay(horario);
        this.showTooltip(formattedSchedule, element);
    }

    formatScheduleForDisplay(horario) {
        if (horario.includes('24H')) {
            return 'Abierto las 24 horas, todos los días';
        }

        const dayNames = {
            'L': 'Lunes', 'M': 'Martes', 'X': 'Miércoles', 
            'J': 'Jueves', 'V': 'Viernes', 'S': 'Sábado', 'D': 'Domingo'
        };

        const scheduleparts = horario.split(';').map(part => part.trim());
        let formatted = '';

        scheduleparts.forEach(part => {
            const dayTimeMatch = part.match(/([LMXJVSD-]+):\s*(\d{2}:\d{2})-(\d{2}:\d{2})/);
            if (dayTimeMatch) {
                const [, dayRange, openTime, closeTime] = dayTimeMatch;
                const formattedDays = this.formatDayRange(dayRange, dayNames);
                formatted += `${formattedDays}: ${openTime} - ${closeTime}<br>`;
            }
        });

        return formatted || 'Horario no disponible';
    }

    formatDayRange(dayRange, dayNames) {
        if (dayRange.includes('-')) {
            const [start, end] = dayRange.split('-');
            return `${dayNames[start]} a ${dayNames[end]}`;
        } else {
            return dayRange.split(',').map(day => dayNames[day.trim()]).join(', ');
        }
    }

    showTooltip(content, element) {
        this.hideTooltip();

        const tooltip = document.createElement('div');
        tooltip.className = 'schedule-tooltip';
        tooltip.innerHTML = content;
        document.body.appendChild(tooltip);

        const rect = element.getBoundingClientRect();
        tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
        tooltip.style.top = rect.top - tooltip.offsetHeight - 10 + 'px';

        setTimeout(() => this.hideTooltip(), 3000);

        document.addEventListener('click', this.hideTooltipHandler);
    }

    hideTooltip() {
        const tooltip = document.querySelector('.schedule-tooltip');
        if (tooltip) {
            tooltip.remove();
        }
        document.removeEventListener('click', this.hideTooltipHandler);
    }

    hideTooltipHandler = (e) => {
        if (!e.target.closest('.schedule-tooltip') && !e.target.closest('.schedule-status')) {
            this.hideTooltip();
        }
    }

    populateDataTable() {
        this.dataTable.clear();
        
        const rows = this.data.map(station => {
            const row = [
                station.Localidad || 'N/A',
                station.Provincia || 'N/A',
                station.Dirección || 'N/A',
                station.Rótulo || 'N/A'
            ];
            
            this.activeFuels.forEach(fuel => {
                const priceField = this.fuelMapping[fuel];
                row.push(this.formatPrice(station[priceField]));
            });
            
            row.push(this.formatScheduleStatus(station.Horario));
            return row;
        });
        
        this.dataTable.rows.add(rows).draw();
    }

    showLoading() {
        this.loadingEl.style.display = 'block';
        this.errorEl.style.display = 'none';
        document.querySelector('.table-container').style.display = 'none';
    }

    hideLoading() {
        this.loadingEl.style.display = 'none';
        document.querySelector('.table-container').style.display = 'block';
    }

    showError() {
        this.loadingEl.style.display = 'none';
        this.errorEl.style.display = 'block';
        this.errorEl.innerHTML = `
            <p><strong>Error:</strong> No se pueden cargar los datos en este momento.</p>
            <p>Por favor, inténtalo de nuevo más tarde.</p>
        `;
    }

    populateProvinceFilter() {
        const provinces = [...new Set(this.data.map(station => station.Provincia))].sort();
        
        this.provinceFilterEl.innerHTML = '<option value="">Todas las provincias</option>';
        provinces.forEach(province => {
            if (province) {
                const option = document.createElement('option');
                option.value = province;
                option.textContent = province;
                this.provinceFilterEl.appendChild(option);
            }
        });
    }

    filterByProvince() {
        const selectedProvince = this.provinceFilterEl.value;
        
        if (selectedProvince) {
            this.dataTable.column(1).search('^' + selectedProvince + '$', true, false).draw();
        } else {
            this.dataTable.column(1).search('').draw();
        }
        
        this.updateStats();
    }

    formatPrice(price) {
        if (!price || price === '1,000' || price === '0,000') {
            return '<span class="price unavailable">N/A</span>';
        }
        return `<span class="price">${price}€</span>`;
    }

    updateLastUpdate(fecha) {
        this.lastUpdateEl.textContent = `Última actualización: ${fecha || 'Desconocida'}`;
    }

    updateStats() {
        const filteredCount = this.dataTable ? this.dataTable.rows({search: 'applied'}).count() : 0;
        this.totalCountEl.textContent = filteredCount;
    }
}

let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new GasStationApp();
});
