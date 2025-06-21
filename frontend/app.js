const API_URL_EVENTS = window.location.origin + '/events';
const API_URL_ANALYTICS = window.location.origin + '/analytics';

// Elementy DOM
const eventForm = document.getElementById('event-form');
const eventsTableBody = document.getElementById('events-table-body');
const eventsOverTimeChart = document.getElementById('events-over-time-chart');
const topLocationsChart = document.getElementById('top-locations-chart');
const categoriesChart = document.getElementById('categories-chart');

// Inicjalizacja wykresów
let charts = {
    eventsOverTimeChart: null,
    topLocationsChart: null,
    categoriesChart: null
};

const initCharts = (eventsData) => {
    // Przygotowanie danych dla wykresów
    const eventsByDate = groupEventsByDate(eventsData);
    const eventsByLocation = groupEventsByLocation(eventsData);
    const eventsByCategory = groupEventsByCategory(eventsData);

    // Wykres 1
    if (eventsOverTimeChart) {
        charts.eventsOverTimeChart = new Chart(eventsOverTimeChart, {
            type: 'line',
            data: {
                labels: Object.keys(eventsByDate),
                datasets: [{
                    label: 'Liczba wydarzeń',
                    data: Object.values(eventsByDate),
                    borderColor: '#3e95cd',
                    fill: false,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                scales: { y: { beginAtZero: true } }
            }
        });
    }

    // Wykres 2
    if (topLocationsChart) {
        charts.topLocationsChart = new Chart(topLocationsChart, {
            type: 'bar',
            data: {
                labels: Object.keys(eventsByLocation),
                datasets: [{
                    label: 'Liczba wydarzeń',
                    data: Object.values(eventsByLocation),
                    backgroundColor: '#8e5ea2'
                }]
            },
            options: {
                responsive: true,
                scales: { y: { beginAtZero: true } }
            }
        });
    }

    // Wykres 3
    if (categoriesChart) {
        charts.categoriesChart = new Chart(categoriesChart, {
            type: 'doughnut',
            data: {
                labels: Object.keys(eventsByCategory),
                datasets: [{
                    data: Object.values(eventsByCategory),
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
        });
    }
};

// Funkcje pomocnicze do grupowania danych
const groupEventsByDate = (events) => {
    const grouped = {};
    events.forEach(event => {
        try {
            const dateValue = event.date?.value;
            if (!dateValue) return;
            
            const dateObj = new Date(dateValue);
            if (isNaN(dateObj.getTime())) {
                console.warn('Nieprawidłowa data:', dateValue);
                return;
            }
            
            // Format daty: DD.MM.YYYY
            const date = dateObj.toLocaleDateString('pl-PL', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
            grouped[date] = (grouped[date] || 0) + 1;
        } catch (e) {
            console.error('Błąd przetwarzania daty:', e);
        }
    });
    return grouped;
};

const groupEventsByLocation = (events) => {
    const grouped = {};
    events.forEach(event => {
        grouped[event.location] = (grouped[event.location] || 0) + 1;
    });
    return grouped;
};

const groupEventsByCategory = (events) => {
    const grouped = {};
    events.forEach(event => {
        grouped[event.category] = (grouped[event.category] || 0) + 1;
    });
    return grouped;
};

const fetchData = async () => {
    try {
        const [eventsResponse, analyticsResponse] = await Promise.all([
            fetch(API_URL_EVENTS),
            fetch(API_URL_ANALYTICS)
        ]);
        
        if (!eventsResponse.ok || !analyticsResponse.ok) {
            throw new Error('Błąd pobierania danych');
        }
        
        const events = await eventsResponse.json();
        const analytics = await analyticsResponse.json();
        
        updateEventsTable(events);
        if (events.length > 0) {
            initCharts(events);
        }
    } catch (error) {
        console.error('Błąd pobierania danych:', error);
        // alert('Problem z połączeniem z serwerem');
    }
};

// Aktualizacja tabeli wydarzeń
const updateEventsTable = (events) => {
    if (!eventsTableBody) return;
    
    eventsTableBody.innerHTML = '';
    
    if (!events || events.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="5" style="text-align: center;">Brak wydarzeń do wyświetlenia</td>';
        eventsTableBody.appendChild(row);
        return;
    }
    
    events.forEach(event => {
        const row = document.createElement('tr');
        const dateValue = event.date?.value;
        let displayDate = 'Brak daty';
        
        if (dateValue) {
            const dateObj = new Date(dateValue);
            if (!isNaN(dateObj.getTime())) {
                displayDate = dateObj.toLocaleDateString('pl-PL', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                });
            }
        }
        
        row.innerHTML = `
            <td>${event.name}</td>
            <td>${event.location}</td>
            <td>${displayDate}</td>
            <td>${event.category}</td>
            <td><button class="delete-btn" data-id="${event.id}">Usuń</button></td>
        `;
        eventsTableBody.appendChild(row);
    });

    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const eventId = e.target.getAttribute('data-id');
            deleteEvent(eventId);
        });
    });
};

// Funkcja do usuwania wydarzenia
const deleteEvent = async (eventId) => {
    if (!confirm('Czy na pewno chcesz usunąć to wydarzenie?')) return;
    
    try {
        const response = await fetch(`${API_URL_EVENTS}/${eventId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            alert('Wydarzenie zostało usunięte!');
            fetchData();
        } else {
            throw new Error('Błąd podczas usuwania wydarzenia');
        }
    } catch (error) {
        console.error('Błąd:', error);
        alert(error.message);
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
            alert('Proszę wypełnić wszystkie wymagane pola');
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
                fetchData();
            } else {
                throw new Error('Błąd podczas dodawania wydarzenia');
            }
        } catch (error) {
            console.error('Błąd:', error);
            alert(error.message);
        }
    });
}

// Inicjalizacja
document.addEventListener('DOMContentLoaded', () => {
    const dateInput = document.getElementById('event-date');
    if (dateInput) {
        const now = new Date();
        dateInput.value = now.toISOString().slice(0, 16);
    }
    
    fetchData();
});