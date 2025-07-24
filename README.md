# ✈️ Live Flight Tracker

A modern, real-time flight tracking web application that provides live flight status updates and browser notifications using the AeroDataBox API.

## 🚀 Features

- **Real-time Flight Tracking**: Track any flight by entering its flight number
- **Live Location Updates**: Get real-time position, altitude, and location information
- **Browser Notifications**: Receive live updates every minute via browser notifications
- **Flight Progress Visualization**: See flight progress with visual indicators
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Flight Status Monitoring**: Track scheduling, boarding, departure, in-flight, and landing status
- **Auto-stop Notifications**: Notifications automatically stop when the flight lands

## 🛠️ Technologies Used

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **API**: AeroDataBox via RapidAPI
- **Styling**: Modern CSS with gradients and animations
- **Icons**: Font Awesome
- **Notifications**: Web Notifications API

## 📋 How to Use

1. **Open the Application**: Open `index.html` in your web browser
2. **Enter Flight Number**: Type any flight number (e.g., AA123, BA456, UA789)
3. **Enable Notifications**: Click "Enable Live Notifications" to receive updates
4. **Track Flight**: The app will automatically update every minute with live data

## 🔔 Notification Features

- **Permission Request**: The app will ask for notification permissions
- **Live Updates**: Receive location updates every minute while the flight is in progress
- **Landing Alert**: Get notified when the flight lands at its destination
- **Auto-stop**: Notifications stop automatically when the flight completes its journey

## 🎨 User Interface

- **Clean Design**: Modern, gradient-based design with intuitive navigation
- **Flight Route Display**: Visual representation of departure and arrival airports
- **Progress Bar**: Shows flight progress from departure to arrival
- **Status Badges**: Color-coded status indicators (Scheduled, Boarding, In Flight, Landed, etc.)
- **Responsive Layout**: Adapts to different screen sizes

## 📱 Mobile Support

The application is fully responsive and works on:
- Desktop computers
- Tablets
- Mobile phones
- Different screen orientations

## 🔧 Technical Details

### API Integration
- Uses AeroDataBox API through RapidAPI
- Fetches flight data by flight number and date
- Updates flight position every 60 seconds
- Handles API errors gracefully

### Browser Notifications
- Requests notification permissions on load
- Sends location updates with coordinates and altitude
- Sends landing notifications when flight completes
- Uses notification tags to prevent spam

### Real-time Updates
- Updates flight information every minute
- Tracks flight progress based on scheduled vs actual times
- Automatically stops tracking when flight lands
- Shows last updated timestamp

## 🚨 Browser Compatibility

- Chrome 50+
- Firefox 46+
- Safari 10+
- Edge 14+

**Note**: Requires notification support for live updates feature.

## 📊 Flight Information Displayed

- **Flight Details**: Airline, flight number, aircraft type
- **Departure**: Airport, scheduled/actual times
- **Arrival**: Airport, scheduled/estimated/actual times
- **Current Status**: Real-time flight status
- **Location**: Current coordinates and altitude
- **Progress**: Visual progress indicator

## 🔐 Privacy & Security

- No personal data is stored
- API key is securely configured
- Notifications are handled locally by the browser
- No tracking or analytics

## 🎯 Example Flight Numbers to Test

Try these flight numbers (if available on the current date):
- `AA123` - American Airlines
- `BA456` - British Airways  
- `UA789` - United Airlines
- `DL567` - Delta Airlines
- `LH890` - Lufthansa

## 📞 Support

If you encounter any issues:
1. Check browser console for error messages
2. Ensure you have an active internet connection
3. Verify the flight number exists for today's date
4. Try refreshing the page

## 🔄 Auto-refresh Feature

The application automatically:
- Refreshes flight data every 60 seconds
- Updates the "Last updated" timestamp
- Stops tracking when flight lands
- Maintains notification state across updates

---

**Note**: This application uses live flight data and requires an active internet connection. Flight availability depends on the AeroDataBox API data coverage. 