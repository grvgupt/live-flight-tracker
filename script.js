class FlightTracker {
    constructor() {
        this.apiKey = 'b49c21636amshda0b2161424ab58p158bb2jsnf71d2e2b9151';
        this.apiHost = 'aerodatabox.p.rapidapi.com';
        this.currentFlightNumber = null;
        this.trackingInterval = null;
        this.notificationsEnabled = false;
        this.lastKnownLocation = null;
        this.flightMap = null;
        this.departureMarker = null;
        this.arrivalMarker = null;
        this.currentPositionMarker = null;
        this.flightPath = null;
        this.plannedRoute = null;
        this.traveledPath = null;
        this.currentFlightData = null;
        
        this.initializeEventListeners();
        this.checkNotificationPermission();
        this.setDefaultDate();
    }

    initializeEventListeners() {
        const flightForm = document.getElementById('flightForm');
        const enableNotificationsBtn = document.getElementById('enableNotifications');

        flightForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const flightNumber = document.getElementById('flightNumber').value.trim().toUpperCase();
            const flightDate = document.getElementById('flightDate').value;
            if (flightNumber && flightDate) {
                this.searchFlight(flightNumber, flightDate);
            }
        });

        enableNotificationsBtn.addEventListener('click', () => {
            this.requestNotificationPermission();
        });

        // Handle window resize for map
        window.addEventListener('resize', () => {
            if (this.flightMap) {
                setTimeout(() => {
                    this.flightMap.invalidateSize();
                }, 100);
            }
        });

        // Add legend click handlers
        this.initializeLegendHandlers();
    }

    initializeLegendHandlers() {
        // Add click handlers for legend items
        document.addEventListener('click', (e) => {
            if (e.target.closest('#legendDeparture')) {
                this.focusOnDeparture();
            } else if (e.target.closest('#legendDestination')) {
                this.focusOnDestination();
            } else if (e.target.closest('#legendCurrentPosition')) {
                this.focusOnCurrentPosition();
            }
        });
    }

    async searchFlight(flightNumber, flightDate) {
        this.currentFlightNumber = flightNumber;
        this.showLoading();
        this.hideError();
        this.hideFlightInfo();

        try {
            // Get flight information for the selected date
            const flightData = await this.fetchFlightByNumber(flightNumber, flightDate);
            
            if (flightData && flightData.length > 0) {
                const flight = flightData[0]; // Get the first flight of the day
                await this.displayFlightInfo(flight);
                this.startLiveTracking(flight);
            } else {
                this.showError('Flight not found. Please check the flight number and date, then try again.');
            }
        } catch (error) {
            console.error('Error searching flight:', error);
            this.showError('Unable to fetch flight information. Please try again later.');
        } finally {
            this.hideLoading();
        }
    }

    async fetchFlightByNumber(flightNumber, date) {
        const options = {
            method: 'GET',
            headers: {
                'X-RapidAPI-Key': this.apiKey,
                'X-RapidAPI-Host': this.apiHost
            }
        };

        const response = await fetch(
            `https://${this.apiHost}/flights/number/${flightNumber}/${date}?withAircraftImage=false&withLocation=true`,
            options
        );

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    }

    async fetchFlightPosition(flightId) {
        const options = {
            method: 'GET',
            headers: {
                'X-RapidAPI-Key': this.apiKey,
                'X-RapidAPI-Host': this.apiHost
            }
        };

        try {
            const response = await fetch(
                `https://${this.apiHost}/flights/id/${flightId}?withAircraftImage=false&withLocation=true`,
                options
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching flight position:', error);
            return null;
        }
    }

    async displayFlightInfo(flight) {
        // Store current flight data for legend interactions
        this.currentFlightData = flight;
        
        const flightInfo = document.getElementById('flightInfo');
        
        // Update flight header
        document.getElementById('flightTitle').textContent = 
            `${flight.airline?.name || 'Unknown Airline'} ${flight.number}`;
        
        const statusBadge = document.getElementById('flightStatus');
        const status = this.getFlightStatus(flight);
        statusBadge.textContent = status.text;
        statusBadge.className = `status-badge ${status.class}`;

        // Update departure info
        document.getElementById('depAirport').textContent = flight.departure?.airport?.iata || 'N/A';
        document.getElementById('depAirportName').textContent = 
            flight.departure?.airport?.name || 'Unknown Airport';
        document.getElementById('depScheduled').textContent = 
            this.formatDateTime(flight.departure?.scheduledTimeLocal);
        document.getElementById('depActual').textContent = 
            flight.departure?.actualTimeLocal ? 
            `Actual: ${this.formatDateTime(flight.departure.actualTimeLocal)}` : 'On time';

        // Update arrival info
        document.getElementById('arrAirport').textContent = flight.arrival?.airport?.iata || 'N/A';
        document.getElementById('arrAirportName').textContent = 
            flight.arrival?.airport?.name || 'Unknown Airport';
        document.getElementById('arrScheduled').textContent = 
            this.formatDateTime(flight.arrival?.scheduledTimeLocal);
        document.getElementById('arrActual').textContent = 
            flight.arrival?.actualTimeLocal ? 
            `Actual: ${this.formatDateTime(flight.arrival.actualTimeLocal)}` : 
            (flight.arrival?.estimatedTimeLocal ? 
            `Estimated: ${this.formatDateTime(flight.arrival.estimatedTimeLocal)}` : 'On time');

        // Update additional info
        document.getElementById('airline').textContent = flight.airline?.name || 'Unknown';
        document.getElementById('aircraft').textContent = 
            flight.aircraft?.model || flight.aircraft?.registration || 'Unknown';

        // Update progress
        this.updateFlightProgress(flight);

        // Update location info
        await this.updateLocationInfo(flight);

        // Initialize or update map
        this.initializeFlightMap(flight);

        // Update last updated time
        document.getElementById('lastUpdated').textContent = 
            `Last updated: ${new Date().toLocaleTimeString()}`;

        this.showFlightInfo();
    }

    async updateLocationInfo(flight) {
        const currentLocationElement = document.getElementById('currentLocation');
        const altitudeElement = document.getElementById('altitude');

        if (flight.location) {
            const lat = flight.location.lat;
            const lon = flight.location.lon;
            const altitude = flight.location.altitude;

            if (lat && lon) {
                try {
                    // Try to get location name from reverse geocoding (simplified)
                    currentLocationElement.textContent = `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`;
                    
                    // Store current location for notifications
                    this.lastKnownLocation = {
                        lat: lat,
                        lon: lon,
                        altitude: altitude,
                        timestamp: new Date()
                    };

                    // Send notification if enabled
                    if (this.notificationsEnabled) {
                        this.sendLocationNotification(flight, lat, lon, altitude);
                    }
                } catch (error) {
                    currentLocationElement.textContent = `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`;
                }

                if (altitude) {
                    altitudeElement.textContent = `${Math.round(altitude)} ft`;
                } else {
                    altitudeElement.textContent = 'N/A';
                }
            } else {
                currentLocationElement.textContent = 'Location unavailable';
                altitudeElement.textContent = 'N/A';
            }
        } else {
            currentLocationElement.textContent = 'Tracking...';
            altitudeElement.textContent = 'N/A';
        }
    }

    initializeFlightMap(flight) {
        // Initialize map if not already done
        if (!this.flightMap) {
            this.flightMap = L.map('flightMap').setView([40.0, 0.0], 2);
            
            // Add OpenStreetMap tiles
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 18
            }).addTo(this.flightMap);
        }

        // Clear existing markers and paths
        this.clearMapLayers();

        // Get departure and arrival airports
        const depAirport = flight.departure?.airport;
        const arrAirport = flight.arrival?.airport;

        if (!depAirport?.iata || !arrAirport?.iata) {
            console.warn('Missing airport information');
            return;
        }

        // Get coordinates for both airports
        const depCoords = this.getKnownAirportCoordinates(depAirport.iata);
        const arrCoords = this.getKnownAirportCoordinates(arrAirport.iata);

        if (!depCoords || !arrCoords) {
            console.warn('Could not find coordinates for airports:', depAirport.iata, arrAirport.iata);
            return;
        }

        // Add departure marker
        this.departureMarker = L.marker([depCoords.lat, depCoords.lon], {
            icon: this.createCustomIcon('🛫', '#28a745')
        }).addTo(this.flightMap);
        
        this.departureMarker.bindPopup(`
            <b>Departure</b><br>
            ${depAirport.name || depAirport.iata}<br>
            ${this.formatDateTime(flight.departure.scheduledTimeLocal)}
        `);

        // Add arrival marker
        this.arrivalMarker = L.marker([arrCoords.lat, arrCoords.lon], {
            icon: this.createCustomIcon('🛬', '#dc3545')
        }).addTo(this.flightMap);
        
        this.arrivalMarker.bindPopup(`
            <b>Destination</b><br>
            ${arrAirport.name || arrAirport.iata}<br>
            ${this.formatDateTime(flight.arrival.scheduledTimeLocal)}
        `);

        // Draw flight path between departure and destination
        const flightPath = [
            [depCoords.lat, depCoords.lon],
            [arrCoords.lat, arrCoords.lon]
        ];
        
        this.plannedRoute = L.polyline(flightPath, {
            color: '#667eea',
            weight: 3,
            opacity: 0.7
        }).addTo(this.flightMap);

        // Add current position if available
        if (flight.location?.lat && flight.location?.lon) {
            this.currentPositionMarker = L.marker([flight.location.lat, flight.location.lon], {
                icon: this.createCustomIcon('✈️', '#ffc107')
            }).addTo(this.flightMap);
            
            const altitude = flight.location.altitude ? `<br>Altitude: ${Math.round(flight.location.altitude)} ft` : '';
            this.currentPositionMarker.bindPopup(`
                <b>Current Position</b><br>
                ${flight.location.lat.toFixed(4)}°, ${flight.location.lon.toFixed(4)}°${altitude}
            `);
        }

        // Set map bounds to show both airports
        const bounds = L.latLngBounds([
            [depCoords.lat, depCoords.lon],
            [arrCoords.lat, arrCoords.lon]
        ]);
        
        this.flightMap.fitBounds(bounds, { 
            padding: [50, 50]
        });

        // Update route information
        this.updateSimpleRouteInfo(flight, depCoords, arrCoords);
    }

    clearMapLayers() {
        if (this.departureMarker) this.flightMap.removeLayer(this.departureMarker);
        if (this.arrivalMarker) this.flightMap.removeLayer(this.arrivalMarker);
        if (this.currentPositionMarker) this.flightMap.removeLayer(this.currentPositionMarker);
        if (this.plannedRoute) this.flightMap.removeLayer(this.plannedRoute);
        if (this.traveledPath) this.flightMap.removeLayer(this.traveledPath);
        if (this.flightPath) this.flightMap.removeLayer(this.flightPath);
    }

    createCustomIcon(emoji, color) {
        return L.divIcon({
            html: `<div style="
                background: ${color};
                width: 30px;
                height: 30px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 16px;
                border: 2px solid white;
                box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            ">${emoji}</div>`,
            className: 'custom-marker',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });
    }

    updateSimpleRouteInfo(flight, depCoords, arrCoords) {
        // Calculate route distance
        const distance = this.calculateDistance(
            depCoords.lat, depCoords.lon,
            arrCoords.lat, arrCoords.lon
        );

        document.getElementById('routeDistance').innerHTML = 
            `<i class="fas fa-route"></i> <span>${Math.round(distance)} miles</span>`;

        // Calculate estimated flight duration
        const depTime = new Date(flight.departure?.scheduledTimeLocal);
        const arrTime = new Date(flight.arrival?.scheduledTimeLocal);
        
        if (depTime && arrTime) {
            const durationMs = arrTime - depTime;
            const hours = Math.floor(durationMs / (1000 * 60 * 60));
            const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
            
            document.getElementById('flightDuration').innerHTML = 
                `<i class="fas fa-clock"></i> <span>${hours}h ${minutes}m</span>`;
        } else {
            document.getElementById('flightDuration').innerHTML = 
                `<i class="fas fa-clock"></i> <span>Duration unknown</span>`;
        }
    }

    getKnownAirportCoordinates(iataCode) {
        if (!iataCode) return null;
        
        // Common airport coordinates - expandable database
        const airports = {
            // US Major Airports
            'JFK': { lat: 40.6413, lon: -73.7781 },
            'LAX': { lat: 33.9425, lon: -118.4081 },
            'ORD': { lat: 41.9742, lon: -87.9073 },
            'ATL': { lat: 33.6407, lon: -84.4277 },
            'DFW': { lat: 32.8998, lon: -97.0403 },
            'DEN': { lat: 39.8561, lon: -104.6737 },
            'SFO': { lat: 37.6213, lon: -122.3790 },
            'SEA': { lat: 47.4502, lon: -122.3088 },
            'LAS': { lat: 36.0840, lon: -115.1537 },
            'MCO': { lat: 28.4312, lon: -81.3081 },
            'EWR': { lat: 40.6895, lon: -74.1745 },
            'MSP': { lat: 44.8848, lon: -93.2223 },
            'DTW': { lat: 42.2162, lon: -83.3554 },
            'PHL': { lat: 39.8744, lon: -75.2424 },
            'LGA': { lat: 40.7769, lon: -73.8740 },
            'BWI': { lat: 39.1774, lon: -76.6684 },
            'BOS': { lat: 42.3656, lon: -71.0096 },
            'CLT': { lat: 35.2144, lon: -80.9473 },
            'IAH': { lat: 29.9902, lon: -95.3368 },
            'SLC': { lat: 40.7899, lon: -111.9791 },
            
            // European Major Airports
            'LHR': { lat: 51.4700, lon: -0.4543 },
            'CDG': { lat: 49.0097, lon: 2.5479 },
            'FRA': { lat: 50.0379, lon: 8.5622 },
            'AMS': { lat: 52.3105, lon: 4.7683 },
            'MAD': { lat: 40.4839, lon: -3.5680 },
            'FCO': { lat: 41.7999, lon: 12.2462 },
            'LGW': { lat: 51.1537, lon: -0.1821 },
            'MUC': { lat: 48.3537, lon: 11.7750 },
            'ZUR': { lat: 47.4647, lon: 8.5492 },
            'VIE': { lat: 48.1103, lon: 16.5697 },
            
            // Asian Major Airports  
            'NRT': { lat: 35.7720, lon: 140.3929 },
            'HND': { lat: 35.5494, lon: 139.7798 },
            'ICN': { lat: 37.4602, lon: 126.4407 },
            'SIN': { lat: 1.3644, lon: 103.9915 },
            'HKG': { lat: 22.3080, lon: 113.9185 },
            'PVG': { lat: 31.1443, lon: 121.8083 },
            'PEK': { lat: 40.0799, lon: 116.6031 },
            'BKK': { lat: 13.6900, lon: 100.7501 },
            'KUL': { lat: 2.7456, lon: 101.7072 },
            'DEL': { lat: 28.5562, lon: 77.1000 },
            
            // Other Major Airports
            'YYZ': { lat: 43.6777, lon: -79.6248 }, // Toronto
            'SYD': { lat: -33.9399, lon: 151.1753 }, // Sydney
            'MEL': { lat: -37.6690, lon: 144.8410 }, // Melbourne
            'DXB': { lat: 25.2532, lon: 55.3657 },  // Dubai
            'DOH': { lat: 25.2609, lon: 51.6138 },  // Doha
        };
        
        return airports[iataCode.toUpperCase()] || null;
    }



    calculateDistance(lat1, lon1, lat2, lon2) {
        // Haversine formula to calculate great-circle distance
        const R = 3959; // Earth's radius in miles
        const dLat = this.toRadians(lat2 - lat1);
        const dLon = this.toRadians(lon2 - lon1);
        
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }

    focusOnDeparture() {
        if (!this.flightMap || !this.currentFlightData || !this.departureMarker) {
            return;
        }

        const depCoords = this.getKnownAirportCoordinates(this.currentFlightData.departure?.airport?.iata);
        if (!depCoords) {
            return;
        }

        this.flightMap.setView([depCoords.lat, depCoords.lon], 8, {
            animate: true,
            duration: 1.0
        });

        this.departureMarker.openPopup();
    }

    focusOnDestination() {
        if (!this.flightMap || !this.currentFlightData || !this.arrivalMarker) {
            return;
        }

        const arrCoords = this.getKnownAirportCoordinates(this.currentFlightData.arrival?.airport?.iata);
        if (!arrCoords) {
            return;
        }

        this.flightMap.setView([arrCoords.lat, arrCoords.lon], 8, {
            animate: true,
            duration: 1.0
        });

        this.arrivalMarker.openPopup();
    }

    focusOnCurrentPosition() {
        if (!this.flightMap || !this.currentFlightData?.location?.lat || !this.currentFlightData?.location?.lon) {
            return;
        }

        const lat = this.currentFlightData.location.lat;
        const lon = this.currentFlightData.location.lon;
        
        this.flightMap.setView([lat, lon], 8, {
            animate: true,
            duration: 1.0
        });

        // Show current position info popup
        if (this.currentPositionMarker) {
            this.currentPositionMarker.openPopup();
        }
    }

    updateFlightProgress(flight) {
        const progressElement = document.getElementById('flightProgress');
        let progress = 0;

        if (flight.status === 'landed' || flight.arrival?.actualTimeLocal) {
            progress = 100;
        } else if (flight.status === 'departed' || flight.departure?.actualTimeLocal) {
            // Calculate progress based on time if possible
            const depTime = new Date(flight.departure?.scheduledTimeLocal || flight.departure?.actualTimeLocal);
            const arrTime = new Date(flight.arrival?.scheduledTimeLocal || flight.arrival?.estimatedTimeLocal);
            const now = new Date();

            if (depTime && arrTime && now > depTime) {
                const totalTime = arrTime - depTime;
                const elapsedTime = now - depTime;
                progress = Math.min(100, Math.max(0, (elapsedTime / totalTime) * 100));
            } else {
                progress = 25;
            }
        } else if (flight.status === 'boarding') {
            progress = 10;
        }

        progressElement.style.width = `${progress}%`;
    }

    getFlightStatus(flight) {
        const status = flight.status;
        const departure = flight.departure;
        const arrival = flight.arrival;

        if (arrival?.actualTimeLocal) {
            return { text: 'Landed', class: 'status-landed' };
        } else if (departure?.actualTimeLocal) {
            return { text: 'In Flight', class: 'status-departed' };
        } else if (status === 'boarding') {
            return { text: 'Boarding', class: 'status-boarding' };
        } else if (status === 'delayed') {
            return { text: 'Delayed', class: 'status-delayed' };
        } else if (status === 'cancelled') {
            return { text: 'Cancelled', class: 'status-cancelled' };
        } else {
            return { text: 'Scheduled', class: 'status-scheduled' };
        }
    }

    formatDateTime(dateTimeString) {
        if (!dateTimeString) return 'N/A';
        
        try {
            const date = new Date(dateTimeString);
            return date.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            return dateTimeString;
        }
    }

    startLiveTracking(flight) {
        // Clear any existing interval
        if (this.trackingInterval) {
            clearInterval(this.trackingInterval);
        }

        // Only start tracking if flight is not landed
        const status = this.getFlightStatus(flight);
        if (status.text === 'Landed') {
            return;
        }

        // Update flight info every minute
        this.trackingInterval = setInterval(async () => {
            try {
                if (flight.id) {
                    const updatedFlight = await this.fetchFlightPosition(flight.id);
                    if (updatedFlight) {
                        await this.displayFlightInfo(updatedFlight);
                        
                        // Stop tracking if flight has landed
                        const currentStatus = this.getFlightStatus(updatedFlight);
                        if (currentStatus.text === 'Landed') {
                            this.stopLiveTracking();
                            if (this.notificationsEnabled) {
                                this.sendLandingNotification(updatedFlight);
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('Error updating flight info:', error);
            }
        }, 60000); // Update every minute
    }

    stopLiveTracking() {
        if (this.trackingInterval) {
            clearInterval(this.trackingInterval);
            this.trackingInterval = null;
        }
    }

    setDefaultDate() {
        // Set default date to today
        const today = new Date();
        const todayString = today.toISOString().split('T')[0];
        document.getElementById('flightDate').value = todayString;
        
        // Set min date to 7 days ago and max date to 30 days from today
        const minDate = new Date(today);
        minDate.setDate(today.getDate() - 7);
        const maxDate = new Date(today);
        maxDate.setDate(today.getDate() + 30);
        
        const dateInput = document.getElementById('flightDate');
        dateInput.min = minDate.toISOString().split('T')[0];
        dateInput.max = maxDate.toISOString().split('T')[0];
    }

    // Notification functions
    checkNotificationPermission() {
        if ('Notification' in window) {
            const permission = Notification.permission;
            this.updateNotificationUI(permission);
        } else {
            document.getElementById('enableNotifications').style.display = 'none';
            document.getElementById('notificationStatus').textContent = 
                'Browser notifications not supported';
        }
    }

    async requestNotificationPermission() {
        if ('Notification' in window) {
            const permission = await Notification.requestPermission();
            this.updateNotificationUI(permission);
        }
    }

    updateNotificationUI(permission) {
        const btn = document.getElementById('enableNotifications');
        const status = document.getElementById('notificationStatus');

        switch (permission) {
            case 'granted':
                this.notificationsEnabled = true;
                btn.textContent = '🔔 Notifications Enabled';
                btn.disabled = true;
                status.textContent = 'You will receive live flight updates every minute';
                break;
            case 'denied':
                this.notificationsEnabled = false;
                btn.textContent = '🔕 Notifications Blocked';
                btn.disabled = true;
                status.textContent = 'Notifications have been blocked. Enable them in browser settings.';
                break;
            default:
                this.notificationsEnabled = false;
                btn.textContent = '🔔 Enable Live Notifications';
                btn.disabled = false;
                status.textContent = 'Click to enable live flight location updates';
        }
    }

    sendLocationNotification(flight, lat, lon, altitude) {
        if (!this.notificationsEnabled || Notification.permission !== 'granted') {
            return;
        }

        const title = `${flight.airline?.name || 'Flight'} ${flight.number} - Live Update`;
        const altText = altitude ? ` at ${Math.round(altitude)} ft` : '';
        const body = `Current location: ${lat.toFixed(4)}°, ${lon.toFixed(4)}°${altText}`;

        new Notification(title, {
            body: body,
            icon: '✈️',
            tag: 'flight-location-update'
        });
    }

    sendLandingNotification(flight) {
        if (!this.notificationsEnabled || Notification.permission !== 'granted') {
            return;
        }

        const title = `${flight.airline?.name || 'Flight'} ${flight.number} - Landed!`;
        const body = `Flight has landed at ${flight.arrival?.airport?.name || 'destination airport'}`;

        new Notification(title, {
            body: body,
            icon: '🛬',
            tag: 'flight-landed'
        });
    }

    // UI helper functions
    showLoading() {
        document.getElementById('loadingSection').classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loadingSection').classList.add('hidden');
    }

    showError(message) {
        document.getElementById('errorMessage').textContent = message;
        document.getElementById('errorSection').classList.remove('hidden');
    }

    hideError() {
        document.getElementById('errorSection').classList.add('hidden');
    }

    showFlightInfo() {
        document.getElementById('flightInfo').classList.remove('hidden');
    }

    hideFlightInfo() {
        document.getElementById('flightInfo').classList.add('hidden');
        
        // Clean up map and flight data
        if (this.flightMap) {
            this.flightMap.remove();
            this.flightMap = null;
            this.departureMarker = null;
            this.arrivalMarker = null;
            this.currentPositionMarker = null;
            this.flightPath = null;
            this.plannedRoute = null;
            this.traveledPath = null;
        }
        
        this.currentFlightData = null;
    }
}

// Initialize the flight tracker when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new FlightTracker();
}); 