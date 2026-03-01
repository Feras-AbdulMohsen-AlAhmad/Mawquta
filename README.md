# Mawquta - Prayer Times Application

A comprehensive Islamic prayer times web application built with a layered architecture. Get accurate prayer times, qibla direction, Islamic calendar, and 99 Divine Names (Asma Al-Husna) for any location worldwide.

## Features

- 🕌 **Prayer Times**: Real-time prayer times (Fajr, Dhuhr, Asr, Maghrib, Isha) for any location
- ⏱️ **Countdown Timer**: Live countdown to the next prayer with display updates
- 🧭 **Qibla Direction**: Interactive compass showing the direction to Kaaba (Mecca)
- 📅 **Islamic Calendar**: Monthly prayer times calendar with Hijri dates
- ✨ **Asma Al-Husna**: All 99 Divine Names with Arabic and English meanings
- 📅 **Date Converter**: Convert between Gregorian and Hijri (Islamic) calendars
- 🌍 **Location Detection**: Auto-detect location via GPS or manual city/address search
- 🌓 **Dark/Light Theme**: Toggle between dark and light modes
- 💾 **Local Storage**: Save user preferences and location

## Architecture

The application follows a **Layered Architecture** pattern:

```
├── API Layer (api/)
│   ├── aladhan.api.js - Al-Adhan API integration
│   └── location.api.js - Geolocation and geocoding
│
├── Service Layer (services/)
│   ├── prayer.service.js - Prayer time calculations
│   ├── qibla.service.js - Qibla direction calculations
│   └── ramadan.service.js - Calendar and Islamic data
│
├── UI Layer (ui/)
│   ├── render-prayers.js - Prayer cards renderer
│   ├── render-countdown.js - Countdown timer renderer
│   └── render-week.js - Calendar and Asma Al-Husna renderer
│
├── Utility Layer (utils/)
│   ├── date.util.js - Date manipulation
│   ├── time.util.js - Time formatting and calculations
│   └── dom.util.js - DOM manipulation helpers
│
├── State Layer (state/)
│   └── app.state.js - Application state management
│
├── Configuration
│   ├── config.js - Application configuration
│   ├── app.js - Main application logic
│
├── Styling
│   ├── main.css - Main styles
│   └── themes.css - Dark/light theme styles
│
└── Public
    └── index.html - Main HTML file
```

## Technology Stack

- **HTML5** - Markup
- **CSS3** - Styling with Bootstrap 5 and custom themes
- **Vanilla JavaScript** - No dependencies, pure ES6+
- **Bootstrap 5** - Responsive grid and components
- **Al-Adhan API** - Prayer times and Islamic data (https://aladhan.com/api)
- **Browser Geolocation API** - Location detection

## Getting Started

### Prerequisites

- Modern web browser (Chrome, Firefox, Safari, Edge)
- Internet connection (for API calls)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/Feras-AbdulMohsen-AlAhmad/Mawquta.git
cd Mawquta
```

2. Open in browser:

```bash
# Option 1: Open directly
open index.html

# Option 2: Use a local server
python3 -m http.server 8000
# Then visit http://localhost:8000
```

### Usage

1. **Get Prayer Times**:
   - Allow browser location access for auto-detection
   - Or search by city/address (e.g., "Cairo, Egypt" or "London")

2. **View Countdown**:
   - The countdown timer shows time until next prayer
   - Updates every second in real-time

3. **Check Qibla Direction**:
   - Interactive compass shows angle and direction to Mecca
   - Useful for prayer orientation

4. **Browse Calendar**:
   - Select month and year to view prayer times for entire month
   - Shows Hijri dates alongside Gregorian dates

5. **Learn Asma Al-Husna**:
   - Browse 99 Divine Names with Arabic text and English meanings
   - Each name has transliteration and explanation

6. **Convert Dates**:
   - Gregorian to Hijri date converter
   - Hijri to Gregorian converter
   - Useful for Islamic calendar calculations

7. **Toggle Theme**:
   - Click theme button in header
   - Choose between dark mode (default) and light mode
   - Preference is saved automatically

## API Integration

### Al-Adhan API

- **Base URL**: `https://api.aladhan.com/v1`
- **Key Endpoints**:
  - `/timings?latitude=&longitude=&method=` - Prayer times
  - `/calendar?latitude=&longitude=&month=&year=` - Monthly calendar
  - `/qibla?latitude=&longitude=` - Qibla direction
  - `/asma` - 99 Divine Names
  - `/dateToHijri?date=` - Gregorian to Hijri
  - `/hijriToDate?hijri=` - Hijri to Gregorian
  - `/geo?city=&country=` - Geocoding

### Prayer Calculation Methods

- 0: Shia
- 1: Hanafi
- 2: ISNA (default)
- 3: MWL
- 4: Karachi
- 5: Diyanet
- 7: Moonsighting Committee
- 8: Tunisia
- 9: Turkey
- 10: Tetuan
- 11: Saudi Arabia
- 12: Portuguese
- 13: Iran
- 14: Kuwait
- 15: Qatar
- 16: Majlis
- 17: Jafari

## File Structure

```
prayer-times/
├── index.html                 # Main HTML file
├── .gitignore              # Git ignore rules
├── README.md               # This file
└── assets/
    ├── css/
    │   ├── bootstrap.min.css       # Bootstrap framework
    │   ├── main.css                # Main styles
    │   └── themes.css              # Theme styles (dark/light)
    │
    ├── js/
    │   ├── app.js                  # Main application
    │   ├── config.js               # Configuration
    │   │
    │   ├── api/
    │   │   ├── aladhan.api.js      # Al-Adhan API client
    │   │   └── location.api.js     # Location API client
    │   │
    │   ├── services/
    │   │   ├── prayer.service.js   # Prayer service
    │   │   ├── qibla.service.js    # Qibla service
    │   │   └── ramadan.service.js  # Islamic calendar service
    │   │
    │   ├── ui/
    │   │   ├── render-prayers.js   # Prayer cards renderer
    │   │   ├── render-countdown.js # Countdown renderer
    │   │   └── render-week.js      # Calendar renderer
    │   │
    │   ├── utils/
    │   │   ├── date.util.js        # Date utilities
    │   │   ├── time.util.js        # Time utilities
    │   │   └── dom.util.js         # DOM utilities
    │   │
    │   └── state/
    │       └── app.state.js        # State management
    │
    ├── icons/
    │   └── svg/                    # SVG icons
    │
    ├── illustrations/              # SVG illustrations
    │
    └── animations/
        └── lottie/                 # Lottie animations
```

## State Management

The application uses a centralized state store with an observer pattern:

```javascript
// Subscribe to state changes
AppState.subscribe("prayerTimes", (newData) => {
  console.log("Prayer times updated:", newData);
});

// Get state value
const location = AppState.get("location");

// Set state value (automatically notifies observers)
AppState.set("prayerTimes", newData);

// Load/save to localStorage
AppState.loadFromStorage();
AppState.saveToStorage();
```

## Customization

### Change Prayer Method

Edit `config.js`:

```javascript
DEFAULT_METHOD: 2; // Change to your preferred method
```

### Change Default Location

Edit `config.js`:

```javascript
DEFAULT_LOCATION: {
    latitude: 30.0444,
    longitude: 31.2357,
    name: 'Cairo, Egypt'
}
```

### Customize Colors

Edit `assets/css/main.css` and `assets/css/themes.css`:

```css
:root {
  --primary-color: #1a1a1a;
  --secondary-color: #ffd700;
  --accent-color: #27ae60;
}
```

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Performance

- Minimal dependencies (vanilla JavaScript)
- Efficient DOM updates using query selectors
- LocalStorage caching for user preferences
- Optimized asset loading with deferred script loading
- ~50KB total JS + CSS

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Commit changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see LICENSE file for details.

## Acknowledgments

- Prayer times and Islamic data from [Al-Adhan API](https://aladhan.com/api)
- Qibla calculations based on geographic bearing formulas
- Bootstrap framework for responsive design
- Islamic calendar conversions based on standard algorithms

## Roadmap

- [ ] Add offline support with Service Workers
- [ ] Add audio notifications for prayer times
- [ ] Add prayer reminder notifications
- [ ] Add Islamic events calendar
- [ ] Add statistics and analytics
- [ ] Multi-language support (Arabic, Urdu, etc.)
- [ ] Mobile app versions (React Native/Flutter)
- [ ] Backend for user profiles and sync
- [ ] Advanced prayer time customization
- [ ] Integration with other Islamic apps

## Support

For issues, bug reports, or feature requests, please create an issue on GitHub or contact the maintainers.

## Author

**Feras Abdul Mohsen AlAhmad**

- GitHub: [@Feras-AbdulMohsen-AlAhmad](https://github.com/Feras-AbdulMohsen-AlAhmad)

---

**Made with ❤️ for the Muslim community**

السلام عليكم ورحمة الله وبركاته
