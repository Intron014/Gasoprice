class GasStationApp {
    constructor() {
        this.data = [];
        this.dataTable = null;
        this.apiUrl = 'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/';
        this.activeFuels = ['gasolina95', 'gasoleo']; // Default visible fuels
        this.fuelMapping = {
            'gasolina95': 'Precio Gasolina 95 E5',
            'gasoleo': 'Precio Gasoleo A',
            'gasolina98': 'Precio Gasolina 98 E5',
            'gasoleoB': 'Precio Gasoleo B',
            'glp': 'Precio Gases licuados del petróleo',
            'gnc': 'Precio Gas Natural Comprimido',
            'adblue': 'Precio Adblue'
        };
        
        this.initializeElements();
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
    }

    attachEventListeners() {
        this.provinceFilterEl.addEventListener('change', () => this.filterByProvince());
        this.refreshBtnEl.addEventListener('click', () => this.loadData());
        this.applyFiltersBtn.addEventListener('click', () => this.applyFuelFilters());
        
        // Close modal after applying filters
        this.applyFiltersBtn.addEventListener('click', () => {
            const modal = bootstrap.Modal.getInstance(document.getElementById('settingsModal'));
            modal.hide();
        });
    }

    initializeDataTable() {
        // Calculate number of columns dynamically
        const totalColumns = 4 + this.activeFuels.length + 1; // 4 basic + fuel columns + horario
        
        // Create column definitions for fuel columns only
        const fuelColumnDefs = [];
        for (let i = 4; i < 4 + this.activeFuels.length; i++) {
            fuelColumnDefs.push({
                targets: i,
                type: 'num',
                render: function(data, type, row) {
                    if (type === 'display') {
                        return data;
                    }
                    if (type === 'sort') {
                        if (data && data.includes && data.includes('N/A')) {
                            return 999;
                        }
                        const numericValue = parseFloat(String(data).replace('€', '').replace(',', '.'));
                        return isNaN(numericValue) ? 999 : numericValue;
                    }
                    return data;
                }
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
                    'glp': 'GLP',
                    'gnc': 'GNC',
                    'adblue': 'AdBlue'
                };
                return `<th>${labels[fuel]}</th>`;
            }).join('')}
            <th>Horario</th>
        `;
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
            
            row.push(station.Horario || 'N/A');
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
