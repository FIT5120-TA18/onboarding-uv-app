import { useState } from "react";

function LocationDetector() {

  const [location, setLocation] = useState(null);
  const [city, setCity] = useState("");

  const getLocation = () => {

    navigator.geolocation.getCurrentPosition(async (position) => {

      const lat = position.coords.latitude;
      const lon = position.coords.longitude;

      setLocation({ lat, lon });

      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
      );

      const data = await response.json();

      const cityName =
        data.address.city ||
        data.address.town ||
        data.address.village ||
        "Unknown";

      const country = data.address.country;

      setCity(`${cityName}, ${country}`);

    });

  };

  return (

    <div style={{padding: "20px"}}>

      <h2>UV Alert</h2>

      <button onClick={getLocation}>
        Get My Location
      </button>

      {city && (
        <p><b>Location:</b> {city}</p>
      )}

      {location && (
        <div>
          <p>Latitude: {location.lat}</p>
          <p>Longitude: {location.lon}</p>
        </div>
      )}

    </div>

  );

}

export default LocationDetector;