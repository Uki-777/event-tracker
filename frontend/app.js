const API_URL_EVENTS = window.location.origin + '/events';
const API_URL_ANALYTICS = window.location.origin + '/analytics';

// Elementy DOM
const eventForm = document.getElementById('event-form');
const eventsTable = document.getElementById('events-table')?.getElementsByTagName('tbody')[0];
const eventsChart = document.getElementById('events-chart');
const locationsChart = document.getElementById('locations-chart');
const categoriesChart = document.getElementById('categories-chart');

// Inicjalizacja wykresów
const initCharts = () => {
    return {
        eventsChart: eventsChart && new Chart(eventsChart, {
            type: 'line',
            data: { 
                labels: [], 
                datasets: [{ 
                    label: 'Liczba wydarzeń', 
                    data: [], 
                    borderColor: '#3e95cd', 
                    fill: false,
                    tension: 0.1
                }] 
            },
            options: {
                responsive: true,
                scales: { y: { beginAtZero: true } }
            }
        }),
        locationsChart: locationsChart && new Chart(locationsChart, {
            type: 'bar',
            data: { 
                labels: [], 
                datasets: [{ 
                    label: 'Lokalizacje', 
                    data: [], 
                    backgroundColor: '#8e5ea2' 
                }] 
            },
            options: {
                responsive: true,
                scales: { y: { beginAtZero: true } }
            }
        }),
        categoriesChart: categoriesChart && new Chart(categoriesChart, {
            type: 'doughnut',
            data: { 
                labels: [], 
                datasets: [{ 
                    data: [], 
                    backgroundColor: [
                        '#3cba9f', '#e8c3b9', '#c45850', 
                        '#3e95cd', '#8e5ea2', '#1e7145'
                    ] 
                }] 
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'right' }
                }
            }
        })
    };
};

let charts = initCharts();

// Pobierz i zaktualizuj dane
const fetchData = async () => {
    try {
        const [eventsResponse, analyticsResponse] = await Promise.all([
            fetch(API_URL_EVENTS),
            fetch(API_URL_ANALYTICS)
        ]);
        
        if (!eventsResponse.ok) {
            const errorText = await eventsResponse.text();
            throw new Error(`Błąd pobierania wydarzeń: ${eventsResponse.status} - ${errorText}`);
        }
        
        if (!analyticsResponse.ok) {
            const errorText = await analyticsResponse.text();
            throw new Error(`Błąd pobierania analityki: ${analyticsResponse.status} - ${errorText}`);
        }
        
        const events = await eventsResponse.json();
        const analytics = await analyticsResponse.json();
        
        // DEBUG: Wyświetl dane analityczne w konsoli
        console.log('Analytics data:', analytics);
        
        if (eventsTable) {
            updateEventsTable(events);
        }
        
        updateCharts(analytics);
    } catch (error) {
        console.error('Błąd pobierania danych:', error);
        alert('Problem z połączeniem z serwerem: ' + error.message);
    }
};

// Aktualizuj tabelę wydarzeń
const updateEventsTable = (events) => {
    if (!eventsTable) return;
    
    eventsTable.innerHTML = '';
    
    if (!events || events.length === 0) {
        const row = eventsTable.insertRow();
        const cell = row.insertCell(0);
        cell.colSpan = 5;
        cell.textContent = 'Brak wydarzeń do wyświetlenia';
        cell.style.textAlign = 'center';
        return;
    }
    
    events.forEach(event => {
        const row = eventsTable.insertRow();
        row.insertCell(0).textContent = event.name;
        row.insertCell(1).textContent = event.location;
        row.insertCell(2).textContent = new Date(event.date).toLocaleDateString('pl-PL', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
        row.insertCell(3).textContent = event.category;
        row.insertCell(4).textContent = event.description || 'Brak opisu';
    });
};

// Aktualizuj wykresy - ZMIENIONA FUNKCJA
const updateCharts = (analytics) => {
    if (!analytics) return;
    
    // 1. Wykres liniowy: wydarzenia w czasie
    if (charts.eventsChart && analytics.eventsOverTime) {
        charts.eventsChart.data.labels = analytics.eventsOverTime.dates || [];
        charts.eventsChart.data.datasets[0].data = analytics.eventsOverTime.counts || [];
        charts.eventsChart.update();
    }
    
    // 2. Wykres słupkowy: top lokalizacje
    if (charts.locationsChart && analytics.topLocations) {
        charts.locationsChart.data.labels = analytics.topLocations.locations || [];
        charts.locationsChart.data.datasets[0].data = analytics.topLocations.counts || [];
        charts.locationsChart.update();
    }
    
    // 3. Wykres kołowy: kategorie
    if (charts.categoriesChart && analytics.categories) {
        charts.categoriesChart.data.labels = analytics.categories.map(c => c.category) || [];
        charts.categoriesChart.data.datasets[0].data = analytics.categories.map(c => c.count) || [];
        charts.categoriesChart.update();
    }
};

// Obsługa formularza
if (eventForm) {
    eventForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const eventData = {
            name: document.getElementById('event-name').value.trim(),
            location: document.getElementById('event-location').value.trim(),
            date: document.getElementById('event-date').value,
            category: document.getElementById('event-category').value.trim(),
            description: document.getElementById('event-description').value.trim()
        };
        
        if (!eventData.name || !eventData.location || !eventData.date || !eventData.category) {
            alert('Proszę wypełnić wszystkie wymagane pola (nazwa, lokalizacja, data, kategoria)');
            return;
        }
        
        try {
            const response = await fetch(API_URL_EVENTS, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(eventData)
            });
            
            if (response.ok) {
                alert('Wydarzenie dodane pomyślnie!');
                eventForm.reset();
                setTimeout(fetchData, 1000);
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || `Błąd serwera: ${response.status}`);
            }
        } catch (error) {
            console.error('Błąd:', error);
            alert('Błąd podczas dodawania wydarzenia: ' + error.message);
        }
    });
}

// Inicjalizacja
document.addEventListener('DOMContentLoaded', () => {
    const dateInput = document.getElementById('event-date');
    if (dateInput) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        
        dateInput.value = `${year}-${month}-${day}T${hours}:${minutes}`;
    }
    
    fetchData();
});