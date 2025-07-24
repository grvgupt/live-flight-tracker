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
        if (this.departureMarker) this.flightMap.removeLayer(this.departureMarker);
        if (this.arrivalMarker) this.flightMap.removeLayer(this.arrivalMarker);
        if (this.currentPositionMarker) this.flightMap.removeLayer(this.currentPositionMarker);
        if (this.flightPath) this.flightMap.removeLayer(this.flightPath);
        if (this.plannedRoute) this.flightMap.removeLayer(this.plannedRoute);
        if (this.traveledPath) this.flightMap.removeLayer(this.traveledPath);

        const bounds = [];

        // Add departure marker
        if (flight.departure?.airport?.lat && flight.departure?.airport?.lon) {
            const depLat = flight.departure.airport.lat;
            const depLon = flight.departure.airport.lon;
            
            this.departureMarker = L.marker([depLat, depLon], {
                icon: this.createCustomIcon('🛫', '#28a745')
            }).addTo(this.flightMap);
            
            this.departureMarker.bindPopup(`
                <b>Departure</b><br>
                ${flight.departure.airport.name || flight.departure.airport.iata}<br>
                ${this.formatDateTime(flight.departure.scheduledTimeLocal)}
            `);
            
            bounds.push([depLat, depLon]);
        }

        // Add arrival marker
        if (flight.arrival?.airport?.lat && flight.arrival?.airport?.lon) {
            const arrLat = flight.arrival.airport.lat;
            const arrLon = flight.arrival.airport.lon;
            
            this.arrivalMarker = L.marker([arrLat, arrLon], {
                icon: this.createCustomIcon('🛬', '#dc3545')
            }).addTo(this.flightMap);
            
            this.arrivalMarker.bindPopup(`
                <b>Destination</b><br>
                ${flight.arrival.airport.name || flight.arrival.airport.iata}<br>
                ${this.formatDateTime(flight.arrival.scheduledTimeLocal)}
            `);
            
            bounds.push([arrLat, arrLon]);
        }

        // Add current position marker if available
        if (flight.location?.lat && flight.location?.lon) {
            const currentLat = flight.location.lat;
            const currentLon = flight.location.lon;
            const altitude = flight.location.altitude;
            
            this.currentPositionMarker = L.marker([currentLat, currentLon], {
                icon: this.createCustomIcon('✈️', '#667eea')
            }).addTo(this.flightMap);
            
            const altitudeText = altitude ? `<br>Altitude: ${Math.round(altitude)} ft` : '';
            this.currentPositionMarker.bindPopup(`
                <b>Current Position</b><br>
                ${currentLat.toFixed(4)}°, ${currentLon.toFixed(4)}°${altitudeText}<br>
                <small>Last updated: ${new Date().toLocaleTimeString()}</small>
            `);
            
            bounds.push([currentLat, currentLon]);

            // Draw traveled path if we have departure and current position
            if (flight.departure?.airport?.lat && flight.departure?.airport?.lon) {
                const traveledCoords = [
                    [flight.departure.airport.lat, flight.departure.airport.lon],
                    [currentLat, currentLon]
                ];
                
                this.traveledPath = L.polyline(traveledCoords, {
                    color: '#667eea',
                    weight: 4,
                    opacity: 0.8
                }).addTo(this.flightMap);
            }
        }

        // Draw planned route if we have both departure and arrival airports
        if (flight.departure?.airport?.lat && flight.departure?.airport?.lon &&
            flight.arrival?.airport?.lat && flight.arrival?.airport?.lon) {
            
            const routeCoords = [
                [flight.departure.airport.lat, flight.departure.airport.lon],
                [flight.arrival.airport.lat, flight.arrival.airport.lon]
            ];
            
            this.plannedRoute = L.polyline(routeCoords, {
                color: '#6c757d',
                weight: 2,
                opacity: 0.6,
                dashArray: '10, 10'
            }).addTo(this.flightMap);

            // Calculate and display route information
            this.updateRouteInfo(flight);
        }

        // Fit map to show all markers
        if (bounds.length > 0) {
            this.flightMap.fitBounds(bounds, { 
                padding: [20, 20],
                maxZoom: 8
            });
        }
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

    updateRouteInfo(flight) {
        if (flight.departure?.airport?.lat && flight.departure?.airport?.lon &&
            flight.arrival?.airport?.lat && flight.arrival?.airport?.lon) {
            
            // Calculate route distance
            const distance = this.calculateDistance(
                flight.departure.airport.lat, flight.departure.airport.lon,
                flight.arrival.airport.lat, flight.arrival.airport.lon
            );

            document.getElementById('routeDistance').innerHTML = 
                `<i class="fas fa-route"></i> <span>${Math.round(distance)} miles</span>`;

            // Calculate estimated flight duration
            const depTime = new Date(flight.departure?.scheduledTimeLocal || flight.departure?.actualTimeLocal);
            const arrTime = new Date(flight.arrival?.scheduledTimeLocal || flight.arrival?.estimatedTimeLocal);
            
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
        
        // Clean up map
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
    }
}

// Initialize the flight tracker when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new FlightTracker();
}); 