import { useState, useRef } from "react";

const UV_BANDS = [
    { min: 1,  max: 2,        label: "Low",       bg: "#0d1f0d", accent: "#4ade80", text: "#86efac" },
    { min: 3,  max: 5,        label: "Moderate",  bg: "#2a1f00", accent: "#fbbf24", text: "#fde68a" },
    { min: 6,  max: 7,        label: "High",      bg: "#2a1000", accent: "#fb923c", text: "#fed7aa" },
    { min: 8,  max: 10,       label: "Very High", bg: "#2a0808", accent: "#f87171", text: "#fecaca" },
    { min: 11, max: Infinity, label: "Extreme",   bg: "#1a0828", accent: "#c084fc", text: "#e9d5ff" },
  ];

function getRisk(uv) {
  return UV_BANDS.find((b) => uv <= b.max) ?? UV_BANDS[4];
}

function getWarning(label, uv) {
  if (uv < 6) return null;
  const mins = { High: 12, "Very High": 7, Extreme: 3 }[label];
  return mins
    ? `Your skin may start burning in ${mins} minutes. Seek shade or apply SPF 50+ sunscreen.`
    : null;
}

function UVArc({ uv, accent, text }) {
  const max = 14;
  const pct = Math.min(uv / max, 1);
  const angle = pct * 180;
  const rad = (angle - 180) * (Math.PI / 180);
  const cx = 100, cy = 100, r = 80;
  const x = cx + r * Math.cos(rad);
  const y = cy + r * Math.sin(rad);

  return (
    <svg viewBox="0 0 200 110" style={{ width: "100%", maxWidth: 280 }}>
      <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#ffffff15" strokeWidth="12" strokeLinecap="round"/>
      <path
        d={`M 20 100 A 80 80 0 ${angle > 90 ? 1 : 0} 1 ${x} ${y}`}
        fill="none" stroke={accent} strokeWidth="12" strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 8px ${accent})` }}
      />
      <circle cx={x} cy={y} r="7" fill={accent} style={{ filter: `drop-shadow(0 0 6px ${accent})` }}/>
      <text x="100" y="88" textAnchor="middle" fill={accent} fontSize="36" fontWeight="700"
        fontFamily="'DM Mono', monospace" style={{ filter: `drop-shadow(0 0 10px ${accent})` }}>
        {uv.toFixed(1)}
      </text>
      <text x="100" y="106" textAnchor="middle" fill={text} fontSize="11"
        fontFamily="'DM Sans', sans-serif" letterSpacing="3">
        UV INDEX
      </text>
    </svg>
  );
}

function EpicPlaceholder({ title, description, icon }) {
  return (
    <div style={{
      minHeight: "60vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 16,
      color: "#ffffff40", textAlign: "center", padding: "40px 24px",
    }}>
      <div style={{ fontSize: 64 }}>{icon}</div>
      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", color: "#ffffff60" }}>
        {title}
      </div>
      <div style={{ fontSize: 14, fontFamily: "'DM Sans', sans-serif", maxWidth: 280, lineHeight: 1.6 }}>
        {description}
      </div>
      <div style={{
        marginTop: 8, padding: "6px 16px", borderRadius: 999,
        border: "1px solid #ffffff20", fontSize: 11, letterSpacing: 2,
        fontFamily: "'DM Mono', monospace", color: "#ffffff30",
      }}>
        COMING SOON
      </div>
    </div>
  );
}

export default function LocationDetector() {
  const [city, setCity] = useState("");
  const [uvData, setUvData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef(null);
  const debounceRef = useRef(null);

  const [activePage, setActivePage] = useState(0);

  // ── shared: given lat/lon fetch city name + UV ──────────────────────────
  const fetchUVForCoords = async (lat, lon) => {
    setError("");
    setLoading(true);
    try {
      // Reverse geocode
      const locRes = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
      );
      const locData = await locRes.json();
      const cityName =
        locData.address.city || locData.address.town ||
        locData.address.village || locData.address.state || "Unknown";
      setCity(`${cityName}, ${locData.address.country || ""}`);

      // UV index
      const uvRes = await fetch(
        `http://127.0.0.1:5001/api/uv?lat=${lat}&lon=${lon}`
      );
      const raw = await uvRes.json();
      const uv = raw.uv_index;
      const risk = getRisk(uv);
      const warning = getWarning(risk.label, uv);
      setUvData({ uv, risk, warning });
    } catch (err) {
      setError("Failed to retrieve UV data.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ── option 1: GPS ───────────────────────────────────────────────────────
  const getGPSLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => fetchUVForCoords(pos.coords.latitude, pos.coords.longitude),
      () => {
        setError("Unable to retrieve your location.");
        setLoading(false);
      }
    );
  };

  // ── option 2: city search (Nominatim autocomplete) ──────────────────────
  const handleSearchInput = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    clearTimeout(debounceRef.current);
    if (val.length < 2) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val)}&format=json&limit=5&addressdetails=1`
        );
        const data = await res.json();
        setSuggestions(data);
      } catch {
        setSuggestions([]);
      } finally {
        setSearchLoading(false);
      }
    }, 350);
  };

  const handleSelectSuggestion = (place) => {
    setSearchQuery("");
    setSuggestions([]);
    setShowSearch(false);
    fetchUVForCoords(parseFloat(place.lat), parseFloat(place.lon));
  };

  const risk = uvData?.risk;
  const bgColor = risk ? risk.bg : "#0d0d0f";
  const accentColor = risk ? risk.accent : "#ffffff25";

  // ── pages ───────────────────────────────────────────────────────────────
  const pages = [
    {
      label: "UV Alert", icon: "☀",
      content: (
        <div style={{ padding: "0 24px 40px" }}>

          {/* ── Location search panel ── */}
          <div style={{ marginTop: 20, marginBottom: 8 }}>
            {!showSearch ? (
              /* Collapsed: show current city + change button */
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 16px", borderRadius: 14,
                background: "#ffffff08", border: "1px solid #ffffff12",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14 }}>📍</span>
                  <span style={{
                    fontSize: 13, color: city ? "#ffffffaa" : "#ffffff35",
                    fontFamily: "'DM Sans', sans-serif",
                  }}>
                    {city || "No location set"}
                  </span>
                </div>
                <button
                  onClick={() => { setShowSearch(true); setTimeout(() => searchRef.current?.focus(), 50); }}
                  style={{
                    padding: "5px 12px", borderRadius: 999, border: "1px solid #ffffff20",
                    background: "transparent", color: "#ffffff60", fontSize: 11,
                    fontFamily: "'DM Mono', monospace", letterSpacing: 1, cursor: "pointer",
                  }}
                >
                  CHANGE
                </button>
              </div>
            ) : (
              /* Expanded: search input + suggestions */
              <div style={{ position: "relative" }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "12px 16px", borderRadius: 14,
                  background: "#ffffff10", border: `1px solid ${accentColor}50`,
                }}>
                  <span style={{ fontSize: 14, flexShrink: 0 }}>🔍</span>
                  <input
                    ref={searchRef}
                    value={searchQuery}
                    onChange={handleSearchInput}
                    placeholder="Search city or suburb…"
                    style={{
                      flex: 1, background: "transparent", border: "none", outline: "none",
                      color: "#ffffffdd", fontSize: 14, fontFamily: "'DM Sans', sans-serif",
                    }}
                  />
                  {searchLoading && (
                    <span style={{ fontSize: 11, color: "#ffffff40", fontFamily: "'DM Mono', monospace" }}>
                      …
                    </span>
                  )}
                  <button
                    onClick={() => { setShowSearch(false); setSuggestions([]); setSearchQuery(""); }}
                    style={{
                      background: "transparent", border: "none", color: "#ffffff40",
                      cursor: "pointer", fontSize: 16, padding: 0, lineHeight: 1,
                    }}
                  >
                    ✕
                  </button>
                </div>

                {/* Suggestions dropdown */}
                {suggestions.length > 0 && (
                  <div style={{
                    position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
                    borderRadius: 14, background: "#1a1a1f",
                    border: "1px solid #ffffff15", overflow: "hidden", zIndex: 10,
                  }}>
                    {suggestions.map((place, i) => (
                      <button
                        key={place.place_id}
                        onClick={() => handleSelectSuggestion(place)}
                        style={{
                          width: "100%", padding: "12px 16px", background: "transparent",
                          border: "none", borderBottom: i < suggestions.length - 1 ? "1px solid #ffffff08" : "none",
                          color: "#ffffffcc", fontSize: 13, fontFamily: "'DM Sans', sans-serif",
                          textAlign: "left", cursor: "pointer", display: "flex",
                          flexDirection: "column", gap: 2,
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "#ffffff10"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                      >
                        <span style={{ fontWeight: 600 }}>
                          {place.address?.city || place.address?.town ||
                           place.address?.village || place.address?.county || place.name}
                        </span>
                        <span style={{ fontSize: 11, color: "#ffffff40", fontFamily: "'DM Mono', monospace" }}>
                          {place.address?.state ? `${place.address.state}, ` : ""}
                          {place.address?.country || ""}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* GPS shortcut inside search panel */}
                <button
                  onClick={() => { setShowSearch(false); setSuggestions([]); setSearchQuery(""); getGPSLocation(); }}
                  style={{
                    width: "100%", marginTop: 8, padding: "10px 16px",
                    borderRadius: 12, border: "1px dashed #ffffff20",
                    background: "transparent", color: "#ffffff50", fontSize: 13,
                    fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}
                >
                  <span>📍</span> Use my current location
                </button>
              </div>
            )}
          </div>

          {/* ── UV Arc ── */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 0 16px", gap: 8 }}>
            {uvData ? (
              <>
                <UVArc uv={uvData.uv} accent={risk.accent} text={risk.text} />
                <div style={{
                  padding: "6px 20px", borderRadius: 999,
                  background: `${risk.accent}22`, border: `1px solid ${risk.accent}55`,
                  color: risk.accent, fontSize: 13, fontWeight: 600,
                  letterSpacing: 3, fontFamily: "'DM Mono', monospace",
                }}>
                  {risk.label}
                </div>
              </>
            ) : (
              <div style={{
                width: 180, height: 180, borderRadius: "50%",
                border: "2px dashed #ffffff15", display: "flex",
                alignItems: "center", justifyContent: "center",
                color: "#ffffff25", fontSize: 13,
                fontFamily: "'DM Sans', sans-serif", letterSpacing: 1,
              }}>
                NO DATA
              </div>
            )}
          </div>

          {/* ── Warning ── */}
          {uvData?.warning && (
            <div style={{
              padding: "16px 20px", borderRadius: 16,
              background: `${risk.accent}18`, border: `1px solid ${risk.accent}40`,
              marginBottom: 24, display: "flex", gap: 12, alignItems: "flex-start",
            }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>⚠️</span>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: risk.text, fontFamily: "'DM Sans', sans-serif" }}>
                {uvData.warning}
              </p>
            </div>
          )}

          {/* ── UV Scale ── */}
          <div style={{
            borderRadius: 16, background: "#ffffff08",
            border: "1px solid #ffffff10", padding: "20px", marginBottom: 24,
          }}>
            <p style={{ margin: "0 0 14px", fontSize: 11, letterSpacing: 2, color: "#ffffff40", fontFamily: "'DM Mono', monospace" }}>
              UV SCALE
            </p>
            {UV_BANDS.map((b) => (
              <div key={b.label} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "7px 0", borderBottom: "1px solid #ffffff08",
                opacity: uvData && uvData.risk.label === b.label ? 1 : 0.4,
                transition: "opacity 0.3s",
              }}>
                <div style={{
                  width: 10, height: 10, borderRadius: "50%", background: b.accent, flexShrink: 0,
                  boxShadow: uvData?.risk.label === b.label ? `0 0 8px ${b.accent}` : "none",
                }}/>
                <span style={{ fontSize: 13, color: b.text, fontFamily: "'DM Sans', sans-serif", flex: 1 }}>
                  {b.label}
                </span>
                <span style={{ fontSize: 12, color: "#ffffff30", fontFamily: "'DM Mono', monospace" }}>
                {b.max === Infinity ? `${b.min}+` : `${b.min}–${b.max}`}
                </span>
              </div>
            ))}
          </div>

          {/* ── Error ── */}
          {error && (
            <div style={{
              padding: "12px 16px", borderRadius: 12,
              background: "#f8717120", border: "1px solid #f8717140",
              color: "#fca5a5", fontSize: 13,
              fontFamily: "'DM Sans', sans-serif", marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          {/* ── Primary CTA (GPS) ── */}
          <button
            onClick={getGPSLocation}
            disabled={loading}
            style={{
              width: "100%", padding: "16px", borderRadius: 16, border: "none",
              background: loading ? "#ffffff15" : accentColor,
              color: loading ? "#ffffff40" : "#000",
              fontSize: 15, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
              cursor: loading ? "not-allowed" : "pointer", letterSpacing: 0.5,
              transition: "all 0.2s ease",
              boxShadow: loading ? "none" : `0 4px 24px ${accentColor}55`,
            }}
          >
            {loading ? "Detecting…" : uvData ? "🔄  Refresh" : "📍  Get My UV Level"}
          </button>
        </div>
      ),
    },
    {
      label: "Forecast", icon: "📅",
      content: (
        <EpicPlaceholder
          title="UV Forecast"
          description="Hourly and daily UV forecasts so you can plan your outdoor activities safely."
          icon="📅"
        />
      ),
    },
    {
      label: "Profile", icon: "👤",
      content: (
        <EpicPlaceholder
          title="My Profile"
          description="Set your skin type, track UV exposure history and get personalised recommendations."
          icon="👤"
        />
      ),
    },
  ];

  return (
    <div style={{
      minHeight: "100vh", background: bgColor, transition: "background 0.8s ease",
      display: "flex", flexDirection: "column", maxWidth: 430,
      margin: "0 auto", position: "relative",
    }}>
      {/* Top bar */}
      <div style={{
        padding: "20px 24px 0", display: "flex",
        justifyContent: "space-between", alignItems: "center", flexShrink: 0,
      }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, letterSpacing: 3, color: "#ffffff35", fontFamily: "'DM Mono', monospace" }}>
            SUNSAFE
          </p>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#ffffffee", fontFamily: "'DM Sans', sans-serif", lineHeight: 1.2 }}>
            {pages[activePage].label}
          </h1>
        </div>
        {uvData && (
          <div style={{
            padding: "4px 12px", borderRadius: 999, background: "#ffffff10",
            fontSize: 11, color: "#ffffff50", fontFamily: "'DM Mono', monospace", letterSpacing: 1,
          }}>
            LIVE
          </div>
        )}
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
        {pages[activePage].content}
      </div>

      {/* Bottom nav */}
      <div style={{
        flexShrink: 0, padding: "12px 24px 28px",
        background: "#00000060", backdropFilter: "blur(20px)",
        borderTop: "1px solid #ffffff10", display: "flex", gap: 8,
      }}>
        {pages.map((page, i) => (
          <button
            key={i}
            onClick={() => setActivePage(i)}
            style={{
              flex: 1, padding: "10px 8px", borderRadius: 14, border: "none",
              background: activePage === i ? (risk ? `${risk.accent}25` : "#ffffff15") : "transparent",
              color: activePage === i ? (risk ? risk.accent : "#ffffffcc") : "#ffffff40",
              fontSize: 11, fontFamily: "'DM Sans', sans-serif",
              fontWeight: activePage === i ? 700 : 400,
              letterSpacing: 0.5, cursor: "pointer", transition: "all 0.2s ease",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              outline: activePage === i ? `1px solid ${risk ? risk.accent + "40" : "#ffffff20"}` : "none",
            }}
          >
            <span style={{ fontSize: 18 }}>{page.icon}</span>
            {page.label}
          </button>
        ))}
      </div>
    </div>
  );
}